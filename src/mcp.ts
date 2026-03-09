#!/usr/bin/env node
/**
 * Lambda Cloud MCP Server
 *
 * Exposes Lambda Cloud GPU management as MCP tools for AI agents.
 * Runs over stdio — compatible with Claude Code, Cursor, Codex, etc.
 *
 * Usage:
 *   lambda-cli mcp
 *   # Or via npx:
 *   npx lambda-cloud-cli mcp
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { LambdaApi } from './api.js';
import { getApiKey, getConfig } from './config.js';
import { getInstanceCost, trackLaunch, trackTerminate, syncTrackedInstances, getTotalCost } from './cost-tracker.js';


function getApi(): LambdaApi {
    const key = getApiKey();
    if (!key) throw new Error('Lambda API key not configured. Run: lambda config set apiKey YOUR_KEY');
    return new LambdaApi(key);
}

export async function startMcpServer() {
    const server = new McpServer({
        name: 'lambda-cloud',
        version: '0.2.2',
    });

    // ── list_instance_types ─────────────────────────────────────────────
    server.tool(
        'list_instance_types',
        'List all available Lambda Cloud GPU instance types with pricing, specs, and regional availability. Optionally filter by name.',
        { filter: z.string().optional().describe('Filter types by name (e.g. "gh200", "h100", "a100")') },
        async ({ filter }) => {
            const api = getApi();
            let types = await api.listInstanceTypes();
            if (filter) {
                const f = filter.toLowerCase();
                types = types.filter(t =>
                    t.instance_type.name.toLowerCase().includes(f) ||
                    (t.instance_type.description || '').toLowerCase().includes(f)
                );
            }
            const result = types.map(t => ({
                name: t.instance_type.name,
                gpus: t.instance_type.specs?.gpus || 0,
                vcpus: t.instance_type.specs?.vcpus || 0,
                memory_gib: t.instance_type.specs?.memory_gib || 0,
                storage_gib: t.instance_type.specs?.storage_gib || 0,
                price_per_hour: `$${((t.instance_type.price_cents_per_hour || 0) / 100).toFixed(2)}`,
                available_regions: t.regions_with_capacity_available.map(r => r.name),
            }));
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
        }
    );

    // ── check_availability ──────────────────────────────────────────────
    server.tool(
        'check_availability',
        'Check if a specific GPU instance type is currently available in any region.',
        { instance_type: z.string().describe('Instance type name, e.g. "gpu_1x_gh200"') },
        async ({ instance_type }) => {
            const api = getApi();
            const types = await api.listInstanceTypes();
            const match = types.find(t => t.instance_type.name === instance_type);
            if (!match) {
                return { content: [{ type: 'text' as const, text: `Unknown instance type: ${instance_type}` }] };
            }
            const regions = match.regions_with_capacity_available.map(r => r.name);
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        instance_type,
                        available: regions.length > 0,
                        regions,
                        price_per_hour: `$${((match.instance_type.price_cents_per_hour || 0) / 100).toFixed(2)}`,
                    }, null, 2)
                }]
            };
        }
    );

    // ── list_instances ──────────────────────────────────────────────────
    server.tool(
        'list_instances',
        'List all currently running Lambda Cloud GPU instances with their IDs, types, IPs, and status.',
        {},
        async () => {
            const api = getApi();
            const instances = await api.listInstances();
            syncTrackedInstances(instances.map(i => i.id));
            const result = instances.map(inst => {
                const cost = getInstanceCost(inst.id);
                return {
                    id: inst.id,
                    name: inst.name || '(unnamed)',
                    type: inst.instance_type?.name || 'unknown',
                    status: inst.status,
                    ip: inst.ip || null,
                    region: inst.region?.name || 'unknown',
                    ssh_keys: inst.ssh_key_names || [],
                    uptime: cost?.uptime || null,
                    session_cost: cost?.cost || null,
                };
            });
            const total = getTotalCost();
            return { content: [{ type: 'text' as const, text: JSON.stringify({ instances: result, total_cost: total.total, tracked_count: total.count }, null, 2) }] };
        }
    );

    // ── launch_instance ─────────────────────────────────────────────────
    server.tool(
        'launch_instance',
        'Launch a new Lambda Cloud GPU instance. Returns the instance ID and connection details. The instance may take 1-3 minutes to become active.',
        {
            instance_type: z.string().describe('GPU type, e.g. "gpu_1x_gh200"'),
            region: z.string().optional().describe('Region name (defaults to config)'),
            ssh_key: z.string().optional().describe('SSH key name (defaults to config)'),
            name: z.string().optional().describe('Instance name'),
            filesystem: z.string().optional().describe('Filesystem name to attach'),
        },
        async ({ instance_type, region, ssh_key, name, filesystem }) => {
            const api = getApi();
            const config = getConfig();
            const launchRegion = region || config.defaultRegion || 'us-east-3';
            const sshKey = ssh_key || config.defaultSshKey;

            if (!sshKey) {
                return { content: [{ type: 'text' as const, text: 'Error: No SSH key specified. Set one with: lambda config set defaultSshKey YOUR_KEY' }] };
            }

            // Look up price for cost tracking
            const types = await api.listInstanceTypes();
            const typeInfo = types.find(t => t.instance_type.name === instance_type);
            const priceCents = typeInfo?.instance_type.price_cents_per_hour ?? 0;

            try {
                const result = await api.launchInstance({
                    instance_type_name: instance_type,
                    region_name: launchRegion,
                    ssh_key_names: [sshKey],
                    name: name || undefined,
                    file_system_names: filesystem ? [filesystem] : undefined,
                });

                // Track for cost monitoring
                for (const id of result.instance_ids) {
                    trackLaunch(id, instance_type, priceCents, launchRegion, name);
                }

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            launched: true,
                            instance_ids: result.instance_ids,
                            price_per_hour: `$${(priceCents / 100).toFixed(2)}`,
                            message: `Instance launched in ${launchRegion}. Use list_instances to check when status is "active" and get the IP.`,
                        }, null, 2)
                    }]
                };
            } catch (e: any) {
                return { content: [{ type: 'text' as const, text: `Launch failed: ${e.message}` }] };
            }
        }
    );

    // ── terminate_instance ──────────────────────────────────────────────
    server.tool(
        'terminate_instance',
        'Terminate one or more Lambda Cloud GPU instances by ID. This action is irreversible.',
        {
            instance_ids: z.array(z.string()).describe('Array of instance IDs to terminate'),
        },
        async ({ instance_ids }) => {
            const api = getApi();
            try {
                // Get cost info before terminating
                const costSummary = instance_ids.map(id => {
                    const cost = trackTerminate(id);
                    return { id, uptime: cost?.uptime || null, session_cost: cost?.cost || null };
                });

                await api.terminateInstances(instance_ids);
                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            terminated: true,
                            instances: costSummary,
                            message: `${instance_ids.length} instance(s) terminated.`,
                        }, null, 2)
                    }]
                };
            } catch (e: any) {
                return { content: [{ type: 'text' as const, text: `Terminate failed: ${e.message}` }] };
            }
        }
    );

    // ── ssh_command ──────────────────────────────────────────────────────
    server.tool(
        'ssh_command',
        'Run a command on a Lambda Cloud instance via SSH. Returns the command output.',
        {
            instance_id: z.string().describe('Instance ID to connect to'),
            command: z.string().describe('Shell command to execute remotely'),
        },
        async ({ instance_id, command }) => {
            const api = getApi();
            const instances = await api.listInstances();
            const inst = instances.find(i => i.id === instance_id);

            if (!inst) return { content: [{ type: 'text' as const, text: `Instance ${instance_id} not found` }] };
            if (!inst.ip) return { content: [{ type: 'text' as const, text: `Instance ${instance_id} has no IP yet (status: ${inst.status})` }] };

            try {
                const { NodeSSH } = await import('node-ssh');
                const ssh = new NodeSSH();
                const config = getConfig();

                await ssh.connect({
                    host: inst.ip,
                    username: 'ubuntu',
                    privateKeyPath: config.sshPrivateKeyPath || undefined,
                    agent: process.env.SSH_AUTH_SOCK,
                });

                const result = await ssh.execCommand(command, { cwd: '/home/ubuntu' });
                ssh.dispose();

                return {
                    content: [{
                        type: 'text' as const,
                        text: JSON.stringify({
                            host: inst.ip,
                            command,
                            exit_code: result.code,
                            stdout: result.stdout,
                            stderr: result.stderr,
                        }, null, 2)
                    }]
                };
            } catch (e: any) {
                return { content: [{ type: 'text' as const, text: `SSH failed: ${e.message}` }] };
            }
        }
    );

    // ── list_ssh_keys ───────────────────────────────────────────────────
    server.tool(
        'list_ssh_keys',
        'List SSH keys registered with your Lambda Cloud account.',
        {},
        async () => {
            const api = getApi();
            const keys = await api.listSshKeys();
            return { content: [{ type: 'text' as const, text: JSON.stringify(keys, null, 2) }] };
        }
    );

    // ── get_config ──────────────────────────────────────────────────────
    server.tool(
        'get_config',
        'Get the current Lambda CLI configuration (API key is masked).',
        {},
        async () => {
            const conf = getConfig();
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify({
                        apiKey: conf.apiKey ? conf.apiKey.slice(0, 8) + '...' + conf.apiKey.slice(-4) : '(not set)',
                        defaultSshKey: conf.defaultSshKey || '(not set)',
                        defaultRegion: conf.defaultRegion || '(not set)',
                        defaultInstanceType: conf.defaultInstanceType || 'gpu_1x_gh200',
                        sshPrivateKeyPath: conf.sshPrivateKeyPath || '(auto-detect)',
                    }, null, 2)
                }]
            };
        }
    );

    // ── Start server ────────────────────────────────────────────────────
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
