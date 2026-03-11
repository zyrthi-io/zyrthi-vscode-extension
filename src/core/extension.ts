import * as vscode from 'vscode';
import { CliManager } from '../cli/cliManager';
import { StatusBarManager } from '../toolbar/statusBar';
import { ClangdManager } from '../clangd/manager';
import { ConfigProvider } from '../config/configProvider';
import { ConfigPanel } from '../config/configPanel';
import { ProjectProvider } from '../sidebar/projectProvider';
import { DepsProvider } from '../sidebar/depsProvider';
import { MonitorPanel } from '../monitor/monitorPanel';

export class ZyrthiExtension {
    private context: vscode.ExtensionContext;
    private cliManager!: CliManager;
    private statusBar!: StatusBarManager;
    private clangdManager!: ClangdManager;
    private configProvider!: ConfigProvider;
    private configPanel!: ConfigPanel;
    private projectProvider!: ProjectProvider;
    private depsProvider!: DepsProvider;
    private monitorPanel!: MonitorPanel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async activate(): Promise<void> {
        // 1. Initialize CLI Manager
        this.cliManager = new CliManager(this.context);
        await this.cliManager.initialize();

        // 2. Initialize Status Bar
        this.statusBar = new StatusBarManager(this.context, this.cliManager);
        this.statusBar.initialize();

        // 3. Initialize Clangd
        this.clangdManager = new ClangdManager(this.context);
        await this.clangdManager.initialize();

        // 4. Initialize Sidebar Providers
        this.configProvider = new ConfigProvider(this.context, this.cliManager);
        this.projectProvider = new ProjectProvider(this.context, this.cliManager);
        this.depsProvider = new DepsProvider(this.context, this.cliManager);

        // 5. Initialize Panels
        this.configPanel = ConfigPanel.getInstance(this.context);
        this.monitorPanel = MonitorPanel.getInstance(this.context, this.cliManager);

        // 5. Register Commands
        this.registerCommands();

        // 6. Register Tree Views
        this.registerTreeViews();

        // 7. Check if zyrthi.yaml exists
        await this.checkProjectConfig();
    }

    private registerCommands(): void {
        const commands = [
            vscode.commands.registerCommand('zyrthi.newProject', () => this.newProject()),
            vscode.commands.registerCommand('zyrthi.init', () => this.initProject()),
            vscode.commands.registerCommand('zyrthi.build', () => this.build()),
            vscode.commands.registerCommand('zyrthi.flash', () => this.flash()),
            vscode.commands.registerCommand('zyrthi.buildAndFlash', () => this.buildAndFlash()),
            vscode.commands.registerCommand('zyrthi.buildFlashMonitor', () => this.buildFlashMonitor()),
            vscode.commands.registerCommand('zyrthi.monitor', () => this.openMonitor()),
            vscode.commands.registerCommand('zyrthi.config', () => this.openConfig()),
            vscode.commands.registerCommand('zyrthi.installDeps', () => this.installDeps()),
            vscode.commands.registerCommand('zyrthi.updateDeps', () => this.updateDeps()),
            vscode.commands.registerCommand('zyrthi.addDep', () => this.addDep()),
            vscode.commands.registerCommand('zyrthi.clean', () => this.clean()),
            vscode.commands.registerCommand('zyrthi.selectEnv', () => this.selectEnvironment()),
        ];

        commands.forEach(cmd => this.context.subscriptions.push(cmd));
    }

    private registerTreeViews(): void {
        const projectView = vscode.window.createTreeView('zyrthi.project', {
            treeDataProvider: this.projectProvider
        });
        const configView = vscode.window.createTreeView('zyrthi.config', {
            treeDataProvider: this.configProvider
        });
        const depsView = vscode.window.createTreeView('zyrthi.deps', {
            treeDataProvider: this.depsProvider
        });

        this.context.subscriptions.push(projectView, configView, depsView);
    }

    private async checkProjectConfig(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const zyrthiYaml = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'zyrthi.yaml');

