import * as vscode from 'vscode';

export class MonitorPanel {
    public static currentPanel: MonitorPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly disposables: vscode.Disposable[] = [];
    private context: vscode.ExtensionContext;

    constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this.panel = panel;
        this.context = context;
        
        // Clean up when panel is closed
        this.panel.onDidDispose(() => {
            MonitorPanel.currentPanel = undefined;
            this.disposables.forEach(d => d.dispose());
            this.disposables.length = 0;
        }, null, this.disposables);
    }

    public static getInstance(context: vscode.ExtensionContext): MonitorPanel {
        if (!MonitorPanel.currentPanel) {
            const panel = vscode.window.createWebviewPanel(
                'zyrthiMonitor',
                'Zyrthi Monitor',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            MonitorPanel.currentPanel = new MonitorPanel(panel, context);
        }
        return MonitorPanel.currentPanel;
    }

    public async show(): Promise<void> {
        this.panel.reveal();
        this.update();
    }

    private update(): void {
        this.panel.webview.html = this.getHtml();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'openPort':
                        // Port selection happens in webview via WebSerial
                        break;
                    case 'sendData':
                        // Data sent to device
                        break;
                }
            },
            undefined,
            this.disposables
        );
    }

    private getHtml(): string {
        const config = vscode.workspace.getConfiguration('zyrthi');
        const baud = config.get<number>('monitor.baudRate', 115200);
        const showTimestamp = config.get<boolean>('monitor.showTimestamp', true);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zyrthi Monitor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        }
        select, input[type="text"] {
            padding: 8px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        }
        input[type="text"] { flex: 1; }
        button {
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .button-group { display: flex; gap: 5px; }
        .monitor {
            flex: 1;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            padding: 10px;
            overflow-y: auto;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .line { margin: 2px 0; }
        .timestamp { color: var(--vscode-descriptionForeground); margin-right: 8px; }
        .rx { color: var(--vscode-terminal-ansiGreen); }
        .tx { color: var(--vscode-terminal-ansiBlue); }
        .error { color: var(--vscode-errorForeground); }
        .status {
            padding: 5px 10px;
            background: var(--vscode-statusBar-background);
            border-radius: 4px;
            margin-bottom: 10px;
        }
        .status.connected { color: var(--vscode-terminal-ansiGreen); }
        .status.disconnected { color: var(--vscode-terminal-ansiRed); }
    </style>
</head>
<body>
    <div class="status" id="status">Disconnected</div>
    
    <div class="toolbar">
        <select id="baud">
            <option value="9600" ${baud === 9600 ? 'selected' : ''}>9600</option>
            <option value="19200" ${baud === 19200 ? 'selected' : ''}>19200</option>
            <option value="38400" ${baud === 38400 ? 'selected' : ''}>38400</option>
            <option value="57600" ${baud === 57600 ? 'selected' : ''}>57600</option>
            <option value="115200" ${baud === 115200 ? 'selected' : ''}>115200</option>
            <option value="230400" ${baud === 230400 ? 'selected' : ''}>230400</option>
            <option value="460800" ${baud === 460800 ? 'selected' : ''}>460800</option>
            <option value="921600" ${baud === 921600 ? 'selected' : ''}>921600</option>
        </select>
        
        <button id="openBtn">Open Port</button>
        <button id="closeBtn" disabled>Close Port</button>
        <button id="clearBtn">Clear</button>
        
        <div class="button-group">
            <button id="showTimestampBtn" ${showTimestamp ? 'disabled' : ''}>Show Timestamp</button>
            <button id="hideTimestampBtn" ${!showTimestamp ? 'disabled' : ''}>Hide Timestamp</button>
        </div>
    </div>
    
    <div class="toolbar">
        <input type="text" id="input" placeholder="Type to send (CRLF ending)">
        <button id="sendBtn">Send</button>
    </div>
    
    <div class="monitor" id="monitor"></div>

    <script>
        let port = null;
        let reader = null;
        let writer = null;
        let showTimestamp = ${showTimestamp};
        let keepReading = false;
        
        const monitor = document.getElementById('monitor');
        const status = document.getElementById('status');
        const openBtn = document.getElementById('openBtn');
        const closeBtn = document.getElementById('closeBtn');
        const clearBtn = document.getElementById('clearBtn');
        const sendBtn = document.getElementById('sendBtn');
        const input = document.getElementById('input');
        const baud = document.getElementById('baud');
        
        function log(msg, type = 'rx') {
            const line = document.createElement('div');
            line.className = 'line';
            
            if (showTimestamp) {
                const timestamp = document.createElement('span');
                timestamp.className = 'timestamp';
                timestamp.textContent = new Date().toLocaleTimeString();
                line.appendChild(timestamp);
            }
            
            const content = document.createElement('span');
            content.className = type;
            content.textContent = msg;
            line.appendChild(content);
            
            monitor.appendChild(line);
            monitor.scrollTop = monitor.scrollHeight;
        }
        
        openBtn.addEventListener('click', async () => {
            try {
                if (!navigator.serial) {
                    log('Error: WebSerial not supported', 'error');
                    return;
                }
                
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: parseInt(baud.value) });
                
                writer = port.writable.getWriter();
                reader = port.readable.getReader();
                
                keepReading = true;
                readLoop();
                
                status.textContent = 'Connected';
                status.className = 'status connected';
                openBtn.disabled = true;
                closeBtn.disabled = false;
                
                log('Port opened at ' + baud.value, 'rx');
            } catch (e) {
                log('Error: ' + e.message, 'error');
            }
        });
        
        closeBtn.addEventListener('click', async () => {
            keepReading = false;
            
            if (reader) {
                await reader.cancel();
                await reader.releaseLock();
            }
            if (writer) {
                await writer.releaseLock();
            }
            if (port) {
                await port.close();
            }
            
            status.textContent = 'Disconnected';
            status.className = 'status disconnected';
            openBtn.disabled = false;
            closeBtn.disabled = true;
            
            log('Port closed', 'rx');
        });
        
        async function readLoop() {
            while (keepReading) {
                try {
                    const { value, done } = await reader.read();
                    if (done) break;
                    
                    const text = new TextDecoder().decode(value);
                    log(text, 'rx');
                } catch (e) {
                    if (keepReading) {
                        log('Read error: ' + e.message, 'error');
                    }
                    break;
                }
            }
        }
        
        sendBtn.addEventListener('click', async () => {
            if (!writer || !port) {
                log('Error: Port not open', 'error');
                return;
            }
            
            const text = input.value + '\r\n';
            const data = new TextEncoder().encode(text);
            
            try {
                await writer.write(data);
                log(input.value, 'tx');
                input.value = '';
            } catch (e) {
                log('Send error: ' + e.message, 'error');
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendBtn.click();
            }
        });
        
        clearBtn.addEventListener('click', () => {
            monitor.innerHTML = '';
        });
        
        document.getElementById('showTimestampBtn').addEventListener('click', () => {
            showTimestamp = true;
            document.getElementById('showTimestampBtn').disabled = true;
            document.getElementById('hideTimestampBtn').disabled = false;
        });
        
        document.getElementById('hideTimestampBtn').addEventListener('click', () => {
            showTimestamp = false;
            document.getElementById('showTimestampBtn').disabled = false;
            document.getElementById('hideTimestampBtn').disabled = true;
        });
        
        log('Zyrthi Monitor ready. Click "Open Port" to connect.', 'rx');
    </script>
</body>
</html>`;
    }
}
