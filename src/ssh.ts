/**
 * SSH and file transfer utilities for Lambda Cloud instances
 */

import { NodeSSH } from 'node-ssh';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { getConfig } from './config.js';

/** Resolve SSH private key path */
function resolvePrivateKey(): string {
    const conf = getConfig();
    if (conf.sshPrivateKeyPath && existsSync(conf.sshPrivateKeyPath)) {
        return conf.sshPrivateKeyPath;
    }
    // Try common defaults
    const candidates = [
        join(homedir(), '.ssh', 'id_ed25519'),
        join(homedir(), '.ssh', 'id_rsa'),
    ];
    for (const c of candidates) {
        if (existsSync(c)) return c;
    }
    throw new Error('No SSH private key found. Set with: lambda-cli config set sshPrivateKeyPath /path/to/key');
}

/** Connect to a Lambda instance via SSH */
export async function connectSSH(host: string, user = 'ubuntu'): Promise<NodeSSH> {
    const ssh = new NodeSSH();
    const keyPath = resolvePrivateKey();

    await ssh.connect({
        host,
        username: user,
        privateKeyPath: keyPath,
        readyTimeout: 30_000,
    });

    return ssh;
}

/** Run a command on a remote instance */
export async function runRemote(
    host: string,
    command: string,
    opts: { user?: string; cwd?: string; stream?: boolean } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
    const ssh = await connectSSH(host, opts.user);

    try {
        const result = await ssh.execCommand(command, {
            cwd: opts.cwd,
            onStdout: opts.stream ? (chunk) => process.stdout.write(chunk) : undefined,
            onStderr: opts.stream ? (chunk) => process.stderr.write(chunk) : undefined,
        });
        return { stdout: result.stdout, stderr: result.stderr, code: result.code ?? 0 };
    } finally {
        ssh.dispose();
    }
}

/** Upload files/directories to a remote instance */
export async function pushFiles(
    host: string,
    localPath: string,
    remotePath: string,
    opts: { user?: string } = {}
): Promise<void> {
    const ssh = await connectSSH(host, opts.user);

    try {
        const { lstatSync } = await import('fs');
        const stats = lstatSync(localPath);

        if (stats.isDirectory()) {
            await ssh.putDirectory(localPath, remotePath, {
                recursive: true,
                concurrency: 5,
                tick: (localFile, remoteFile, error) => {
                    if (error) {
                        console.error(`  ✗ ${localFile}`);
                    }
                },
            });
        } else {
            await ssh.putFile(localPath, remotePath);
        }
    } finally {
        ssh.dispose();
    }
}

/** Download files from a remote instance */
export async function pullFiles(
    host: string,
    remotePath: string,
    localPath: string,
    opts: { user?: string } = {}
): Promise<void> {
    const ssh = await connectSSH(host, opts.user);

    try {
        // Check if remote path is a directory
        const check = await ssh.execCommand(`test -d "${remotePath}" && echo dir || echo file`);
        if (check.stdout.trim() === 'dir') {
            await ssh.getDirectory(localPath, remotePath, {
                recursive: true,
                concurrency: 5,
            });
        } else {
            await ssh.getFile(localPath, remotePath);
        }
    } finally {
        ssh.dispose();
    }
}

/** Interactive SSH session - hands control to native ssh */
export function interactiveSSH(host: string, user = 'ubuntu'): void {
    const { execSync } = require('child_process');
    const keyPath = resolvePrivateKey();
    execSync(`ssh -o StrictHostKeyChecking=no -i "${keyPath}" ${user}@${host}`, {
        stdio: 'inherit',
    });
}