        try {
            await vscode.workspace.fs.stat(zyrthiYaml);
            // zyrthi.yaml exists, notify clangd
            this.clangdManager.notifyConfigChange();
        } catch {
            // zyrthi.yaml doesn't exist, ask to initialize
            const result = await vscode.window.showInformationMessage(
                'No zyrthi.yaml found. Initialize a new Zyrthi project?',
                'Initialize',
                'Cancel'
            );
            if (result === 'Initialize') {
                await this.initProject();
            }
        }
    }

    private async newProject(): Promise<void> {
        // Get project name
        const projectName = await vscode.window.showInputBox({
            placeHolder: 'my-project',
            prompt: 'Enter project name'
        });
        if (!projectName) return;

        // Select platform
        const platforms = ['esp32', 'stm32', 'arduino'];
        const platform = await vscode.window.showQuickPick(platforms, {
            placeHolder: 'Select platform'
        });
        if (!platform) return;

        // Select chip
        let chips: string[];
        switch (platform) {
            case 'esp32':
                chips = ['esp32', 'esp32s3', 'esp32c3', 'esp32s2'];
                break;
            case 'stm32':
                chips = ['stm32f103', 'stm32f407', 'stm32h743'];
                break;
            default:
                chips = ['default'];
        }
        
        const chip = await vscode.window.showQuickPick(chips, {
            placeHolder: 'Select chip'
        });
        if (!chip) return;

        // Select folder
        const folder = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select project folder'
        });
        if (!folder || folder.length === 0) return;

        const projectPath = vscode.Uri.joinPath(folder[0], projectName);

        // Run zyrthi init
        await this.cliManager.runCommand('new', [
            '--name', projectName,
            '--platform', platform,
            '--chip', chip,
            '--path', folder[0].fsPath
        ]);

        // Open the new project
        vscode.commands.executeCommand('vscode.openFolder', projectPath);
    }

    private async initProject(): Promise<void> {
        // Show platform selection
        const platforms = ['esp32', 'stm32', 'arduino'];
        const platform = await vscode.window.showQuickPick(platforms, {
            placeHolder: 'Select platform'
        });
        if (!platform) return;

        // Show chip selection based on platform
        let chips: string[];
        switch (platform) {
            case 'esp32':
                chips = ['esp32', 'esp32s3', 'esp32c3', 'esp32s2'];
                break;
            case 'stm32':
                chips = ['stm32f103', 'stm32f407', 'stm32h743'];
                break;
            default:
                chips = ['default'];
        }
        
        const chip = await vscode.window.showQuickPick(chips, {
            placeHolder: 'Select chip'
        });
        if (!chip) return;

        // Run zyrthi init
        await this.cliManager.runCommand('init', ['--platform', platform, '--chip', chip]);
        
        // Refresh views
        this.projectProvider.refresh();
        this.configProvider.refresh();
        this.statusBar.updateEnvironment(`${platform}/${chip}`);
        
        vscode.window.showInformationMessage(`Zyrthi project initialized for ${platform}/${chip}`);
    }

    private async build(): Promise<void> {
        const result = await this.cliManager.runCommand('build');
        if (result.success) {
            this.projectProvider.refresh();
            this.clangdManager.notifyConfigChange();
            vscode.window.showInformationMessage('Build successful!');
        }
    }

    private async flash(): Promise<void> {
        // Check if build exists first
        const result = await this.cliManager.runCommand('flash');
        if (result.success) {
            vscode.window.showInformationMessage('Flash successful!');
        }
    }

    private async buildAndFlash(): Promise<void> {
        const buildResult = await this.cliManager.runCommand('build');
        if (buildResult.success) {
            const flashResult = await this.cliManager.runCommand('flash');
            if (flashResult.success) {
                vscode.window.showInformationMessage('Build & Flash successful!');
            }
        }
    }

    private async buildFlashMonitor(): Promise<void> {
        const buildResult = await this.cliManager.runCommand('build');
        if (buildResult.success) {
            const flashResult = await this.cliManager.runCommand('flash');
            if (flashResult.success) {
                await this.monitorPanel.show();
            }
        }
    }

    private async openMonitor(): Promise<void> {
        await this.monitorPanel.show();
    }

    private async openConfig(): Promise<void> {
        await this.configPanel.show();
    }

    private async installDeps(): Promise<void> {
        await this.cliManager.runCommand('install');
        this.depsProvider.refresh();
    }

    private async updateDeps(): Promise<void> {
        await this.cliManager.runCommand('update');
        this.depsProvider.refresh();
        vscode.window.showInformationMessage('Dependencies updated');
    }

    private async addDep(): Promise<void> {
        const depName = await vscode.window.showInputBox({
            placeHolder: 'Package name (e.g., zyrthi/sensor-dht)',
            prompt: 'Enter the package name to add'
        });
        if (!depName) return;

        const version = await vscode.window.showInputBox({
            placeHolder: 'Version (e.g., 0.1.0 or leave empty for latest)',
            prompt: 'Enter version constraint'
        });

        const args = ['add', depName];
        if (version) {
            args.push('--version', version);
        }

        await this.cliManager.runCommand('dep', args);
        this.depsProvider.refresh();
        vscode.window.showInformationMessage(`Added dependency: ${depName}`);
    }

    private async clean(): Promise<void> {
        await this.cliManager.runCommand('clean');
        vscode.window.showInformationMessage('Build cleaned');
    }

    private async selectEnvironment(): Promise<void> {
        const envs = await this.cliManager.getEnvironments();
        if (!envs || envs.length === 0) {
            vscode.window.showWarningMessage('No environments found');
            return;
        }

        const selected = await vscode.window.showQuickPick(envs, {
            placeHolder: 'Select environment'
        });
        if (selected) {
            this.statusBar.updateEnvironment(selected);
            this.clangdManager.notifyConfigChange();
        }
    }

    async deactivate(): Promise<void> {
        await this.clangdManager.stop();
    }
}
