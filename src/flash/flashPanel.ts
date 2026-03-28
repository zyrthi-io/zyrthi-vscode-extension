import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class FlashPanel {
    public static currentPanel: FlashPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;
    private firmwarePath: string = '';
    private firmwareData: ArrayBuffer | null = null;

    constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this.panel = panel;
        this.context = context;
        this.update();
    }

    public static getInstance(context: vscode.ExtensionContext): FlashPanel {
        if (!FlashPanel.currentPanel) {
            const panel = vscode.window.createWebviewPanel(
                'zyrthiFlash',
                'Zyrthi Flash',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            FlashPanel.currentPanel = new FlashPanel(panel, context);
        }
        return FlashPanel.currentPanel;
    }

    public async show(firmwarePath: string): Promise<void> {
        this.firmwarePath = firmwarePath;
        
        // Read firmware file
        try {
            if (fs.existsSync(firmwarePath)) {
                const buffer = fs.readFileSync(firmwarePath);
                this.firmwareData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            }
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to read firmware: ${e}`);
            return;
        }

        this.panel.reveal();
        this.update();
    }

    private update(): void {
        this.panel.webview.html = this.getHtml();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'requestFirmware':
                        if (this.firmwareData) {
                            this.panel.webview.postMessage({
                                command: 'firmwareData',
                                data: Array.from(new Uint8Array(this.firmwareData)),
                                path: this.firmwarePath
                            });
                        }
                        break;
                    case 'flashComplete':
                        vscode.window.showInformationMessage(message.message || 'Flash complete!');
                        break;
                    case 'flashError':
                        vscode.window.showErrorMessage(message.error || 'Flash failed!');
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private getHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zyrthi Flash</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
        }
        .container { max-width: 700px; margin: 0 auto; }
        h1 { font-size: 1.5em; margin-bottom: 20px; color: var(--vscode-foreground); }
        
        .section {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
        }
        
        .section-title {
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--vscode-foreground);
        }
        
        .form-group { margin-bottom: 12px; }
        label { 
            display: block; 
            margin-bottom: 6px;
            font-size: 13px;
            color: var(--vscode-foreground);
        }
        select, input {
            width: 100%;
            padding: 8px 10px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
            font-size: 13px;
        }
        select:focus, input:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 16px;
        }
        
        button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            flex: 1;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button:disabled { 
            opacity: 0.5; 
            cursor: not-allowed;
            background: var(--vscode-button-secondaryBackground);
        }
        
        .primary {
            background: var(--vscode-button-background);
        }
        
        .log {
            background: var(--vscode-terminal-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 12px;
            height: 250px;
            overflow-y: auto;
            font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.5;
            margin-top: 16px;
            border-radius: 4px;
        }
        
        .progress-container {
            margin-top: 16px;
        }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: var(--vscode-progressBar-background);
            border-radius: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background: var(--vscode-progressBar-foreground);
            width: 0%;
            transition: width 0.2s;
        }
        
        .status {
            margin-top: 8px;
            font-size: 13px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .chip-info {
            background: var(--vscode-textCodeBlock-background);
            padding: 12px;
            border-radius: 4px;
            margin-top: 8px;
            font-size: 12px;
            font-family: monospace;
        }
        
        .chip-info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        
        .chip-info-label {
            color: var(--vscode-descriptionForeground);
        }
        
        .chip-info-value {
            color: var(--vscode-foreground);
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Zyrthi Flash</h1>
        
        <div class="section">
            <div class="section-title">Firmware</div>
            <div class="form-group">
                <label>Firmware File:</label>
                <input type="text" id="firmware" value="${this.firmwarePath}" readonly>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">Connection Settings</div>
            <div class="form-group">
                <label>Port:</label>
                <select id="port">
                    <option value="">Select port...</option>
                </select>
            </div>
            <div class="form-group">
                <label>Baud Rate:</label>
                <select id="baud">
                    <option value="115200">115200</option>
                    <option value="460800">460800</option>
                    <option value="921600" selected>921600</option>
                </select>
            </div>
            <div class="button-group">
                <button id="refreshPorts">Refresh Ports</button>
                <button id="connectBtn" class="primary">Connect</button>
            </div>
        </div>
        
        <div class="section" id="chipSection" style="display: none;">
            <div class="section-title">Chip Information</div>
            <div class="chip-info" id="chipInfo"></div>
        </div>
        
        <div class="section" id="flashSection" style="display: none;">
            <div class="section-title">Flash</div>
            <div class="form-group">
                <label>Flash Options:</label>
                <div style="display: flex; gap: 16px; margin-top: 8px;">
                    <label style="display: flex; align-items: center; margin: 0;">
                        <input type="checkbox" id="eraseAll" checked style="width: auto; margin-right: 8px;">
                        Erase all before flash
                    </label>
                    <label style="display: flex; align-items: center; margin: 0;">
                        <input type="checkbox" id="verify" checked style="width: auto; margin-right: 8px;">
                        Verify after flash
                    </label>
                </div>
            </div>
            <div class="button-group">
                <button id="flashBtn" class="primary">Flash Firmware</button>
                <button id="resetBtn">Reset Device</button>
            </div>
        </div>
        
        <div class="progress-container" id="progressSection" style="display: none;">
            <div class="status">
                <span id="statusText">Ready</span>
                <span id="progressText">0%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
        </div>
        
        <div class="log" id="log"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let port = null;
        let loader = null;
        let isConnected = false;
        let firmwareData = null;
        
        const logEl = document.getElementById('log');
        const statusEl = document.getElementById('statusText');
        const progressTextEl = document.getElementById('progressText');
        const progressFillEl = document.getElementById('progressFill');
        const portSelect = document.getElementById('port');
        const connectBtn = document.getElementById('connectBtn');
        const flashBtn = document.getElementById('flashBtn');
        const resetBtn = document.getElementById('resetBtn');
        const chipSection = document.getElementById('chipSection');
        const flashSection = document.getElementById('flashSection');
        const progressSection = document.getElementById('progressSection');
        
        // Terminal interface for esptool-js
        const terminal = {
            clean: () => { logEl.innerHTML = ''; },
            clear: () => { logEl.innerHTML = ''; },
            writeLine: (data) => { log(data + '\n'); },
            writeln: (data) => { log(data + '\n'); },
            write: (data) => { log(data); },
            columns: 80
        };
        
        function log(msg) {
            logEl.innerHTML += msg;
            logEl.scrollTop = logEl.scrollHeight;
        }
        
        function updateStatus(text, progress = 0) {
            statusEl.textContent = text;
            progressTextEl.textContent = progress + '%';
            progressFillEl.style.width = progress + '%';
            progressSection.style.display = 'block';
        }
        
        async function refreshPorts() {
            portSelect.innerHTML = '<option value="">Select port...</option>';
            
            if (!navigator.serial) {
                log('Error: WebSerial not supported\n');
                return;
            }
            
            const ports = await navigator.serial.getPorts();
            ports.forEach(port => {
                const option = document.createElement('option');
                option.value = ports.indexOf(port);
                option.textContent = 'Serial Port ' + (ports.indexOf(port) + 1);
                portSelect.appendChild(option);
            });
            
            log('Found ' + ports.length + ' serial port(s)\n');
        }
        
        async function connect() {
            if (isConnected) {
                await disconnect();
                return;
            }
            
            const baud = parseInt(document.getElementById('baud').value);
            const initialBaud = 115200;
            
            try {
                updateStatus('Requesting port...', 0);
                
                if (!navigator.serial) {
                    throw new Error('WebSerial not supported');
                }
                
                port = await navigator.serial.requestPort();
                
                updateStatus('Connecting...', 10);
                log('Connecting at ' + initialBaud + ' baud...\n');
                
                // Load esptool-js from CDN
                if (typeof ESPLoader === 'undefined') {
                    await loadEsptoolJS();
                }
                
                // Create transport
                const transport = new Transport(port);
                
                // Create loader with initial baud rate
                loader = new ESPLoader(transport, initialBaud, terminal);
                
                updateStatus('Connecting to chip...', 20);
                await loader.connect();
                
                updateStatus('Syncing...', 30);
                await loader.sync();
                
                // Switch to high baud rate
                if (baud !== initialBaud) {
                    updateStatus('Changing baud rate...', 35);
                    log('Switching to ' + baud + ' baud...\n');
                    await loader.changeBaudRate(baud);
                }
                
                updateStatus('Detecting chip...', 40);
                await loader.detectChip();
                
                isConnected = true;
                connectBtn.textContent = 'Disconnect';
                
                // Show chip info
                showChipInfo(loader);
                chipSection.style.display = 'block';
                flashSection.style.display = 'block';
                
                // Request firmware data
                vscode.postMessage({ command: 'requestFirmware' });
                
                log('Connected successfully!\n');
                updateStatus('Ready', 100);
                
            } catch (e) {
                log('Error: ' + e.message + '\n');
                updateStatus('Error: ' + e.message, 0);
                await disconnect();
            }
        }
        
        async function disconnect() {
            if (loader) {
                try {
                    await loader.hardReset();
                } catch (e) {}
                loader = null;
            }
            
            if (port) {
                try {
                    if (port.readable && loader && loader.transport && loader.transport.reader) {
                        await loader.transport.reader.cancel();
                        loader.transport.reader.releaseLock();
                    }
                } catch (e) {}
                try {
                    if (port.writable && loader && loader.transport && loader.transport.writer) {
                        await loader.transport.writer.close();
                    }
                } catch (e) {}
                try {
                    await port.close();
                } catch (e) {}
                port = null;
            }
            
            isConnected = false;
            connectBtn.textContent = 'Connect';
            chipSection.style.display = 'none';
            flashSection.style.display = 'none';
            progressSection.style.display = 'none';
        }
        
        function showChipInfo(loader) {
            const chipName = loader.chipName || loader.CHIP_NAME || 'Unknown';
            const features = loader.chipFeatures || [];
            const crystalFreq = loader.crystalFreq || 40;
            const macAddr = loader.macAddr || 'Unknown';
            
            const chipInfo = document.getElementById('chipInfo');
            chipInfo.innerHTML = \`
                <div class="chip-info-row">
                    <span class="chip-info-label">Chip:</span>
                    <span class="chip-info-value">\${chipName}</span>
                </div>
                <div class="chip-info-row">
                    <span class="chip-info-label">Features:</span>
                    <span class="chip-info-value">\${features.join(', ')}</span>
                </div>
                <div class="chip-info-row">
                    <span class="chip-info-label">Crystal:</span>
                    <span class="chip-info-value">\${crystalFreq} MHz</span>
                </div>
                <div class="chip-info-row">
                    <span class="chip-info-label">MAC:</span>
                    <span class="chip-info-value">\${macAddr}</span>
                </div>
            \`;
        }
        
        async function flash() {
            if (!isConnected || !loader || !firmwareData) {
                log('Error: Not connected or no firmware\n');
                return;
            }
            
            const eraseAll = document.getElementById('eraseAll').checked;
            const verify = document.getElementById('verify').checked;
            
            flashBtn.disabled = true;
            resetBtn.disabled = true;
            
            try {
                updateStatus('Preparing flash...', 0);
                log('Starting flash...\n');
                
                // Build ROM image
                const image = await loader.buildImage(firmwareData, 0x10000);
                
                updateStatus('Writing flash...', 10);
                
                const fileArray = [{
                    data: image,
                    address: 0x10000
                }];
                
                await loader.writeFlash({
                    fileArray: fileArray,
                    flashSize: '4MB',
                    eraseAll: eraseAll,
                    compress: true,
                    reportProgress: (fileIndex, written, total) => {
                        const progress = Math.floor((written / total) * 90) + 10;
                        updateStatus('Writing flash...', progress);
                        log('Writing: ' + written + ' / ' + total + ' bytes (' + progress + '%)\n');
                    }
                });
                
                if (verify) {
                    updateStatus('Verifying...', 95);
                    log('Verifying flash...\n');
                    await loader.verifyFlash({
                        fileArray: fileArray,
                        reportProgress: (fileIndex, written, total) => {
                            updateStatus('Verifying...', 95 + Math.floor((written / total) * 5));
                        }
                    });
                }
                
                updateStatus('Resetting...', 98);
                await loader.hardReset();
                
                updateStatus('Complete!', 100);
                log('Flash complete!\n');
                
                vscode.postMessage({
                    command: 'flashComplete',
                    message: 'Firmware flashed successfully!'
                });
                
            } catch (e) {
                log('Error: ' + e.message + '\n');
                updateStatus('Error', 0);
                vscode.postMessage({
                    command: 'flashError',
                    error: e.message
                });
            }
            
            flashBtn.disabled = false;
            resetBtn.disabled = false;
        }
        
        async function resetDevice() {
            if (!loader) return;
            try {
                await loader.hardReset();
                log('Device reset\n');
            } catch (e) {
                log('Error: ' + e.message + '\n');
            }
        }
        
        async function loadEsptoolJS() {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/esptool-js@0.4.0/dist/esptool.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        // WebSerial Transport implementation
        class Transport {
            constructor(port) {
                this.port = port;
                this.reader = null;
                this.writer = null;
            }
            
            async setBaudrate(baud) {
                // Reopen port with new baud rate
                if (this.port) {
                    try {
                        if (this.reader) {
                            await this.reader.cancel();
                            this.reader.releaseLock();
                            this.reader = null;
                        }
                        if (this.writer) {
                            await this.writer.close();
                            this.writer = null;
                        }
                        await this.port.close();
                        await this.port.open({ baudRate: baud });
                    } catch (e) {
                        console.error('Failed to change baud rate:', e);
                    }
                }
            }
            
            async read() {
                if (!this.reader) {
                    this.reader = this.port.readable.getReader();
                }
                const { value, done } = await this.reader.read();
                if (done) {
                    this.reader.releaseLock();
                    this.reader = null;
                    return null;
                }
                return value;
            }
            
            async write(data) {
                if (!this.writer) {
                    this.writer = this.port.writable.getWriter();
                }
                await this.writer.write(data);
            }
            
            async flush() {
                // Flush writer
                if (this.writer) {
                    await this.writer.ready;
                }
            }
            
            async disconnect() {
                if (this.reader) {
                    try {
                        await this.reader.cancel();
                    } catch (e) {}
                    this.reader.releaseLock();
                    this.reader = null;
                }
                if (this.writer) {
                    try {
                        await this.writer.close();
                    } catch (e) {}
                    this.writer = null;
                }
            }
        }
        
        // Event listeners
        document.getElementById('refreshPorts').addEventListener('click', refreshPorts);
        connectBtn.addEventListener('click', connect);
        flashBtn.addEventListener('click', flash);
        resetBtn.addEventListener('click', resetDevice);
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'firmwareData') {
                firmwareData = new Uint8Array(message.data);
                log('Firmware loaded: ' + message.path + ' (' + firmwareData.length + ' bytes)\n');
            }
        });
        
        // Initialize
        refreshPorts();
    </script>
</body>
</html>`;
    }
}
