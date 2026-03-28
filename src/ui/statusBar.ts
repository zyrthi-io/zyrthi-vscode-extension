import * as vscode from 'vscode';
import { PlatformManager } from '../platform/platformManager';

export class StatusBar {
    private context: vscode.ExtensionContext;
    private platformManager: PlatformManager;
    private platformItem: vscode.StatusBarItem;
    private chipItem: vscode.StatusBarItem;
    private buildItem: vscode.StatusBarItem;
    private flashItem: vscode.StatusBarItem;
    private monitorItem: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext, platformManager: PlatformManager) {
        this.context = context;
        this.platformManager = platformManager;

        // Platform status
        this.platformItem = vscode.window.createStatusBarItem(
            'zyrthi.platform',
            vscode.StatusBarAlignment.Left,
            100
        );
        this.platformItem.command = 'zyrthi.selectPlatform';
        this.platformItem.tooltip = 'Click to select platform';

        // Chip status
        this.chipItem = vscode.window.createStatusBarItem(
            'zyrthi.chip',
            vscode.StatusBarAlignment.Left,
            101
        );
        this.chipItem.command = 'zyrthi.selectChip';
        this.chipItem.tooltip = 'Click to select chip';

        // Build button
        this.buildItem = vscode.window.createStatusBarItem(
            'zyrthi.build',
            vscode.StatusBarAlignment.Left,
            102
        );
        this.buildItem.text = '$(gear) Build';
        this.buildItem.command = 'zyrthi.build';
        this.buildItem.tooltip = 'Build project (Ctrl+Shift+B)';

        // Flash button
        this.flashItem = vscode.window.createStatusBarItem(
            'zyrthi.flash',
            vscode.StatusBarAlignment.Left,
            103
        );
        this.flashItem.text = '$(cloud-upload) Flash';
        this.flashItem.command = 'zyrthi.flash';
        this.flashItem.tooltip = 'Flash to device (Ctrl+Shift+U)';

        // Monitor button
        this.monitorItem = vscode.window.createStatusBarItem(
            'zyrthi.monitor',
            vscode.StatusBarAlignment.Left,
            104
        );
        this.monitorItem.text = '$(terminal) Monitor';
        this.monitorItem.command = 'zyrthi.monitor';
        this.monitorItem.tooltip = 'Open serial monitor (Ctrl+Shift+M)';
    }

    initialize(): void {
        this.platformItem.show();
        this.chipItem.show();
        this.buildItem.show();
        this.flashItem.show();
        this.monitorItem.show();

        // Update with current platform/chip
        this.updatePlatform(this.platformManager.getCurrentPlatform());
        this.updateChip(this.platformManager.getCurrentChip());
    }

    updatePlatform(platform: string): void {
        this.platformItem.text = `$(circuit-board) ${platform}`;
    }

    updateChip(chip: string): void {
        this.chipItem.text = `$(chip) ${chip}`;
    }

    setBuilding(isBuilding: boolean): void {
        if (isBuilding) {
            this.buildItem.text = '$(sync~spin) Building...';
            this.buildItem.command = undefined;
        } else {
            this.buildItem.text = '$(gear) Build';
            this.buildItem.command = 'zyrthi.build';
        }
    }

    setFlashing(isFlashing: boolean): void {
        if (isFlashing) {
            this.flashItem.text = '$(sync~spin) Flashing...';
            this.flashItem.command = undefined;
        } else {
            this.flashItem.text = '$(cloud-upload) Flash';
            this.flashItem.command = 'zyrthi.flash';
        }
    }

    setMonitoring(isMonitoring: boolean): void {
        if (isMonitoring) {
            this.monitorItem.text = '$(radio-tower) Connected';
            this.monitorItem.tooltip = 'Click to close monitor';
        } else {
            this.monitorItem.text = '$(terminal) Monitor';
            this.monitorItem.tooltip = 'Open serial monitor (Ctrl+Shift+M)';
        }
    }

    dispose(): void {
        this.platformItem.dispose();
        this.chipItem.dispose();
        this.buildItem.dispose();
        this.flashItem.dispose();
        this.monitorItem.dispose();
    }
}