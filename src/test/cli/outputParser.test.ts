import * as assert from 'assert';

// 独立测试 CLI 输出解析逻辑
interface CommandResult {
    success: boolean;
    output: string;
    error?: string;
}

class BuildOutputParser {
    static parseMemoryUsage(output: string): { ram: number; flash: number; ramPercent: number; flashPercent: number } | null {
        // 解析编译输出中的内存使用信息
        const ramMatch = output.match(/RAM:\s*(\d+)\s*bytes?\s*\((\d+\.?\d*)%\)/i);
        const flashMatch = output.match(/Flash:\s*(\d+)\s*bytes?\s*\((\d+\.?\d*)%\)/i);
        
        if (ramMatch && flashMatch) {
            return {
                ram: parseInt(ramMatch[1]),
                ramPercent: parseFloat(ramMatch[2]),
                flash: parseInt(flashMatch[1]),
                flashPercent: parseFloat(flashMatch[2])
            };
        }
        return null;
    }

    static parseErrors(output: string): Array<{ file: string; line: number; column: number; message: string }> {
        const errors: Array<{ file: string; line: number; column: number; message: string }> = [];
        const regex = /^(.+):(\d+):(\d+):\s*(?:error|fatal error):\s*(.+)$/gm;
        
        let match;
        while ((match = regex.exec(output)) !== null) {
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                message: match[4]
            });
        }
        return errors;
    }

    static parseWarnings(output: string): Array<{ file: string; line: number; message: string }> {
        const warnings: Array<{ file: string; line: number; message: string }> = [];
        const regex = /^(.+):(\d+):\d+:\s*warning:\s*(.+)$/gm;
        
        let match;
        while ((match = regex.exec(output)) !== null) {
            warnings.push({
                file: match[1],
                line: parseInt(match[2]),
                message: match[3]
            });
        }
        return warnings;
    }

    static isSuccess(output: string): boolean {
        return output.includes('Build succeeded') || 
               output.includes('Build successful') ||
               output.includes('编译成功');
    }
}

suite('Build Output Parser Test Suite', () => {
    test('parseMemoryUsage should extract RAM and Flash', () => {
        const output = `
Compiling...
Linking...
RAM:  12345 bytes (2.4%)
Flash: 89234 bytes (1.1%)
Build succeeded
`;
        const result = BuildOutputParser.parseMemoryUsage(output);
        assert.ok(result);
        assert.strictEqual(result!.ram, 12345);
        assert.strictEqual(result!.ramPercent, 2.4);
        assert.strictEqual(result!.flash, 89234);
        assert.strictEqual(result!.flashPercent, 1.1);
    });

    test('parseMemoryUsage should return null for no memory info', () => {
        const output = 'No memory info here';
        const result = BuildOutputParser.parseMemoryUsage(output);
        assert.strictEqual(result, null);
    });

    test('parseErrors should extract compile errors', () => {
        const output = `
src/main.c:15:5: error: 'gpio_write' undeclared
src/main.c:20:1: fatal error: expected ';' before '}'
`;
        const errors = BuildOutputParser.parseErrors(output);
        assert.strictEqual(errors.length, 2);
        assert.strictEqual(errors[0].file, 'src/main.c');
        assert.strictEqual(errors[0].line, 15);
        assert.strictEqual(errors[0].column, 5);
        assert.strictEqual(errors[0].message, "'gpio_write' undeclared");
    });

    test('parseErrors should return empty array for no errors', () => {
        const output = 'Build succeeded';
        const errors = BuildOutputParser.parseErrors(output);
        assert.strictEqual(errors.length, 0);
    });

    test('parseWarnings should extract warnings', () => {
        const output = `
src/main.c:10:5: warning: unused variable 'x'
src/main.c:25:12: warning: implicit declaration of function 'foo'
`;
        const warnings = BuildOutputParser.parseWarnings(output);
        assert.strictEqual(warnings.length, 2);
        assert.strictEqual(warnings[0].file, 'src/main.c');
        assert.strictEqual(warnings[0].line, 10);
        assert.strictEqual(warnings[0].message, "unused variable 'x'");
    });

    test('parseWarnings should return empty array for no warnings', () => {
        const output = 'No warnings';
        const warnings = BuildOutputParser.parseWarnings(output);
        assert.strictEqual(warnings.length, 0);
    });

    test('isSuccess should detect success messages', () => {
        assert.ok(BuildOutputParser.isSuccess('Build succeeded'));
        assert.ok(BuildOutputParser.isSuccess('Build successful'));
        assert.ok(BuildOutputParser.isSuccess('编译成功'));
        assert.ok(!BuildOutputParser.isSuccess('Build failed'));
    });

    test('isSuccess should return false for failure', () => {
        assert.ok(!BuildOutputParser.isSuccess('Build failed'));
        assert.ok(!BuildOutputParser.isSuccess('error: compilation failed'));
    });
});
