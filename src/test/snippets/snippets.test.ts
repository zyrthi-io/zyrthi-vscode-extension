import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

suite('Snippets Test Suite', () => {
    const snippetsPath = path.resolve(__dirname, '../../../syntaxes/snippets.json');

    test('snippets file should exist', () => {
        assert.ok(fs.existsSync(snippetsPath), 'snippets.json should exist');
    });

    test('snippets should be valid JSON', () => {
        const content = fs.readFileSync(snippetsPath, 'utf-8');
        let snippets: any;
        assert.doesNotThrow(() => {
            snippets = JSON.parse(content);
        }, 'snippets.json should be valid JSON');
        assert.ok(typeof snippets === 'object');
    });

    test('snippets should have required fields', () => {
        const content = fs.readFileSync(snippetsPath, 'utf-8');
        const snippets = JSON.parse(content);

        for (const [name, snippet] of Object.entries(snippets)) {
            const s = snippet as any;
            assert.ok(s.prefix, `Snippet ${name} should have prefix`);
            assert.ok(s.body, `Snippet ${name} should have body`);
            assert.ok(Array.isArray(s.body) || typeof s.body === 'string', 
                `Snippet ${name} body should be array or string`);
        }
    });

    test('snippets should have zyrthi template', () => {
        const content = fs.readFileSync(snippetsPath, 'utf-8');
        const snippets = JSON.parse(content);

        assert.ok(snippets['Zyrthi Setup/Loop'], 'Should have Zyrthi Setup/Loop snippet');
        const setupLoop = snippets['Zyrthi Setup/Loop'];
        assert.ok(setupLoop.prefix.includes('zyrthi'));
        assert.ok(setupLoop.body.some((line: string) => line.includes('setup')));
        assert.ok(setupLoop.body.some((line: string) => line.includes('loop')));
    });

    test('snippets should have GPIO snippets', () => {
        const content = fs.readFileSync(snippetsPath, 'utf-8');
        const snippets = JSON.parse(content);

        assert.ok(snippets['GPIO Mode'], 'Should have GPIO Mode snippet');
        assert.ok(snippets['GPIO Write'], 'Should have GPIO Write snippet');
        assert.ok(snippets['GPIO Read'], 'Should have GPIO Read snippet');
    });

    test('snippets should have UART snippets', () => {
        const content = fs.readFileSync(snippetsPath, 'utf-8');
        const snippets = JSON.parse(content);

        assert.ok(snippets['UART Init'], 'Should have UART Init snippet');
        assert.ok(snippets['UART Write'], 'Should have UART Write snippet');
    });

    test('snippet body should use valid placeholders', () => {
        const content = fs.readFileSync(snippetsPath, 'utf-8');
        const snippets = JSON.parse(content);

        for (const [name, snippet] of Object.entries(snippets)) {
            const s = snippet as any;
            const body = Array.isArray(s.body) ? s.body.join('\n') : s.body;
            
            // Check for valid placeholder format: $1, ${1}, ${1:default}
            const placeholders = body.match(/\$\{?\d+:?[^}]*\}?/g) || [];
            for (const p of placeholders) {
                assert.ok(/^\$\{?\d+/.test(p), 
                    `Snippet ${name} has invalid placeholder: ${p}`);
            }
        }
    });
});
