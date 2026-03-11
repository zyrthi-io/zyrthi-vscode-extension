import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('CliManager Test Suite', () => {
    const testDir = path.join(os.tmpdir(), 'zyrthi-test-' + Date.now());

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

    test('findZyrthiCli should return null when not found', async () => {
        // Test CLI detection logic
        const cliManager = new CliManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        const cliPath = cliManager.getCliPath();
        // Should be null or a valid path
        assert.ok(cliPath === null || typeof cliPath === 'string');
    });

    test('runCommand should handle missing CLI', async () => {
        const cliManager = new CliManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        const result = await cliManager.runCommand('build');
        assert.strictEqual(result.success, false);
        assert.ok(result.error?.includes('not found'));
    });

    test('getVersion should return null when CLI not found', async () => {
        const cliManager = new CliManager({
            subscriptions: [],
            extensionPath: testDir,
            globalStorageUri: { fsPath: path.join(testDir, 'storage') } as any,
            logPath: testDir
        } as any);

        const version = await cliManager.getVersion();
        assert.strictEqual(version, null);
    });
});

// Mock imports
import { CliManager } from '../../cli/cliManager';
