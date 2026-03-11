import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { CliManager } from '../cli/cliManager';

interface PlotterData {
    type: 'data' | 'log';
    data?: Array<{ name: string; values: number[]; color: string }>;
    log?: string;
    time: string;
}

export class MonitorPanel {
    private static instance: MonitorPanel | undefined;
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private cliManager: CliManager;
    private process: ChildProcess | null = null;
    private isConnected: boolean = false;
    private baudRate: number = 115200;
    private port: string = '';

    constructor(context: vscode.ExtensionContext, cliManager: CliManager) {
        this.context = context;
        this.cliManager = cliManager;
    }

    static getInstance(context: vscode.ExtensionContext, cliManager: CliManager): MonitorPanel {
        if (!MonitorPanel.instance) {
            MonitorPanel.instance = new MonitorPanel(context, cliManager);
        }
        return MonitorPanel.instance;
    }

    async show(): Promise<void> {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'zyrthiMonitor',
            'Zyrthi Monitor',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtml();

        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'connect':
                        await this.connect(message.port, message.baud);
                        break;
                    case 'disconnect':
                        this.disconnect();
                        break;
                    case 'send':
                        this.send(message.data);
                        break;
                    case 'clear':
                        // Handled in webview
                        break;
                    case 'getPorts':
                        const ports = await this.getSerialPorts();
                        this.panel?.webview.postMessage({ command: 'ports', ports });
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        this.panel.onDidDispose(() => {
            this.disconnect();
            this.panel = undefined;
        });
    }

    private async getSerialPorts(): Promise<string[]> {
        // Use zyrthi CLI to list ports
        const result = await this.cliManager.runCommand('monitor', ['--list-ports']);
        if (result.success) {
            return result.output.split('\n').filter(p => p.trim());
        }
        return [];
    }

