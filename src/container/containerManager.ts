import * as vscode from 'vscode';
import { spawn, exec } from 'child_process';
import * as path from 'path';

export interface BuildResult {
    success: boolean;
    error?: string;
}

export interface ContainerStatus {
    runtime: string;
    runningContainers: number;
    images: number;
}

export class ContainerManager {
    private context: vscode.ExtensionContext;
    private runtime: 'podman' | 'docker' | null = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async checkRuntime(): Promise<boolean> {
        // Check podman first
        try {
            await this.execCommand('which podman');
            this.runtime = 'podman';
            return true;
        } catch {
            // Try docker
        }

        try {
            await this.execCommand('which docker');
            this.runtime = 'docker';
            return true;
        } catch {
            return false;
        }
    }

    private execCommand(cmd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    public getRuntime(): string {
        const config = vscode.workspace.getConfiguration('zyrthi');
        return config.get<string>('containerRuntime') || this.runtime || 'podman';
    }

    async build(workspaceRoot: string, progress: vscode.Progress<{ increment: number; message: string }>): Promise<BuildResult> {
        const runtime = this.getRuntime();
        const config = vscode.workspace.getConfiguration('zyrthi');
        const image = config.get<string>('buildContainerImage') || 'ghcr.io/zyrthi-io/build-esp32:latest';

        progress.report({ increment: 10, message: 'Pulling image...' });

        // Pull image if not exists
        try {
            await this.runContainerCommand(runtime, ['pull', image], progress, 20);
        } catch (error) {
            // Image pull failed, might already exist
        }

        progress.report({ increment: 30, message: 'Running build...' });

        // Run build in container
        const buildCmd = [
            'run', '--rm',
            '-v', `${workspaceRoot}:/workspace`,
            '-w', '/workspace',
            image,
            'cmake', '-B', 'build', '-G', 'Ninja',
            '&&', 'ninja', '-C', 'build'
        ];

        try {
            await this.runContainerCommand(runtime, buildCmd, progress, 60);
            progress.report({ increment: 100, message: 'Build complete!' });
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    private runContainerCommand(
        runtime: string,
        args: string[],
        progress: vscode.Progress<{ increment: number; message: string }>,
        progressPercent: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn(runtime, args, {
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
            });

            let stderr = '';

            proc.stdout.on('data', (data) => {
                console.log(data.toString());
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
                console.error(data.toString());
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(stderr || `Exit code: ${code}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }

    async clean(workspaceRoot: string): Promise<void> {
        const runtime = this.getRuntime();
        const buildDir = path.join(workspaceRoot, 'build');

        // Remove build directory
        const rimraf = require('fs').promises.rm;
        try {
            await rimraf(buildDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore
        }
    }

    async pullImage(platform: string, progress: vscode.Progress<{ increment: number; message: string }>): Promise<void> {
        const runtime = this.getRuntime();
        const image = `ghcr.io/zyrthi-io/build-${platform}:latest`;

        progress.report({ increment: 0, message: `Pulling ${image}...` });

        await this.runContainerCommand(runtime, ['pull', image], progress, 100);

        vscode.window.showInformationMessage(`Platform ${platform} installed successfully!`);
    }

    async getStatus(): Promise<ContainerStatus> {
        const runtime = this.getRuntime();

        const runningCmd = `${runtime} ps -q | wc -l`;
        const imagesCmd = `${runtime} images -q | wc -l`;

        let runningContainers = 0;
        let images = 0;

        try {
            const runningOut = await this.execCommand(runningCmd);
            runningContainers = parseInt(runningOut.trim(), 10) || 0;
        } catch { }

        try {
            const imagesOut = await this.execCommand(imagesCmd);
            images = parseInt(imagesOut.trim(), 10) || 0;
        } catch { }

        return {
            runtime: runtime,
            runningContainers,
            images
        };
    }

    // Execute clangd in container for LSP
    async execClangd(workspaceRoot: string): Promise<void> {
        const runtime = this.getRuntime();
        const config = vscode.workspace.getConfiguration('zyrthi');
        const image = config.get<string>('buildContainerImage') || 'ghcr.io/zyrthi-io/build-esp32:latest';

        // This will be called by LspClient
        // Returns a way to communicate with clangd in container
    }

    // Get container info for LSP connection
    getClangdConnectionInfo(): { type: 'socket' | 'stdio'; path?: string; port?: number } {
        // For now, use stdio via podman/docker exec
        return { type: 'stdio' };
    }
}