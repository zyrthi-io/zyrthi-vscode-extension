import * as assert from 'assert';

// 独立测试 Plotter 解析逻辑（不依赖 VS Code）
class PlotterParser {
    private series: Map<string, number[]> = new Map();
    private maxPoints: number;

    constructor(maxPoints: number = 100) {
        this.maxPoints = maxPoints;
    }

    parseLine(line: string): { name: string; value: number }[] | null {
        line = line.trim();
        if (!line) return null;

        const points: { name: string; value: number }[] = [];

        if (line.includes(':')) {
            const parts = line.split(',');
            for (const part of parts) {
                const trimmed = part.trim();
                const colonIdx = trimmed.indexOf(':');
                if (colonIdx > 0) {
                    const name = trimmed.substring(0, colonIdx).trim();
                    const valueStr = trimmed.substring(colonIdx + 1).trim();
                    const value = parseFloat(valueStr);
                    if (!isNaN(value)) {
                        points.push({ name, value });
                    }
                }
            }
        } else {
            const value = parseFloat(line);
            if (!isNaN(value)) {
                points.push({ name: 'value', value });
            }
        }

        return points.length > 0 ? points : null;
    }

    update(points: { name: string; value: number }[]): void {
        for (const point of points) {
            if (!this.series.has(point.name)) {
                this.series.set(point.name, []);
            }
            const values = this.series.get(point.name)!;
            values.push(point.value);
            if (values.length > this.maxPoints) {
                values.shift();
            }
        }
    }

    getSeries(): Map<string, number[]> {
        return this.series;
    }

    clear(): void {
        this.series.clear();
    }
}

suite('Plotter Parser Test Suite', () => {
    let parser: PlotterParser;

    setup(() => {
        parser = new PlotterParser(10);
    });

    test('parseLine should parse single value', () => {
        const result = parser.parseLine('123.45');
        assert.ok(result);
        assert.strictEqual(result!.length, 1);
        assert.strictEqual(result![0].name, 'value');
        assert.strictEqual(result![0].value, 123.45);
    });

    test('parseLine should parse name:value pair', () => {
        const result = parser.parseLine('temp:28.5');
        assert.ok(result);
        assert.strictEqual(result!.length, 1);
        assert.strictEqual(result![0].name, 'temp');
        assert.strictEqual(result![0].value, 28.5);
    });

    test('parseLine should parse multiple pairs', () => {
        const result = parser.parseLine('temp:28.5,hum:65.2');
        assert.ok(result);
        assert.strictEqual(result!.length, 2);
        assert.strictEqual(result![0].name, 'temp');
        assert.strictEqual(result![0].value, 28.5);
        assert.strictEqual(result![1].name, 'hum');
        assert.strictEqual(result![1].value, 65.2);
    });

    test('parseLine should handle spaces', () => {
        const result = parser.parseLine('temp: 28.5, hum: 65.2');
        assert.ok(result);
        assert.strictEqual(result!.length, 2);
        assert.strictEqual(result![0].name, 'temp');
        assert.strictEqual(result![1].name, 'hum');
    });

    test('parseLine should return null for invalid input', () => {
        assert.strictEqual(parser.parseLine(''), null);
        assert.strictEqual(parser.parseLine('   '), null);
        assert.strictEqual(parser.parseLine('hello world'), null);
        assert.strictEqual(parser.parseLine('name:invalid'), null);
    });

    test('parseLine should handle negative values', () => {
        const result = parser.parseLine('x:-10.5');
        assert.ok(result);
        assert.strictEqual(result![0].value, -10.5);
    });

    test('parseLine should handle scientific notation', () => {
        const result = parser.parseLine('value:1.23e-4');
        assert.ok(result);
        assert.ok(Math.abs(result![0].value - 0.000123) < 0.000001);
    });

    test('update should store values', () => {
        const points = parser.parseLine('temp:25.0,hum:50.0');
        parser.update(points!);

        const series = parser.getSeries();
        assert.ok(series.has('temp'));
        assert.ok(series.has('hum'));
        assert.deepStrictEqual(series.get('temp'), [25.0]);
        assert.deepStrictEqual(series.get('hum'), [50.0]);
    });

    test('update should limit max points', () => {
        for (let i = 0; i < 15; i++) {
            const points = parser.parseLine(`value:${i}`);
            parser.update(points!);
        }

        const series = parser.getSeries();
        assert.strictEqual(series.get('value')!.length, 10);
        // Should keep last 10 values (5-14)
        assert.strictEqual(series.get('value')![0], 5);
        assert.strictEqual(series.get('value')![9], 14);
    });

    test('clear should reset series', () => {
        const points = parser.parseLine('temp:25.0');
        parser.update(points!);
        parser.clear();

        const series = parser.getSeries();
        assert.strictEqual(series.size, 0);
    });

    test('should handle Arduino format (Label: Value)', () => {
        const result = parser.parseLine('Temperature: 28.5');
        assert.ok(result);
        assert.strictEqual(result![0].name, 'Temperature');
        assert.strictEqual(result![0].value, 28.5);
    });

    test('should handle mixed formats', () => {
        const result = parser.parseLine('Sensor1: 28.5, Sensor2:30.2');
        assert.ok(result);
        assert.strictEqual(result!.length, 2);
    });
});
