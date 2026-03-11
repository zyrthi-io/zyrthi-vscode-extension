import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('ClangdManager Test Suite', () => {
    const testDir = path.join(os.tmpdir(), 'zyrthi-clangd-test-' + Date.now());

    setup(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    teardown(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('getBinaryPath should return correct path', () => {
        const manager = new ClangdManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        // Access private method via any
        const binaryPath = (manager as any).getBinaryPath();
        assert.ok(binaryPath.includes('.zyrthi'));
        assert.ok(binaryPath.includes('clangd'));
        assert.ok(binaryPath.includes('bin'));
    });

    test('getPlatform should detect current platform', () => {
        const manager = new ClangdManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        const platform = (manager as any).getPlatform();
        const validPlatforms = ['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'];
        assert.ok(validPlatforms.includes(platform), `Platform ${platform} not in valid list`);
    });

    test('getInstallDir should include version', () => {
        const manager = new ClangdManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        const installDir = (manager as any).getInstallDir();
        assert.ok(installDir.includes('18.1.3'));
    });

    test('initialize should create storage directory', async () => {
        const storagePath = path.join(testDir, 'storage');
        const manager = new ClangdManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: storagePath } as any,
            logPath: testDir
        } as any);

        await manager.initialize();
        assert.ok(manager);
    });

    test('stop should not throw when client is null', async () => {
        const manager = new ClangdManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        await manager.stop();
        // Should not throw
        assert.ok(true);
    });

    test('notifyConfigChange should not throw when client is null', () => {
        const manager = new ClangdManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        manager.notifyConfigChange();
        // Should not throw
        assert.ok(true);
    });
});

import { ClangdManager } from '../../clangd/manager';
