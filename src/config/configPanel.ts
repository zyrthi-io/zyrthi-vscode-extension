import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import YAML from 'yaml';

interface ProjectConfig {
    platform: string;
    chip: string;
    build?: {
        dir?: string;
        flags?: string[];
    };
    monitor?: {
        baud?: number;
        port?: string;
    };
}

export class ConfigPanel {
    private static instance: ConfigPanel | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private config: ProjectConfig = { platform: '', chip: '' };
    private onConfigChange?: (config: ProjectConfig) => void;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    static getInstance(context: vscode.ExtensionContext): ConfigPanel {
        if (!ConfigPanel.instance) {
            ConfigPanel.instance = new ConfigPanel(context);
        }
        return ConfigPanel.instance;
    }

    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'zyrthiConfig',
            'Zyrthi Configuration',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Load existing config
        await this.loadConfig();

        // Set HTML
        this.panel.webview.html = this.getHtml();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'save':
                        await this.saveConfig(message.config);
                        break;
                    case 'getPlatforms':
                        this.panel?.webview.postMessage({
                            command: 'platforms',
                            data: this.getPlatforms()
                        });
                        break;
                    case 'getChips':
                        this.panel?.webview.postMessage({
                            command: 'chips',
                            data: this.getChips(message.platform)
                        });
                        break;
                    case 'detectPort':
                        const port = await this.detectSerialPort();
                        this.panel?.webview.postMessage({
                            command: 'portDetected',
                            port
                        });
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async loadConfig(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        try {
            const yamlPath = path.join(workspaceRoot, 'zyrthi.yaml');
            const content = await fs.promises.readFile(yamlPath, 'utf-8');
            this.config = YAML.parse(content) || this.config;
        } catch {
            // No config file
        }
    }

    private async saveConfig(config: ProjectConfig): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const yamlPath = path.join(workspaceRoot, 'zyrthi.yaml');
        const yamlContent = YAML.stringify(config);

        await fs.promises.writeFile(yamlPath, yamlContent, 'utf-8');
        this.config = config;

        vscode.window.showInformationMessage('Configuration saved!');

