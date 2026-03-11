import * as assert from 'assert';

// 独立测试配置解析逻辑
interface ZyrthiConfig {
    platform: string;
    chip: string;
    compiler?: {
        prefix?: string;
        cflags?: string[];
    };
    monitor?: {
        baud?: number;
        port?: string;
    };
    flash?: {
        port?: string;
        baud?: number;
    };
}

class ConfigParser {
    static parseYaml(content: string): ZyrthiConfig | null {
        try {
            // 简单 YAML 解析（实际项目使用 yaml 库）
            const lines = content.split('\n');
            const config: any = {};
            let currentKey = '';
            let currentSection: any = null;
            let sectionDepth = 0;

            for (const line of lines) {
                if (line.trim().startsWith('#') || line.trim() === '') continue;

                const depth = line.search(/\S/);
                const trimmed = line.trim();

                if (trimmed.includes(':')) {
                    const [key, value] = trimmed.split(':').map(s => s.trim());
                    
                    if (depth === 0) {
                        // 顶层键
                        if (value === '' || value === undefined) {
                            config[key] = {};
                            currentSection = config[key];
                            sectionDepth = 2;
                        } else {
                            // 解析值
                            config[key] = this.parseValue(value);
                        }
                    } else if (depth >= sectionDepth && currentSection) {
                        // 子键
                        if (value === '' || value === undefined) {
                            currentSection[key] = {};
                            currentSection = currentSection[key];
                            sectionDepth = depth + 2;
                        } else {
                            currentSection[key] = this.parseValue(value);
                        }
                    }
                }
            }

            return config as ZyrthiConfig;
        } catch {
            return null;
        }
    }

    private static parseValue(value: string): any {
        // 数字
        if (/^\d+$/.test(value)) return parseInt(value);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        // 布尔
        if (value === 'true') return true;
        if (value === 'false') return false;
        // 数组
        if (value.startsWith('[') && value.endsWith(']')) {
            return value.slice(1, -1).split(',').map(s => s.trim().replace(/['"]/g, ''));
        }
        // 字符串（去除引号）
        return value.replace(/^['"]|['"]$/g, '');
    }

    static validate(config: ZyrthiConfig): string[] {
        const errors: string[] = [];
        
        if (!config.platform) {
            errors.push('Missing required field: platform');
        }
        if (!config.chip) {
            errors.push('Missing required field: chip');
        }
        
        const validPlatforms = ['esp32', 'stm32', 'arduino'];
        if (config.platform && !validPlatforms.includes(config.platform)) {
            errors.push(`Invalid platform: ${config.platform}`);
        }

        if (config.monitor?.baud && config.monitor.baud < 300) {
            errors.push('Monitor baud rate too low (min 300)');
        }

        return errors;
    }

    static getDefaultConfig(platform: string, chip: string): ZyrthiConfig {
        const defaults: Record<string, Partial<ZyrthiConfig>> = {
            esp32: {
                compiler: { prefix: 'xtensa-esp32-elf-', cflags: ['-mlongcalls', '-Os'] },
                monitor: { baud: 115200 },
                flash: { baud: 921600 }
            },
            stm32: {
                compiler: { prefix: 'arm-none-eabi-', cflags: ['-mcpu=cortex-m4', '-Os'] },
                monitor: { baud: 115200 }
            }
        };

        return {
            platform,
            chip,
            ...defaults[platform]
        };
    }
}

suite('Config Parser Test Suite', () => {
    test('parseYaml should parse simple config', () => {
        const yaml = `
platform: esp32
chip: esp32s3
`;
        const config = ConfigParser.parseYaml(yaml);
        assert.ok(config);
        assert.strictEqual(config!.platform, 'esp32');
        assert.strictEqual(config!.chip, 'esp32s3');
    });

    test('parseYaml should parse nested config', () => {
        const yaml = `
platform: esp32
chip: esp32s3
monitor:
  baud: 115200
  port: /dev/ttyUSB0
`;
        const config = ConfigParser.parseYaml(yaml);
        assert.ok(config);
        assert.strictEqual(config!.platform, 'esp32');
    });

    test('parseYaml should handle empty content', () => {
        const config = ConfigParser.parseYaml('');
        // 空内容返回空对象或 null
        assert.ok(config === null || Object.keys(config || {}).length === 0);
    });

    test('parseYaml should skip comments', () => {
        const yaml = `
# This is a comment
platform: esp32
chip: esp32s3
`;
        const config = ConfigParser.parseYaml(yaml);
        assert.ok(config);
        assert.strictEqual(config!.platform, 'esp32');
    });

    test('validate should detect missing platform', () => {
        const errors = ConfigParser.validate({ platform: '', chip: 'esp32s3' });
        assert.ok(errors.some(e => e.includes('platform')));
    });

    test('validate should detect missing chip', () => {
        const errors = ConfigParser.validate({ platform: 'esp32', chip: '' });
        assert.ok(errors.some(e => e.includes('chip')));
    });

    test('validate should detect invalid platform', () => {
        const errors = ConfigParser.validate({ platform: 'invalid', chip: 'test' });
        assert.ok(errors.some(e => e.includes('Invalid platform')));
    });

    test('validate should detect low baud rate', () => {
        const errors = ConfigParser.validate({ 
            platform: 'esp32', 
            chip: 'esp32s3',
            monitor: { baud: 100 }
        });
        assert.ok(errors.some(e => e.includes('baud rate too low')));
    });

    test('validate should return empty array for valid config', () => {
        const errors = ConfigParser.validate({ platform: 'esp32', chip: 'esp32s3' });
        assert.strictEqual(errors.length, 0);
    });

    test('getDefaultConfig should return esp32 defaults', () => {
        const config = ConfigParser.getDefaultConfig('esp32', 'esp32s3');
        assert.strictEqual(config.platform, 'esp32');
        assert.strictEqual(config.chip, 'esp32s3');
        assert.ok(config.compiler?.prefix?.includes('xtensa'));
        assert.strictEqual(config.monitor?.baud, 115200);
    });

    test('getDefaultConfig should return stm32 defaults', () => {
        const config = ConfigParser.getDefaultConfig('stm32', 'stm32f407');
        assert.strictEqual(config.platform, 'stm32');
        assert.ok(config.compiler?.prefix?.includes('arm'));
    });
});
