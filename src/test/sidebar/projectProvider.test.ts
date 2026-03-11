import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

suite('ProjectProvider Test Suite', () => {
    const testDir = path.join(os.tmpdir(), 'zyrthi-project-test-' + Date.now());

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

    test('getChildren should return project structure', async () => {
        const provider = new ProjectProvider(
            { subscriptions: [], extensionPath: testDir } as any,
            {} as any
        );

        const children = await provider.getChildren();
        assert.ok(Array.isArray(children));
    });

    test('getTreeItem should return TreeItem with label', async () => {
        const provider = new ProjectProvider(
            { subscriptions: [], extensionPath: testDir } as any,
            {} as any
        );

        const children = await provider.getChildren();
        if (children.length > 0) {
            const treeItem = provider.getTreeItem(children[0]);
            assert.ok(treeItem.label);
        }
    });

    test('refresh should trigger change event', (done) => {
        const provider = new ProjectProvider(
            { subscriptions: [], extensionPath: testDir } as any,
            {} as any
        );

        provider.onDidChangeTreeData(() => {
            done();
        });

        provider.refresh();
    });
});

import { ProjectProvider } from '../../sidebar/projectProvider';
