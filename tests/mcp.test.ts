import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve(__dirname, '../dist/index.js');

function runMcp(messages: object[]): Promise<{ responses: any[]; stderr: string }> {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', [CLI_PATH, 'mcp'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        for (const msg of messages) {
            proc.stdin.write(JSON.stringify(msg) + '\n');
        }

        setTimeout(() => {
            proc.stdin.end();
            proc.kill('SIGTERM');
        }, 3000);

        proc.on('close', () => {
            const responses = stdout
                .split('\n')
                .filter(l => l.trim())
                .map(l => { try { return JSON.parse(l); } catch { return null; } })
                .filter(Boolean);
            resolve({ responses, stderr });
        });

        setTimeout(() => reject(new Error('MCP timeout')), 10000);
    });
}

const INIT_MSGS = [
    {
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vitest', version: '1.0' },
        },
    },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
];

describe('MCP Server', () => {
    it('should respond to initialize with server info', async () => {
        const { responses } = await runMcp(INIT_MSGS);
        const init = responses.find(r => r.id === 1);
        expect(init).toBeDefined();
        expect(init.result.serverInfo.name).toBe('lambda-cloud');
        expect(init.result.protocolVersion).toBe('2024-11-05');
    });

    it('should list all 8 tools', async () => {
        const { responses } = await runMcp([
            ...INIT_MSGS,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]);

        const toolList = responses.find(r => r.id === 2);
        expect(toolList).toBeDefined();
        const toolNames = toolList.result.tools.map((t: any) => t.name).sort();
        expect(toolNames).toEqual([
            'check_availability',
            'get_config',
            'launch_instance',
            'list_instance_types',
            'list_instances',
            'list_ssh_keys',
            'ssh_command',
            'terminate_instance',
        ]);
    });

    it('should have correct schema for launch_instance', async () => {
        const { responses } = await runMcp([
            ...INIT_MSGS,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]);

        const toolList = responses.find(r => r.id === 2);
        const launch = toolList.result.tools.find((t: any) => t.name === 'launch_instance');
        expect(launch.inputSchema.required).toContain('instance_type');
        expect(launch.inputSchema.properties).toHaveProperty('region');
        expect(launch.inputSchema.properties).toHaveProperty('ssh_key');
    });

    it('should have correct schema for terminate_instance', async () => {
        const { responses } = await runMcp([
            ...INIT_MSGS,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]);

        const toolList = responses.find(r => r.id === 2);
        const term = toolList.result.tools.find((t: any) => t.name === 'terminate_instance');
        expect(term.inputSchema.required).toContain('instance_ids');
        expect(term.inputSchema.properties.instance_ids.type).toBe('array');
    });

    it('should execute get_config without crashing', async () => {
        const { responses } = await runMcp([
            ...INIT_MSGS,
            { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_config', arguments: {} } },
        ]);

        const config = responses.find(r => r.id === 3);
        expect(config).toBeDefined();
        expect(config.result.content[0].type).toBe('text');
        const data = JSON.parse(config.result.content[0].text);
        expect(data).toHaveProperty('apiKey');
        expect(data).toHaveProperty('defaultSshKey');
    });
});
