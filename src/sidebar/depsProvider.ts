import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import YAML from 'yaml';
import { CliManager } from '../cli/cliManager';

interface Dependency {
    name: string;
    version: string;
}

export class DepsProvider implements vscode.TreeDataProvider<DepsItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<DepsItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private cliManager: CliManager;
    private deps: Dependency[] = [];

    constructor(context: vscode.ExtensionContext, cliManager: CliManager) {
        this.cliManager = cliManager;
    }

    refresh(): void {
        this.loadDeps();
        this._onDidChangeTreeData.fire(undefined);
    }

    private async loadDeps(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return;
        }

        try {
            const yamlPath = path.join(workspaceRoot, 'package.yaml');
            const content = await fs.promises.readFile(yamlPath, 'utf-8');
            const pkg = YAML.parse(content) || {};
            
            const dependencies = pkg.dependencies as Record<string, string> || {};
            this.deps = Object.entries(dependencies).map(([name, version]) => ({
                name,
                version: String(version)
            }));
        } catch {
            this.deps = [];
        }
    }

    getTreeItem(element: DepsItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: DepsItem): Promise<DepsItem[]> {
        if (!element) {
            await this.loadDeps();
            
            const items: DepsItem[] = this.deps.map(dep => 
                new DepsItem(dep.name, dep.version, 'dep')
            );
            
            // Add "Add Dependency" button
            items.push(new DepsItem('+ Add Dependency', '', 'add'));
            
            return items;
        }
        return [];
    }
}

class DepsItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly version: string,
        public readonly contextValue: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);

        if (contextValue === 'dep') {
            this.description = `@${version}`;
            this.iconPath = new vscode.ThemeIcon('package');
            this.contextValue = 'dependency';
        } else if (contextValue === 'add') {
            this.iconPath = new vscode.ThemeIcon('add');
            this.command = {
                command: 'zyrthi.installDeps',
                title: 'Add Dependency'
            };
        }
    }
}
