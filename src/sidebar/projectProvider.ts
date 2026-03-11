import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CliManager } from '../cli/cliManager';

export class ProjectProvider implements vscode.TreeDataProvider<ProjectItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ProjectItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private cliManager: CliManager;

    constructor(context: vscode.ExtensionContext, cliManager: CliManager) {
        this.cliManager = cliManager;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ProjectItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ProjectItem): Promise<ProjectItem[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return [];
        }

        if (!element) {
            // Root level
            return [
                new ProjectItem('src/', vscode.TreeItemCollapsibleState.Collapsed, 'folder'),
                new ProjectItem('include/', vscode.TreeItemCollapsibleState.Collapsed, 'folder'),
                new ProjectItem('zyrthi.yaml', vscode.TreeItemCollapsibleState.None, 'file'),
            ];
        }

        // Get children of folder
        if (element.contextValue === 'folder') {
            const folderName = element.label.replace('/', '');
            const folderPath = path.join(workspaceRoot, folderName);
            
            try {
                const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
                return entries
                    .filter(e => e.isFile() && (e.name.endsWith('.c') || e.name.endsWith('.h')))
                    .map(e => new ProjectItem(
                        e.name,
                        vscode.TreeItemCollapsibleState.None,
                        'file',
                        vscode.Uri.file(path.join(folderPath, e.name))
                    ));
            } catch {
                return [];
            }
        }

        return [];
    }
}

class ProjectItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly resourceUri?: vscode.Uri
    ) {
        super(label, collapsibleState);

        if (contextValue === 'folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (label.endsWith('.c')) {
            this.iconPath = new vscode.ThemeIcon('file-code');
            this.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [resourceUri]
            };
        } else if (label.endsWith('.h')) {
            this.iconPath = new vscode.ThemeIcon('file-code');
            this.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [resourceUri]
            };
        } else if (label === 'zyrthi.yaml') {
            this.iconPath = new vscode.ThemeIcon('settings-gear');
            this.command = {
                command: 'vscode.open',
                title: 'Open',
                arguments: [resourceUri || vscode.Uri.file(label)]
            };
        }
    }
}