    async connect(port: string, baud: number): Promise<void> {
        if (this.isConnected) {
            this.disconnect();
        }

        this.port = port;
        this.baudRate = baud;

        const cliPath = this.cliManager.getCliPath();
        if (!cliPath) {
            vscode.window.showErrorMessage('Zyrthi CLI not found');
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        
        const args = ['monitor', '--baud', String(baud), '--json'];
        if (port) {
            args.push('--port', port);
        }

        this.process = spawn(cliPath, args, { cwd: workspaceRoot });

        this.process.stdout?.on('data', (data) => {
            const lines = data.toString().split('\n').filter((l: string) => l.trim());
            
            for (const line of lines) {
                try {
                    const parsed: PlotterData = JSON.parse(line);
                    
                    if (parsed.type === 'data' && parsed.data) {
                        this.panel?.webview.postMessage({
                            command: 'plotterData',
                            data: parsed.data,
                            time: parsed.time
                        });
                    } else if (parsed.type === 'log') {
                        this.panel?.webview.postMessage({
                            command: 'log',
                            text: parsed.log,
                            time: parsed.time
                        });
                    }
                } catch {
                    // Not JSON, treat as plain log
                    this.panel?.webview.postMessage({
                        command: 'log',
                        text: line,
                        time: new Date().toISOString()
                    });
                }
            }
        });

        this.process.stderr?.on('data', (data) => {
            this.panel?.webview.postMessage({
                command: 'error',
                text: data.toString()
            });
        });

        this.process.on('close', () => {
            this.isConnected = false;
            this.process = null;
            this.panel?.webview.postMessage({ command: 'disconnected' });
        });

        this.isConnected = true;
        this.panel?.webview.postMessage({ command: 'connected', port, baud });
    }

    disconnect(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
        this.isConnected = false;
    }

    send(data: string): void {
        if (this.process && this.isConnected) {
            this.process.stdin?.write(data + '\n');
        }
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zyrthi Monitor</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .toolbar {
            padding: 8px 12px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
            display: flex;
            align-items: center;
            gap: 12px;
            flex-shrink: 0;
        }
        
        select, input {
            padding: 6px 10px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
        }
        
        button {
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.connected { background: #e53935; }
        button.connected:hover { background: #c62828; }
        
        .tabs {
            display: flex;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
        }
        .tab {
            padding: 8px 16px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: var(--vscode-foreground);
            opacity: 0.7;
        }
        .tab:hover { opacity: 1; }
        .tab.active {
            border-bottom-color: var(--vscode-tab-activeBorder);
            opacity: 1;
        }
        
        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .tab-content { display: none; height: 100%; }
        .tab-content.active { display: flex; flex-direction: column; }
        
        #chartContainer {
            height: 200px;
            padding: 10px;
            border-bottom: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
        }
        
        #logContainer {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.5;
            background: var(--vscode-terminal-background);
        }
        
        .log-line { margin: 2px 0; }
        .log-time { color: var(--vscode-debugConsole-infoForeground); margin-right: 8px; }
        .log-info { color: var(--vscode-debugConsole-infoForeground); }
        .log-error { color: var(--vscode-debugConsole-errorForeground); }
        .log-data { color: var(--vscode-debugConsole-warningForeground); }
        
        .input-container {
            padding: 8px 12px;
            background: var(--vscode-editorGroupHeader-tabsBackground);
            border-top: 1px solid var(--vscode-editorGroupHeader-tabsBorder);
            display: flex;
            gap: 8px;
        }
        .input-container input { flex: 1; }
        
        .status {
            padding: 4px 12px;
            font-size: 12px;
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
        }
        .status.connected { color: #4caf50; }
    </style>
</head>
<body>
    <div class="toolbar">
        <select id="ports">
            <option value="">Auto-detect</option>
        </select>
        <select id="baud">
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200" selected>115200</option>
            <option value="230400">230400</option>
            <option value="921600">921600</option>
        </select>
        <button id="connectBtn" onclick="toggleConnect()">Connect</button>
        <button onclick="clearAll()">Clear</button>
    </div>
    
    <div class="tabs">
        <div class="tab active" onclick="showTab('monitor')">Monitor</div>
        <div class="tab" onclick="showTab('plotter')">Plotter</div>
    </div>
    
    <div class="content">
        <div id="monitorTab" class="tab-content active">
            <div id="logContainer"></div>
            <div class="input-container">
                <input type="text" id="input" placeholder="Type to send..." onkeypress="handleInput(event)">
                <button onclick="sendInput()">Send</button>
            </div>
        </div>
        
        <div id="plotterTab" class="tab-content">
            <div id="chartContainer">
                <canvas id="chart"></canvas>
            </div>
            <div id="logContainer2" style="flex:1; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 12px; background: var(--vscode-terminal-background);"></div>
        </div>
    </div>
    
    <div class="status" id="status">Disconnected</div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let isConnected = false;
        let chart = null;
        let plotterData = {};
        const maxPoints = 100;
        const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];
        let colorIdx = 0;
        
        // Initialize chart
        const ctx = document.getElementById('chart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: false },
                    y: { beginAtZero: false }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
        
        function toggleConnect() {
            if (isConnected) {
                vscode.postMessage({ command: 'disconnect' });
            } else {
                const port = document.getElementById('ports').value;
                const baud = parseInt(document.getElementById('baud').value);
                vscode.postMessage({ command: 'connect', port, baud });
            }
        }
        
        function handleInput(e) {
            if (e.key === 'Enter') sendInput();
        }
        
        function sendInput() {
            const input = document.getElementById('input');
            if (input.value) {
                vscode.postMessage({ command: 'send', data: input.value });
                input.value = '';
            }
        }
        
        function clearAll() {
            document.getElementById('logContainer').innerHTML = '';
            document.getElementById('logContainer2').innerHTML = '';
            plotterData = {};
            chart.data.datasets = [];
            chart.update('none');
        }
        
        function showTab(name) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(name + 'Tab').classList.add('active');
        }
        
        function appendLog(text, time, type = '') {
            const line = document.createElement('div');
            line.className = 'log-line';
            line.innerHTML = '<span class="log-time">[' + time + ']</span> <span class="log-' + type + '">' + escapeHtml(text) + '</span>';
            document.getElementById('logContainer').appendChild(line);
            document.getElementById('logContainer').scrollTop = document.getElementById('logContainer').scrollHeight;
            
            const line2 = line.cloneNode(true);
            document.getElementById('logContainer2').appendChild(line2);
            document.getElementById('logContainer2').scrollTop = document.getElementById('logContainer2').scrollHeight;
        }
        
        function escapeHtml(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        
        function updatePlotter(data) {
            data.forEach(series => {
                if (!plotterData[series.name]) {
                    plotterData[series.name] = {
                        values: [],
                        color: colors[colorIdx++ % colors.length]
                    };
                }
                plotterData[series.name].values = series.values.slice(-maxPoints);
            });
            
            chart.data.datasets = Object.entries(plotterData).map(([name, data]) => ({
                label: name,
                data: data.values,
                borderColor: data.color,
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            }));
            chart.update('none');
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const msg = event.data;
            
            switch (msg.command) {
                case 'connected':
                    isConnected = true;
                    document.getElementById('connectBtn').textContent = 'Disconnect';
                    document.getElementById('connectBtn').classList.add('connected');
                    document.getElementById('status').textContent = 'Connected to ' + msg.port + ' @ ' + msg.baud;
                    document.getElementById('status').classList.add('connected');
                    break;
                    
                case 'disconnected':
                    isConnected = false;
                    document.getElementById('connectBtn').textContent = 'Connect';
                    document.getElementById('connectBtn').classList.remove('connected');
                    document.getElementById('status').textContent = 'Disconnected';
                    document.getElementById('status').classList.remove('connected');
                    break;
                    
                case 'log':
                    appendLog(msg.text, msg.time || new Date().toLocaleTimeString());
                    break;
                    
                case 'error':
                    appendLog(msg.text, new Date().toLocaleTimeString(), 'error');
                    break;
                    
                case 'plotterData':
                    updatePlotter(msg.data);
                    break;
                    
                case 'ports':
                    const select = document.getElementById('ports');
                    msg.ports.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p;
                        opt.textContent = p;
                        select.appendChild(opt);
                    });
                    break;
            }
        });
        
        // Request ports on load
        vscode.postMessage({ command: 'getPorts' });
    </script>
</body>
</html>`;
    }
}