        if (this.onConfigChange) {
            this.onConfigChange(config);
        }
    }

    private getPlatforms(): Array<{ id: string; name: string }> {
        return [
            { id: 'esp32', name: 'ESP32 (Espressif)' },
            { id: 'stm32', name: 'STM32 (STMicroelectronics)' },
            { id: 'arduino', name: 'Arduino' }
        ];
    }

    private getChips(platform: string): Array<{ id: string; name: string }> {
        const chips: Record<string, Array<{ id: string; name: string }>> = {
            esp32: [
                { id: 'esp32', name: 'ESP32 (Classic)' },
                { id: 'esp32s3', name: 'ESP32-S3' },
                { id: 'esp32c3', name: 'ESP32-C3 (RISC-V)' },
                { id: 'esp32s2', name: 'ESP32-S2' },
                { id: 'esp32c6', name: 'ESP32-C6' }
            ],
            stm32: [
                { id: 'stm32f103', name: 'STM32F103 (Blue Pill)' },
                { id: 'stm32f407', name: 'STM32F407' },
                { id: 'stm32h743', name: 'STM32H743' }
            ],
            arduino: [
                { id: 'uno', name: 'Arduino Uno' },
                { id: 'nano', name: 'Arduino Nano' },
                { id: 'mega', name: 'Arduino Mega' }
            ]
        };
        return chips[platform] || [];
    }

    private async detectSerialPort(): Promise<string> {
        // This would use zyrthi CLI or serialport library
        return '/dev/ttyUSB0';
    }

    onConfigChanged(callback: (config: ProjectConfig) => void): void {
        this.onConfigChange = callback;
    }

    private getHtml(): string {
        const config = this.config;
        const platforms = this.getPlatforms();
        const chips = this.getChips(config.platform);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zyrthi Configuration</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 20px; }
        h2 { font-size: 16px; color: var(--vscode-textLink-foreground); margin: 20px 0 10px; }
        
        .form-group { margin-bottom: 16px; }
        label { display: block; margin-bottom: 6px; font-weight: 500; }
        
        select, input {
            width: 100%;
            padding: 8px 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 14px;
        }
        select:focus, input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .row { display: flex; gap: 12px; }
        .row .form-group { flex: 1; }
        
        button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .actions { margin-top: 24px; display: flex; gap: 12px; }
        
        .status {
            padding: 8px 12px;
            border-radius: 4px;
            margin-top: 12px;
            display: none;
        }
        .status.success {
            background: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Zyrthi Configuration</h1>
        
        <h2>Target</h2>
        <div class="row">
            <div class="form-group">
                <label for="platform">Platform</label>
                <select id="platform" onchange="onPlatformChange()">
                    <option value="">Select platform...</option>
                    ${platforms.map(p => `<option value="${p.id}" ${config.platform === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="chip">Chip</label>
                <select id="chip">
                    <option value="">Select chip...</option>
                    ${chips.map(c => `<option value="${c.id}" ${config.chip === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>
        </div>
        
        <h2>Build</h2>
        <div class="form-group">
            <label for="buildDir">Output Directory</label>
            <input type="text" id="buildDir" value="${config.build?.dir || 'build/'}" placeholder="build/">
        </div>
        <div class="form-group">
            <label for="buildFlags">Additional Flags</label>
            <input type="text" id="buildFlags" value="${config.build?.flags?.join(' ') || ''}" placeholder="-Os -Wall">
        </div>
        
        <h2>Monitor</h2>
        <div class="row">
            <div class="form-group">
                <label for="baudRate">Baud Rate</label>
                <select id="baudRate">
                    <option value="9600" ${config.monitor?.baud === 9600 ? 'selected' : ''}>9600</option>
                    <option value="19200" ${config.monitor?.baud === 19200 ? 'selected' : ''}>19200</option>
                    <option value="38400" ${config.monitor?.baud === 38400 ? 'selected' : ''}>38400</option>
                    <option value="57600" ${config.monitor?.baud === 57600 ? 'selected' : ''}>57600</option>
                    <option value="115200" ${config.monitor?.baud === 115200 || !config.monitor?.baud ? 'selected' : ''}>115200</option>
                    <option value="230400" ${config.monitor?.baud === 230400 ? 'selected' : ''}>230400</option>
                    <option value="921600" ${config.monitor?.baud === 921600 ? 'selected' : ''}>921600</option>
                </select>
            </div>
            <div class="form-group">
                <label for="port">Serial Port</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="port" value="${config.monitor?.port || ''}" placeholder="Auto-detect" style="flex: 1;">
                    <button class="secondary" onclick="detectPort()">Detect</button>
                </div>
            </div>
        </div>
        
        <div class="actions">
            <button onclick="save()">Save Configuration</button>
            <button class="secondary" onclick="build()">Build</button>
        </div>
        
        <div id="status" class="status"></div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function onPlatformChange() {
            const platform = document.getElementById('platform').value;
            vscode.postMessage({ command: 'getChips', platform });
        }
        
        function detectPort() {
            vscode.postMessage({ command: 'detectPort' });
        }
        
        function save() {
            const config = {
                platform: document.getElementById('platform').value,
                chip: document.getElementById('chip').value,
                build: {
                    dir: document.getElementById('buildDir').value,
                    flags: document.getElementById('buildFlags').value.split(' ').filter(f => f)
                },
                monitor: {
                    baud: parseInt(document.getElementById('baudRate').value),
                    port: document.getElementById('port').value
                }
            };
            vscode.postMessage({ command: 'save', config });
            showStatus('Configuration saved!');
        }
        
        function build() {
            save();
            // vscode.postMessage({ command: 'build' });
        }
        
        function showStatus(msg) {
            const status = document.getElementById('status');
            status.textContent = msg;
            status.className = 'status success';
            setTimeout(() => { status.className = 'status'; }, 2000);
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const msg = event.data;
            if (msg.command === 'chips') {
                const select = document.getElementById('chip');
                select.innerHTML = '<option value="">Select chip...</option>' +
                    msg.data.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join('');
            }
            if (msg.command === 'portDetected') {
                document.getElementById('port').value = msg.port;
            }
        });
    </script>
</body>
</html>`;
    }
}
