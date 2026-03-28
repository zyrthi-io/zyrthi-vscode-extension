import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

interface PlatformConfig {
    name: string;
    chips: string[];
    image: string;
    toolchain: string;
}

const PLATFORMS: Record<string, PlatformConfig> = {
    'esp32': {
        name: 'ESP32',
        chips: ['esp32', 'esp32s2', 'esp32s3', 'esp32c3', 'esp32c6', 'esp32h2'],
        image: 'ghcr.io/zyrthi-io/build-esp32:latest',
        toolchain: 'riscv32-esp-elf'
    },
    'stm32': {
        name: 'STM32',
        chips: ['stm32f103', 'stm32f407', 'stm32h743', 'stm32g0'],
        image: 'ghcr.io/zyrthi-io/build-stm32:latest',
        toolchain: 'arm-none-eabi'
    }
};

interface ProjectConfig {
    platform?: string;
    chip?: string;
    build?: {
        dir?: string;
    };
    monitor?: {
        baud?: number;
    };
}

export class PlatformManager {
    private context: vscode.ExtensionContext;
    private config: ProjectConfig = {};
    private workspaceRoot?: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async loadConfig(workspaceRoot: string): Promise<void> {
        this.workspaceRoot = workspaceRoot;
        const configPath = path.join(workspaceRoot, 'zyrthi.yaml');

        try {
            const content = await fs.promises.readFile(configPath, 'utf-8');
            this.config = YAML.parse(content) || {};
        } catch {
            this.config = {};
        }
    }

    getAvailablePlatforms(): string[] {
        return Object.keys(PLATFORMS);
    }

    getAvailableChips(): string[] {
        const platform = this.config.platform || 'esp32';
        return PLATFORMS[platform]?.chips || [];
    }

    getCurrentPlatform(): string {
        return this.config.platform || 'esp32';
    }

    getCurrentChip(): string {
        return this.config.chip || 'esp32';
    }

    async setPlatform(platform: string): Promise<void> {
        this.config.platform = platform;
        await this.saveConfig();
    }

    async setChip(chip: string): Promise<void> {
        this.config.chip = chip;
        await this.saveConfig();
    }

    private async saveConfig(): Promise<void> {
        if (!this.workspaceRoot) {
            return;
        }

        const configPath = path.join(this.workspaceRoot, 'zyrthi.yaml');
        const content = YAML.stringify(this.config);

        await fs.promises.writeFile(configPath, content, 'utf-8');
    }

    getBuildPath(workspaceRoot: string): string {
        return path.join(workspaceRoot, this.config.build?.dir || 'build');
    }

    getMonitorBaud(): number {
        return this.config.monitor?.baud || 115200;
    }

    getPlatformImage(platform: string): string {
        return PLATFORMS[platform]?.image || PLATFORMS['esp32'].image;
    }

    getToolchain(platform: string): string {
        return PLATFORMS[platform]?.toolchain || 'riscv32-esp-elf';
    }
}