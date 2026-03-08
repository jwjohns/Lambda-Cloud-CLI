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

        // Send all messages
        for (const msg of messages) {
            proc.stdin.write(JSON.stringify(msg) + '\n');
        }

        // Give it time to process, then close
        setTimeout(() => {
            proc.stdin.end();
            proc.kill('SIGTERM');
        }, 3000);

        proc.on('close', () => {
            const responses = stdout
                .split('\n')
                .filter(l => l.trim())
                .map(l => {
                    try { return JSON.parse(l); }
                    catch { return null; }
                })
                .filter(Boolean);
            resolve({ responses, stderr });
        });

        setTimeout(() => reject(new Error('MCP timeout')), 10000);
    });
}

const INIT_MSG = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '1.0' },
    },
};

const INITIALIZED_MSG = {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
};

describe('MCP Server', () => {
    it('should respond to initialize with server info', async () => {
        const { responses } = await runMcp([INIT_MSG, INITIALIZED_MSG]);
        const init = responses.find(r => r.id === 1);
        expect(init).toBeDefined();
        expect(init.result.serverInfo.name).toBe('lambda-cloud');
        expect(init.result.serverInfo.version).toBe('0.2.0');
        expect(init.result.protocolVersion).toBe('2024-11-05');
    });

    it('should list all 8 tools', async () => {
        const { responses } = await runMcp([
            INIT_MSG,
            INITIALIZED_MSG,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]);

        const toolList = responses.find(r => r.id === 2);
        expect(toolList).toBeDefined();
        const toolNames = toolList.result.tools.map((t: any) => t.name);
        expect(toolNames).toContain('list_instance_types');
        expect(toolNames).toContain('check_availability');
        expect(toolNames).toContain('list_instances');
        expect(toolNames).toContain('launch_instance');
        expect(toolNames).toContain('terminate_instance');
        expect(toolNames).toContain('ssh_command');
        expect(toolNames).toContain('list_ssh_keys');
        expect(toolNames).toContain('get_config');
        expect(toolNames).toHaveLength(8);
    });

    it('should have correct schema for launch_instance', async () => {
        const { responses } = await runMcp([
            INIT_MSG,
            INITIALIZED_MSG,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]);

        const toolList = responses.find(r => r.id === 2);
        const launch = toolList.result.tools.find((t: any) => t.name === 'launch_instance');
        expect(launch).toBeDefined();
        expect(launch.inputSchema.required).toContain('instance_type');
        expect(launch.inputSchema.properties).toHaveProperty('instance_type');
        expect(launch.inputSchema.properties).toHaveProperty('region');
        expect(launch.inputSchema.properties).toHaveProperty('ssh_key');
        expect(launch.inputSchema.properties).toHaveProperty('name');
        expect(launch.inputSchema.properties).toHaveProperty('filesystem');
    });

    it('should execute get_config tool', async () => {
        const { responses } = await runMcp([
            INIT_MSG,
            INITIALIZED_MSG,
            { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_config', arguments: {} } },
        ]);

        const config = responses.find(r => r.id === 3);
        expect(config).toBeDefined();
        expect(config.result.content[0].type).toBe('text');
        const data = JSON.parse(config.result.content[0].text);
        expect(data).toHaveProperty('apiKey');
        expect(data).toHaveProperty('defaultSshKey');
        expect(data).toHaveProperty('defaultRegion');
        // API key should be masked
        expect(data.apiKey).toMatch(/\.\.\./);
    });

    it('should have correct schema for check_availability', async () => {
        const { responses } = await runMcp([
            INIT_MSG,
            INITIALIZED_MSG,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]);

        const toolList = responses.find(r => r.id === 2);
        const check = toolList.result.tools.find((t: any) => t.name === 'check_availability');
        expect(check).toBeDefined();
        expect(check.inputSchema.required).toContain('instance_type');
    });

    it('should have correct schema for terminate_instance', async () => {
        const { responses } = await runMcp([
            INIT_MSG,
            INITIALIZED_MSG,
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        ]);

        const toolList = responses.find(r => r.id === 2);
        const term = toolList.result.tools.find((t: any) => t.name === 'terminate_instance');
        expect(term).toBeDefined();
        expect(term.inputSchema.required).toContain('instance_ids');
        expect(term.inputSchema.properties.instance_ids.type).toBe('array');
    });
});
