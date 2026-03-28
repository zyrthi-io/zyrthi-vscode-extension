import * as vscode from 'vscode';
import { ContainerManager } from './container/containerManager';
import { PlatformManager } from './platform/platformManager';
import { FlashPanel } from './flash/flashPanel';
import { MonitorPanel } from './monitor/monitorPanel';
import { LspClient } from './lsp/lspClient';
import { StatusBar } from './ui/statusBar';

let containerManager: ContainerManager;
let platformManager: PlatformManager;
let lspClient: LspClient;
let statusBar: StatusBar;
let contextGlobal: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Zyrthi extension is activating...');
    contextGlobal = context;

    // Initialize managers
    containerManager = new ContainerManager(context);
    platformManager = new PlatformManager(context);
    
    // Initialize UI
    statusBar = new StatusBar(context, platformManager);
    
    // Initialize LSP client
    lspClient = new LspClient(context, containerManager);

    // Check container runtime
    const hasRuntime = await containerManager.checkRuntime();
    if (!hasRuntime) {
        vscode.window.showErrorMessage(
            'No container runtime found. Please install Podman or Docker.',
            'Install Podman',
            'Ignore'
        ).then(selection => {
            if (selection === 'Install Podman') {
                vscode.env.openExternal(
                    vscode.Uri.parse('https://podman.io/getting-started/installation')
                );
            }
        });
    }

    // Check project config
    await checkProjectConfig(context);

    // Register commands
    registerCommands(context);

    console.log('Zyrthi extension activated');
}

function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        vscode.commands.registerCommand('zyrthi.selectPlatform', () => selectPlatform()),
        vscode.commands.registerCommand('zyrthi.selectChip', () => selectChip()),
        vscode.commands.registerCommand('zyrthi.build', () => build()),
        vscode.commands.registerCommand('zyrthi.flash', () => flash()),
        vscode.commands.registerCommand('zyrthi.buildAndFlash', () => buildAndFlash()),
        vscode.commands.registerCommand('zyrthi.buildFlashMonitor', () => buildFlashMonitor()),
        vscode.commands.registerCommand('zyrthi.monitor', () => openMonitor()),
        vscode.commands.registerCommand('zyrthi.clean', () => clean()),
        vscode.commands.registerCommand('zyrthi.selectPort', () => selectPort()),
        vscode.commands.registerCommand('zyrthi.installPlatform', () => installPlatform()),
        vscode.commands.registerCommand('zyrthi.containerStatus', () => showContainerStatus()),
    ];

    commands.forEach(cmd => context.subscriptions.push(cmd));
}

async function checkProjectConfig(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const zyrthiYaml = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'zyrthi.yaml');

    try {
        await vscode.workspace.fs.stat(zyrthiYaml);
        await platformManager.loadConfig(workspaceRoot);
        statusBar.updatePlatform(platformManager.getCurrentPlatform());
    } catch {
        // No zyrthi.yaml - silently ignore
    }
}

async function selectPlatform() {
    const platforms = platformManager.getAvailablePlatforms();
    const selected = await vscode.window.showQuickPick(platforms, {
        placeHolder: 'Select platform'
    });
    
    if (selected) {
        await platformManager.setPlatform(selected);
        statusBar.updatePlatform(selected);
        await selectChip();
    }
}

async function selectChip() {
    const chips = platformManager.getAvailableChips();
    const selected = await vscode.window.showQuickPick(chips, {
        placeHolder: 'Select chip'
    });
    
    if (selected) {
        await platformManager.setChip(selected);
        statusBar.updateChip(selected);
    }
}

async function build() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder');
        return;
    }

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Building...',
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: 'Starting container...' });
        
        const result = await containerManager.build(workspaceRoot, progress);
        
        if (result.success) {
            vscode.window.showInformationMessage('Build successful!');
            lspClient.reloadConfig();
        } else {
            vscode.window.showErrorMessage(`Build failed: ${result.error}`);
        }
    });
}

async function flash() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder');
        return;
    }

    const buildPath = platformManager.getBuildPath(workspaceRoot);
    const firmwarePath = `${buildPath}/zyrthi-app.bin`;
    
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(firmwarePath));
    } catch {
        vscode.window.showErrorMessage('No firmware found. Please build first.');
        return;
    }

    const panel = FlashPanel.getInstance(contextGlobal);
    await panel.show(firmwarePath);
}

async function buildAndFlash() {
    await build();
    await flash();
}

async function buildFlashMonitor() {
    await build();
    await flash();
    await openMonitor();
}

async function openMonitor() {
    const panel = MonitorPanel.getInstance(contextGlobal);
    await panel.show();
}

async function clean() {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        return;
    }

    await containerManager.clean(workspaceRoot);
    vscode.window.showInformationMessage('Build cleaned');
}

async function selectPort() {
    vscode.window.showInformationMessage('Use Flash or Monitor panel to select port');
}

async function installPlatform() {
    const platforms = platformManager.getAvailablePlatforms();
    const selected = await vscode.window.showQuickPick(platforms, {
        placeHolder: 'Select platform to install'
    });
    
    if (selected) {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Installing ${selected}...`,
            cancellable: false
        }, async (progress) => {
            await containerManager.pullImage(selected, progress);
        });
    }
}

async function showContainerStatus() {
    const status = await containerManager.getStatus();
    vscode.window.showInformationMessage(
        `Container Runtime: ${status.runtime}\n` +
        `Running Containers: ${status.runningContainers}\n` +
        `Images: ${status.images}`
    );
}

export async function deactivate() {
    await lspClient.stop();
}