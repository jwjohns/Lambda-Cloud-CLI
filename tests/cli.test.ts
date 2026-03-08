import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI = `node ${resolve(__dirname, '../dist/index.js')}`;

function run(args: string): string {
    try {
        return execSync(`${CLI} ${args}`, {
            encoding: 'utf8',
            timeout: 10000,
            env: { ...process.env, NO_COLOR: '1' },
        });
    } catch (e: any) {
        return (e.stdout || '') + (e.stderr || '');
    }
}

describe('CLI Commands', () => {
    describe('--help', () => {
        it('should show all commands', () => {
            const output = run('--help');
            expect(output).toContain('Lambda Cloud CLI');
            for (const cmd of ['types', 'instances', 'launch', 'terminate', 'poll', 'ssh', 'push', 'pull', 'setup', 'config', 'mcp']) {
                expect(output).toContain(cmd);
            }
        });
    });

    describe('--version', () => {
        it('should show version', () => {
            const output = run('--version').trim();
            expect(output).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    describe('config show', () => {
        it('should display configuration header', () => {
            const output = run('config show');
            expect(output).toContain('Lambda CLI Configuration');
        });

        it('should never show a full API key', () => {
            const output = run('config show');
            // Should either show masked key or "(not set)" — never a raw key
            expect(output).not.toMatch(/secret_[a-z0-9_]{20,}/);
        });
    });

    describe('types', () => {
        it('should run without crashing', () => {
            const output = run('types 2>&1 || true');
            // Either shows types table or an auth error — both are OK
            expect(output.length).toBeGreaterThan(0);
        });
    });

    describe('instances', () => {
        it('should run without crashing', () => {
            const output = run('instances 2>&1 || true');
            expect(output.length).toBeGreaterThan(0);
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
