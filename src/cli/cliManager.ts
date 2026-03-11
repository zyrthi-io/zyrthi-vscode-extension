import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess, execSync } from 'child_process';

export interface CommandResult {
    success: boolean;
    output: string;
    error?: string;
}

export class CliManager {
    private context: vscode.ExtensionContext;
    private cliPath: string | null = null;
    private monitorProcess: ChildProcess | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async initialize(): Promise<void> {
        this.cliPath = await this.findZyrthiCli();
        
        if (!this.cliPath) {
            this.showInstallPrompt();
        } else {
            console.log(`Zyrthi CLI found at: ${this.cliPath}`);
        }
    }

    private async findZyrthiCli(): Promise<string | null> {
        // 1. Check VS Code setting
        const config = vscode.workspace.getConfiguration('zyrthi');
        const configuredPath = config.get<string>('cliPath');
        if (configuredPath && await this.fileExists(configuredPath)) {
            return configuredPath;
        }

        // 2. Check PATH
        try {
            const result = execSync('which zyrthi', { encoding: 'utf-8' }).trim();
            if (result && await this.fileExists(result)) {
                return result;
            }
        } catch {
            // Not in PATH
        }

        // 3. Check common installation paths
        const commonPaths = [
            '/usr/local/bin/zyrthi',
            '/opt/homebrew/bin/zyrthi',
            path.join(process.env.HOME || '', '.zyrthi', 'bin', 'zyrthi'),
            path.join(process.env.HOME || '', '.local', 'bin', 'zyrthi'),
        ];

        if (process.platform === 'win32') {
            commonPaths.push(
                'C:\\Program Files\\zyrthi\\zyrthi.exe',
                path.join(process.env.APPDATA || '', 'zyrthi', 'zyrthi.exe')
            );
        }

        for (const p of commonPaths) {
            if (await this.fileExists(p)) {
                return p;
            }
        }

        return null;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    private async showInstallPrompt(): Promise<void> {
        const action = await vscode.window.showErrorMessage(
            'Zyrthi CLI not found. Please install it to use this extension.',
            'Install',
            'Manual Install',
            'Ignore'
        );

        if (action === 'Install') {
            await this.installZyrthi();
        } else if (action === 'Manual Install') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/zyrthi-io/zyrthi-cli#installation'));
        }
    }

    private async installZyrthi(): Promise<void> {
        const terminal = vscode.window.createTerminal({
            name: 'Install Zyrthi CLI',
            iconPath: new vscode.ThemeIcon('zap')
        });

        terminal.show();

        switch (process.platform) {
            case 'darwin':
                terminal.sendText('brew install zyrthi');
                break;
            case 'linux':
                terminal.sendText('curl -fsSL https://get.zyrthi.io | sh');
                break;
            case 'win32':
                terminal.sendText('winget install zyrthi');
                break;
            default:
                vscode.window.showErrorMessage('Unsupported platform. Please install manually.');
        }
    }

    getCliPath(): string | null {
        return this.cliPath;
    }

    async runCommand(command: string, args: string[] = []): Promise<CommandResult> {
        if (!this.cliPath) {
            return { success: false, output: '', error: 'Zyrthi CLI not found' };
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        return new Promise((resolve) => {
            const proc = spawn(this.cliPath!, [command, ...args], {
                cwd: workspaceRoot,
                env: { ...process.env, GOPROXY: 'https://goproxy.cn,direct' }
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                resolve({
                    success: code === 0,
                    output: stdout,
                    error: stderr || undefined
                });
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    output: '',
                    error: err.message
                });
            });
        });
    }

    async runCommandWithProgress(command: string, args: string[] = [], message?: string): Promise<CommandResult> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: message || `Running zyrthi ${command}...`,
            cancellable: false
        }, async () => {
            return this.runCommand(command, args);
        });
    }

    async runMonitor(baud: number, port?: string): Promise<void> {
        if (!this.cliPath) {
            vscode.window.showErrorMessage('Zyrthi CLI not found');
            return;
        }

        // Kill existing monitor
        if (this.monitorProcess) {
            this.monitorProcess.kill();
            this.monitorProcess = null;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const args = ['monitor', '--baud', String(baud)];
        
        if (port) {
            args.push('--port', port);
        }

        // Create terminal for monitor
        const terminal = vscode.window.createTerminal({
            name: 'Zyrthi Monitor',
            iconPath: new vscode.ThemeIcon('terminal'),
            shellPath: this.cliPath,
            shellArgs: args,
            cwd: workspaceRoot
        });

        terminal.show();
    }

    async getEnvironments(): Promise<string[]> {
        // Parse zyrthi.yaml to get environments
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return [];

        try {
            const yamlPath = path.join(workspaceRoot, 'zyrthi.yaml');
            const content = await fs.promises.readFile(yamlPath, 'utf-8');
            
            // Simple parsing - in real implementation use yaml library
            const lines = content.split('\n');
            const envs: string[] = [];
            
            for (const line of lines) {
                const match = line.match(/^chip:\s*(\S+)/);
                if (match) {
                    envs.push(match[1]);
                }
            }
            
            return envs;
        } catch {
            return [];
        }
    }

    async getVersion(): Promise<string | null> {
        if (!this.cliPath) return null;
        
        try {
            const result = execSync(`"${this.cliPath}" version`, { encoding: 'utf-8' }).trim();
            return result;
        } catch {
            return null;
        }
    }
}
