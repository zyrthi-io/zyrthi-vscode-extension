import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import YAML from 'yaml';
import { CliManager } from '../cli/cliManager';

interface ConfigItem {
    key: string;
    value: string;
    description?: string;
}

export class ConfigProvider implements vscode.TreeDataProvider<ConfigItemNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ConfigItemNode | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private cliManager: CliManager;
    private config: Record<string, unknown> = {};

    constructor(context: vscode.ExtensionContext, cliManager: CliManager) {
        this.cliManager = cliManager;
    }

    refresh(): void {
        this.loadConfig();
        this._onDidChangeTreeData.fire(undefined);
    }

    private async loadConfig(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        try {
            const yamlPath = path.join(workspaceRoot, 'zyrthi.yaml');
            const content = await fs.promises.readFile(yamlPath, 'utf-8');
            this.config = YAML.parse(content) || {};
        } catch {
            this.config = {};
        }
    }

    getTreeItem(element: ConfigItemNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConfigItemNode): Promise<ConfigItemNode[]> {
        if (!element) {
            await this.loadConfig();
            return [
                new ConfigItemNode('Platform', String(this.config.platform || '-'), 'Target platform (esp32, stm32...)'),
                new ConfigItemNode('Chip', String(this.config.chip || '-'), 'Target chip'),
                new ConfigItemNode('Build Dir', String((this.config as Record<string, Record<string, string>>).build?.dir || 'build/'), 'Build output directory'),
                new ConfigItemNode('Monitor Baud', String((this.config as Record<string, Record<string, number>>).monitor?.baud || '115200'), 'Serial monitor baud rate'),
            ];
        }
        return [];
    }
}

class ConfigItemNode extends vscode.TreeItem {
    constructor(
        public readonly key: string,
        public readonly value: string,
        public readonly description?: string
    ) {
        super(key, vscode.TreeItemCollapsibleState.None);
        
        this.description = value;
        this.tooltip = description;
        this.iconPath = new vscode.ThemeIcon('symbol-property');
        
        this.command = {
            command: 'zyrthi.config',
            title: 'Open Config'
        };
    }
}
