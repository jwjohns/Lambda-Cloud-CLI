#!/usr/bin/env node

/**
 * Lambda Cloud CLI — GPU instance management with interactive TUI
 *
 * Usage:
 *   lambda-cli types [filter]         — List GPU types with pricing & availability
 *   lambda-cli instances              — List running instances
 *   lambda-cli launch <type>          — Launch a new instance
 *   lambda-cli terminate [id]         — Terminate instance(s)
 *   lambda-cli poll <type>            — Poll for availability (auto-launch)
 *   lambda-cli ssh <id> [command]     — SSH into instance or run command
 *   lambda-cli push <id> <local> <remote> — Upload files
 *   lambda-cli pull <id> <remote> <local> — Download files
 *   lambda-cli setup <id>             — Run training setup on instance
 *   lambda-cli config [set key value] — View/set configuration
 */

import { Command } from 'commander';
import { runTypes } from './commands/types.js';
import { runInstances } from './commands/instances.js';
import { runPoll } from './commands/poll.js';
import { runLaunch } from './commands/launch.js';
import { runTerminate } from './commands/terminate.js';
import { runSSH, runPush, runPull, runSetup } from './commands/remote.js';
import { runConfigShow, runConfigSet } from './commands/config.js';
import { startMcpServer } from './mcp.js';

const program = new Command();

program
    .name('lambda-cli')
    .description('Lambda Cloud CLI — GPU instance management with interactive TUI')
    .version('0.2.3');

// --- types ---
program
    .command('types')
    .description('List available GPU instance types with pricing and availability')
    .argument('[filter]', 'Filter by name or GPU (e.g. "gh200", "h100")')
    .action((filter?: string) => {
        runTypes(filter);
    });

// --- instances ---
program
    .command('instances')
    .alias('ls')
    .description('List running instances')
    .action(() => {
        runInstances();
    });

// --- launch ---
program
    .command('launch')
    .description('Launch a new GPU instance')
    .argument('<type>', 'Instance type (e.g. gpu_1x_gh200)')
    .option('-r, --region <region>', 'Region to launch in')
    .option('-k, --ssh-key <name>', 'SSH key name to use')
    .option('-f, --filesystem <name>', 'Filesystem to attach')
    .option('-n, --name <name>', 'Instance name')
    .action((type: string, opts) => {
        runLaunch(type, opts);
    });

// --- terminate ---
program
    .command('terminate')
    .alias('kill')
    .description('Terminate instance(s)')
    .argument('[id]', 'Instance ID or name (omit to select from list)')
    .option('-f, --force', 'Skip confirmation', false)
    .action((id?: string, opts?: { force: boolean }) => {
        runTerminate(id, opts?.force);
    });

// --- poll ---
program
    .command('poll')
    .description('Poll for GPU availability with live updates')
    .argument('<type>', 'Instance type to poll (e.g. gpu_1x_gh200, supports wildcards)')
    .option('-i, --interval <seconds>', 'Poll interval in seconds', '30')
    .option('-a, --auto-launch', 'Auto-launch when available', false)
    .option('-r, --region <region>', 'Preferred region for auto-launch')
    .action((type: string, opts) => {
        runPoll(type, {
            interval: parseInt(opts.interval),
            autoLaunch: opts.autoLaunch,
            region: opts.region,
        });
    });

// --- ssh ---
program
    .command('ssh')
    .description('SSH into an instance or run a remote command')
    .argument('<id>', 'Instance ID, name, or IP address')
    .argument('[command]', 'Command to run (omit for interactive shell)')
    .action((id: string, command?: string) => {
        runSSH(id, command);
    });

// --- push ---
program
    .command('push')
    .description('Upload files/directories to an instance')
    .argument('<id>', 'Instance ID, name, or IP')
    .argument('<local>', 'Local file/directory path')
    .argument('<remote>', 'Remote destination path')
    .action((id: string, local: string, remote: string) => {
        runPush(id, local, remote);
    });

// --- pull ---
program
    .command('pull')
    .description('Download files/directories from an instance')
    .argument('<id>', 'Instance ID, name, or IP')
    .argument('<remote>', 'Remote file/directory path')
    .argument('<local>', 'Local destination path')
    .action((id: string, remote: string, local: string) => {
        runPull(id, remote, local);
    });

// --- setup ---
program
    .command('setup')
    .description('Upload training code and run setup script on an instance')
    .argument('<id>', 'Instance ID, name, or IP')
    .option('-s, --script <path>', 'Setup script path', '/home/ubuntu/OpenDASM/training/scripts/setup-gh200-full.sh')
    .action((id: string, opts) => {
        runSetup(id, opts.script);
    });

// --- config ---
const configCmd = program
    .command('config')
    .description('View or set CLI configuration');

configCmd
    .command('show')
    .description('Show current configuration')
    .action(() => {
        runConfigShow();
    });

configCmd
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Config key (apiKey, defaultSshKey, defaultRegion, defaultInstanceType, sshPrivateKeyPath)')
    .argument('<value>', 'Config value')
    .action((key: string, value: string) => {
        runConfigSet(key, value);
    });

// Default: show config if no command
configCmd.action(() => {
    runConfigShow();
});

// --- mcp ---
program
    .command('mcp')
    .description('Start MCP server for AI agent integration (stdio transport)')
    .action(async () => {
        await startMcpServer();
    });

program.parse();
