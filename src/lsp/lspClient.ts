import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State
} from 'vscode-languageclient/node';
import { ContainerManager } from '../container/containerManager';

export class LspClient {
    private context: vscode.ExtensionContext;
    private containerManager: ContainerManager;
    private client: LanguageClient | null = null;

    constructor(context: vscode.ExtensionContext, containerManager: ContainerManager) {
        this.context = context;
        this.containerManager = containerManager;
    }

    async start(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        // Clangd runs inside the build container
        // We'll use stdio to communicate with clangd in the container
        const runtime = this.containerManager.getRuntime();
        const config = vscode.workspace.getConfiguration('zyrthi');
        const image = config.get<string>('buildContainerImage') || 'ghcr.io/zyrthi-io/build-esp32:latest';

        const serverOptions: ServerOptions = {
            command: runtime,
            args: [
                'run', '--rm',
                '-v', `${workspaceRoot}:/workspace`,
                '-w', '/workspace',
                image,
                'clangd',
                `--compile-commands-dir=/workspace/build`,
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
            console.log('Clangd LSP started in container');
        } catch (error) {
            console.error('Failed to start clangd:', error);
            vscode.window.showErrorMessage(`Failed to start clangd: ${error}`);
        }
    }

    reloadConfig(): void {
        if (this.client && this.client.state === State.Running) {
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