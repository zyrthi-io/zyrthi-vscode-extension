import * as vscode from 'vscode';
import { CliManager } from '../cli/cliManager';

export class StatusBarManager {
    private context: vscode.ExtensionContext;
    private cliManager: CliManager;
    
    private buildButton!: vscode.StatusBarItem;
    private flashButton!: vscode.StatusBarItem;
    private monitorButton!: vscode.StatusBarItem;
    private environmentButton!: vscode.StatusBarItem;
    private brandButton!: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext, cliManager: CliManager) {
        this.context = context;
        this.cliManager = cliManager;
    }

    initialize(): void {
        // Brand button (leftmost)
        this.brandButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.brandButton.text = '$(zap) Zyrthi';
        this.brandButton.tooltip = 'Zyrthi Embedded Development';
        this.brandButton.command = 'zyrthi.config';
        this.brandButton.show();

        // Environment selector
        this.environmentButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.environmentButton.text = '$(circuit-board) No Environment';
        this.environmentButton.tooltip = 'Select Environment';
        this.environmentButton.command = 'zyrthi.selectEnvironment';
        this.environmentButton.show();

        // Build button
        this.buildButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
        this.buildButton.text = '$(gear)';
        this.buildButton.tooltip = 'Build (zyrthi build)';
        this.buildButton.command = 'zyrthi.build';
        this.buildButton.show();

        // Flash button
        this.flashButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 89);
        this.flashButton.text = '$(cloud-upload)';
        this.flashButton.tooltip = 'Flash (zyrthi flash)';
        this.flashButton.command = 'zyrthi.flash';
        this.flashButton.show();

        // Monitor button
        this.monitorButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 88);
        this.monitorButton.text = '$(terminal)';
        this.monitorButton.tooltip = 'Serial Monitor (zyrthi monitor)';
        this.monitorButton.command = 'zyrthi.monitor';
        this.monitorButton.show();

        // Register disposables
        this.context.subscriptions.push(
            this.brandButton,
            this.environmentButton,
            this.buildButton,
            this.flashButton,
            this.monitorButton
        );

        // Load initial environment
        this.loadEnvironment();
    }

    private async loadEnvironment(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        // Try to detect environment from zyrthi.yaml
        try {
            const yamlPath = vscode.Uri.joinPath(workspaceFolders[0].uri, 'zyrthi.yaml');
            const content = await vscode.workspace.fs.readFile(yamlPath);
            const text = Buffer.from(content).toString('utf-8');
            
            // Parse platform and chip
            const platformMatch = text.match(/^platform:\s*(\S+)/m);
            const chipMatch = text.match(/^chip:\s*(\S+)/m);
            
            if (platformMatch && chipMatch) {
                this.updateEnvironment(`${platformMatch[1]}/${chipMatch[1]}`);
            } else if (chipMatch) {
                this.updateEnvironment(chipMatch[1]);
            }
        } catch {
            // No zyrthi.yaml
        }
    }

    updateEnvironment(env: string): void {
        this.environmentButton.text = `$(circuit-board) ${env}`;
        this.environmentButton.tooltip = `Current: ${env}\nClick to change`;
    }

    setBusy(command: 'build' | 'flash' | 'monitor'): void {
        const buttons: Record<string, vscode.StatusBarItem> = {
            build: this.buildButton,
            flash: this.flashButton,
            monitor: this.monitorButton
        };

        const button = buttons[command];
        if (button) {
            button.text = '$(sync~spin)';
        }
    }

    setIdle(command: 'build' | 'flash' | 'monitor'): void {
        const icons: Record<string, string> = {
            build: '$(gear)',
            flash: '$(cloud-upload)',
            monitor: '$(terminal)'
        };

        const buttons: Record<string, vscode.StatusBarItem> = {
            build: this.buildButton,
            flash: this.flashButton,
            monitor: this.monitorButton
        };

        const button = buttons[command];
        if (button) {
            button.text = icons[command];
        }
    }

    show(): void {
        this.brandButton.show();
        this.environmentButton.show();
        this.buildButton.show();
        this.flashButton.show();
        this.monitorButton.show();
    }

    hide(): void {
        this.brandButton.hide();
        this.environmentButton.hide();
        this.buildButton.hide();
        this.flashButton.hide();
        this.monitorButton.hide();
    }
}
