import * as vscode from 'vscode';
import { ZyrthiExtension } from './core/extension';

let zyrthi: ZyrthiExtension;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Zyrthi extension is activating...');
    
    zyrthi = new ZyrthiExtension(context);
    await zyrthi.activate();
    
    console.log('Zyrthi extension activated');
}

export async function deactivate() {
    if (zyrthi) {
        await zyrthi.deactivate();
    }
}
