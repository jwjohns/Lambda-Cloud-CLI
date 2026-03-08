import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI = `node ${resolve(__dirname, '../dist/index.js')}`;

function run(args: string): string {
    try {
        return execSync(`${CLI} ${args}`, { encoding: 'utf8', timeout: 10000 });
    } catch (e: any) {
        return e.stdout || e.stderr || e.message;
    }
}

describe('CLI Commands', () => {
    describe('--help', () => {
        it('should show help text', () => {
            const output = run('--help');
            expect(output).toContain('Lambda Cloud CLI');
            expect(output).toContain('types');
            expect(output).toContain('instances');
            expect(output).toContain('launch');
            expect(output).toContain('terminate');
            expect(output).toContain('poll');
            expect(output).toContain('ssh');
            expect(output).toContain('push');
            expect(output).toContain('pull');
            expect(output).toContain('setup');
            expect(output).toContain('config');
            expect(output).toContain('mcp');
        });
    });

    describe('--version', () => {
        it('should show version 0.2.0', () => {
            const output = run('--version').trim();
            expect(output).toBe('0.2.0');
        });
    });

    describe('config show', () => {
        it('should display configuration', () => {
            const output = run('config show');
            expect(output).toContain('Lambda CLI Configuration');
            expect(output).toContain('apiKey');
            expect(output).toContain('defaultSshKey');
            expect(output).toContain('defaultRegion');
        });

        it('should mask the API key', () => {
            const output = run('config show');
            expect(output).toContain('...');
            expect(output).not.toContain('secret_dasm_b302');
        });
    });

    describe('types', () => {
        it('should list instance types', () => {
            const output = run('types');
            expect(output).toContain('Instance Types');
            expect(output).toContain('TYPE');
            expect(output).toContain('PRICE');
        });

        it('should filter by name', () => {
            const output = run('types gh200');
            expect(output).toContain('gh200');
            expect(output).toContain('filter: gh200');
        });
    });

    describe('instances', () => {
        it('should list instances (or show empty)', () => {
            const output = run('instances');
            expect(output).toContain('Instances');
        });
    });

    describe('mcp --help', () => {
        it('should show MCP help', () => {
            const output = run('mcp --help');
            expect(output).toContain('MCP server');
            expect(output).toContain('stdio');
        });
    });

    describe('unknown commands', () => {
        it('should show error for unknown command', () => {
            const output = run('nonexistent');
            expect(output).toContain('unknown command');
        });
    });
});
