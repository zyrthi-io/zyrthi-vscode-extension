import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';
import * as zlib from 'zlib';
import { exec, spawn } from 'child_process';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State
} from 'vscode-languageclient/node';

const CLANGD_VERSION = '18.1.3';

interface PlatformInfo {
    name: string;
    url: string;
    sha256?: string;
}

const CLANGD_PLATFORMS: Record<string, PlatformInfo> = {
    'darwin-arm64': {
        name: 'clangd-mac-arm64',
        url: `https://github.com/llvm/llvm-project/releases/download/llvmorg-${CLANGD_VERSION}/clangd-mac-arm64-${CLANGD_VERSION}.zip`
    },
    'darwin-x64': {
        name: 'clangd-mac-x64',
        url: `https://github.com/llvm/llvm-project/releases/download/llvmorg-${CLANGD_VERSION}/clangd-mac-x64-${CLANGD_VERSION}.zip`
    },
    'linux-x64': {
        name: 'clangd-linux',
        url: `https://github.com/llvm/llvm-project/releases/download/llvmorg-${CLANGD_VERSION}/clangd-linux-${CLANGD_VERSION}.zip`
    },
    'win32-x64': {
        name: 'clangd-windows',
        url: `https://github.com/llvm/llvm-project/releases/download/llvmorg-${CLANGD_VERSION}/clangd-windows-${CLANGD_VERSION}.zip`
    }
};

export class ClangdManager {
    private context: vscode.ExtensionContext;
    private client: LanguageClient | null = null;
    private clangdPath: string | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async initialize(): Promise<void> {
        this.clangdPath = await this.ensureClangd();
        
        if (this.clangdPath) {
            await this.startLanguageServer();
        }
    }

    private getPlatform(): string {
        return `${process.platform}-${process.arch}`;
    }

    private getInstallDir(): string {
        return path.join(os.homedir(), '.zyrthi', 'clangd', CLANGD_VERSION);
    }

    private getBinaryPath(): string {
        const installDir = this.getInstallDir();
        const binaryName = process.platform === 'win32' ? 'clangd.exe' : 'clangd';
        return path.join(installDir, 'bin', binaryName);
    }

    private async ensureClangd(): Promise<string | null> {
        // 1. Check VS Code setting
        const config = vscode.workspace.getConfiguration('zyrthi');
        const configuredPath = config.get<string>('clangd.path');
        if (configuredPath && await this.fileExists(configuredPath)) {
            return configuredPath;
        }

        // 2. Check PATH
        const pathBinary = await this.findInPath('clangd');
        if (pathBinary) {
            return pathBinary;
        }

        // 3. Check installed version
        const installedPath = this.getBinaryPath();
        if (await this.fileExists(installedPath)) {
            return installedPath;
        }

        // 4. Download silently
        return await this.downloadClangd();
    }

    private async findInPath(binary: string): Promise<string | null> {
        return new Promise((resolve) => {
            const command = process.platform === 'win32' ? 'where' : 'which';
            exec(`${command} ${binary}`, (error, stdout) => {
                if (error) {
                    resolve(null);
                } else {
                    const result = stdout.trim().split('\n')[0];
                    resolve(result || null);
                }
            });
        });
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    private async downloadClangd(): Promise<string | null> {
        const platform = this.getPlatform();
        const platformInfo = CLANGD_PLATFORMS[platform];

        if (!platformInfo) {
            vscode.window.showErrorMessage(`Unsupported platform: ${platform}`);
            return null;
        }

        const installDir = this.getInstallDir();
        const binaryPath = this.getBinaryPath();

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: `Zyrthi: Downloading clangd ${CLANGD_VERSION}...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: 'Preparing...' });

                // Create directory
                await fs.promises.mkdir(installDir, { recursive: true });

                // Download
                progress.report({ increment: 10, message: 'Downloading...' });
                const zipPath = path.join(installDir, 'clangd.zip');
                await this.downloadFile(platformInfo.url, zipPath, (percent) => {
                    progress.report({ increment: percent * 0.7 });
                });

                // Extract
                progress.report({ increment: 80, message: 'Extracting...' });
                await this.extractZip(zipPath, installDir);

                // Cleanup
                await fs.promises.unlink(zipPath);

                // Make executable (Unix)
                if (process.platform !== 'win32') {
                    await fs.promises.chmod(binaryPath, 0o755);
                }

                progress.report({ increment: 100, message: 'Done!' });
                
                vscode.window.showInformationMessage(`clangd ${CLANGD_VERSION} installed successfully`);
                return binaryPath;

            } catch (error) {
                vscode.window.showErrorMessage(`Failed to download clangd: ${error}`);
                return null;
            }
        });
    }

    private downloadFile(url: string, dest: string, onProgress: (percent: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            let downloaded = 0;
            let total = 0;

            const request = (url: string) => {
                https.get(url, {
                    headers: { 'User-Agent': 'zyrthi-vscode-extension' }
                }, (response) => {
                    if (response.statusCode === 302 || response.statusCode === 301) {
                        const location = response.headers.location;
                        if (location) {
                            request(location);
                            return;
                        }
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    total = parseInt(response.headers['content-length'] || '0', 10);
                    
                    response.on('data', (chunk) => {
                        downloaded += chunk.length;
                        if (total > 0) {
                            onProgress(downloaded / total);
                        }
                    });

                    response.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(dest, () => reject(err));
                });
            };

            request(url);
        });
    }

    private async extractZip(zipPath: string, dest: string): Promise<void> {
        // Use system unzip for simplicity
        return new Promise((resolve, reject) => {
            const command = process.platform === 'win32'
                ? `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${dest}' -Force"`
                : `unzip -o "${zipPath}" -d "${dest}"`;

            exec(command, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    private async startLanguageServer(): Promise<void> {
        if (!this.clangdPath) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        const serverOptions: ServerOptions = {
            command: this.clangdPath,
            args: [
                `--compile-commands-dir=${workspaceRoot}/build`,
                '--header-insertion=iwyu',
                '--pch-storage=memory',
                '--background-index',
                '--clang-tidy',
                '--completion-style=detailed'
            ]
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: 'file', language: 'c' },
                { scheme: 'file', language: 'cpp' }
            ],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher('**/build/**')
            },
            outputChannel: vscode.window.createOutputChannel('Zyrthi Clangd')
        };

        this.client = new LanguageClient(
            'zyrthi-clangd',
            'Zyrthi Clangd',
            serverOptions,
            clientOptions
        );

        try {
            await this.client.start();
            console.log('Clangd language server started');
        } catch (error) {
            console.error('Failed to start clangd:', error);
        }
    }

    notifyConfigChange(): void {
        if (this.client && this.client.state === State.Running) {
            // Notify clangd to reload compile_commands.json
            this.client.sendNotification('workspace/didChangeConfiguration', {
                settings: {}
            });
        }
    }

    async stop(): Promise<void> {
        if (this.client) {
            await this.client.stop();
            this.client = null;
        }
    }
}
