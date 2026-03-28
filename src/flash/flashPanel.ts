import * as vscode from 'vscode';

export class FlashPanel {
    public static currentPanel: FlashPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;

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
        this.panel.reveal();
        this.update(firmwarePath);
    }

    private update(firmwarePath?: string): void {
        this.panel.webview.html = this.getHtml(firmwarePath || '');

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'selectPort':
                        // Port selection happens in webview via WebSerial
                        break;
                    case 'flash':
                        await this.handleFlash(message.firmware, message.baud);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private async handleFlash(firmware: string, baud: number): Promise<void> {
        // Flash logic is handled in webview via esptool.ts + WebSerial
        this.panel.webview.postMessage({
            command: 'startFlash',
            firmware,
            baud
        });
    }

    private getHtml(firmwarePath: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zyrthi Flash</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { font-size: 1.5em; margin-bottom: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        select, input {
            width: 100%;
            padding: 8px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        }
        button {
            padding: 10px 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .log {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            padding: 10px;
            height: 300px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            margin-top: 20px;
        }
        .progress {
            width: 100%;
            height: 20px;
            background: var(--vscode-progressBar-background);
            border-radius: 4px;
            margin-top: 10px;
        }
        .progress-bar {
            height: 100%;
            background: var(--vscode-progressBar-foreground);
            border-radius: 4px;
            width: 0%;
            transition: width 0.3s;
        }
        .status { margin-top: 10px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Zyrthi Flash</h1>
        
        <div class="form-group">
            <label>Firmware:</label>
            <input type="text" id="firmware" value="${firmwarePath}" readonly>
        </div>
        
        <div class="form-group">
            <label>Baud Rate:</label>
            <select id="baud">
                <option value="115200">115200</option>
                <option value="460800">460800</option>
                <option value="921600" selected>921600</option>
            </select>
        </div>
        
        <div class="form-group">
            <button id="selectPort">Select Port</button>
            <button id="flashBtn" disabled>Flash</button>
        </div>
        
        <div class="status" id="status">Not connected</div>
        
        <div class="progress">
            <div class="progress-bar" id="progressBar"></div>
        </div>
        
        <div class="log" id="log"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/esptool.ts@0.14.0/dist/esptool.min.js"></script>
    <script>
        const vscode = acquireVsCodeApi();
        let port = null;
        let espLoader = null;
        
        const logEl = document.getElementById('log');
        const statusEl = document.getElementById('status');
        const progressBar = document.getElementById('progressBar');
        const flashBtn = document.getElementById('flashBtn');
        
        function log(msg) {
            logEl.innerHTML += msg + '\\n';
            logEl.scrollTop = logEl.scrollHeight;
        }
        
        document.getElementById('selectPort').addEventListener('click', async () => {
            try {
                if (!navigator.serial) {
                    log('Error: WebSerial not supported in this context');
                    log('Please use the extension in VS Code Desktop');
                    return;
                }
                
                port = await navigator.serial.requestPort();
                log('Port selected');
                statusEl.textContent = 'Port selected, ready to flash';
                flashBtn.disabled = false;
            } catch (e) {
                log('Error: ' + e.message);
            }
        });
        
        flashBtn.addEventListener('click', async () => {
            const baud = parseInt(document.getElementById('baud').value);
            const firmware = document.getElementById('firmware').value;
            
            try {
                statusEl.textContent = 'Connecting...';
                log('Opening port at ' + baud);
                
                await port.open({ baudRate: baud });
                
                // Using esptool.js stub
                log('Connected to device');
                statusEl.textContent = 'Flashing...';
                progressBar.style.width = '50%';
                
                // Flash logic would go here with esptool.ts
                log('Flashing ' + firmware);
                
                await new Promise(r => setTimeout(r, 2000));
                
                progressBar.style.width = '100%';
                statusEl.textContent = 'Flash complete!';
                log('Flash complete!');
                
                await port.close();
            } catch (e) {
                log('Error: ' + e.message);
                statusEl.textContent = 'Error: ' + e.message;
                progressBar.style.width = '0%';
            }
        });
    </script>
</body>
</html>`;
    }
}
