/**
 * lambda-cli ssh/push/pull/setup — Remote operations commands
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render } from 'ink';
import Spinner from 'ink-spinner';
import { LambdaApi } from '../api.js';
import { getApiKey } from '../config.js';
import * as ssh from '../ssh.js';
import type { Instance } from '../types.js';

/** Resolve instance ID/name to IP address */
async function resolveHost(idOrName: string): Promise<string> {
    // If it looks like an IP, use directly
    if (/^\d+\.\d+\.\d+\.\d+$/.test(idOrName)) return idOrName;

    const api = new LambdaApi(getApiKey());
    const instances = await api.listInstances();
    const match = instances.find(i =>
        i.id === idOrName || i.id.startsWith(idOrName) ||
        i.name === idOrName
    );
    if (!match?.ip) throw new Error(`Instance "${idOrName}" not found or has no IP`);
    return match.ip;
}

// --- SSH Command ---

function SSHView({ target, command }: { target: string; command?: string }) {
    const [output, setOutput] = useState('');
    const [status, setStatus] = useState<'resolving' | 'connecting' | 'done' | 'error'>('resolving');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const host = await resolveHost(target);
                if (!command) {
                    // Interactive SSH — spawn native ssh process
                    setStatus('connecting');
                    ssh.interactiveSSH(host);
                    setStatus('done');
                } else {
                    // Run remote command
                    setStatus('connecting');
                    const result = await ssh.runRemote(host, command, { stream: true });
                    setOutput(result.stdout);
                    setStatus('done');
                }
            } catch (e: any) {
                setError(e.message);
                setStatus('error');
            }
        })();
    }, []);

    if (status === 'error') return <Text color="red">Error: {error}</Text>;
    if (status === 'resolving') return <Text><Text color="green"><Spinner type="dots" /></Text> Resolving instance...</Text>;
    if (status === 'connecting') return <Text><Text color="green"><Spinner type="dots" /></Text> Connecting...</Text>;

    return <Text color="green">Done.</Text>;
}

export function runSSH(target: string, command?: string) {
    if (!command) {
        // For interactive SSH, bypass Ink and go straight to native ssh
        resolveHost(target).then(host => {
            ssh.interactiveSSH(host);
        }).catch(e => {
            console.error(`Error: ${e.message}`);
            process.exit(1);
        });
    } else {
        render(<SSHView target={target} command={command} />);
    }
}

// --- Push Command ---

function TransferView({ direction, target, local, remote }: {
    direction: 'push' | 'pull';
    target: string;
    local: string;
    remote: string;
}) {
    const [status, setStatus] = useState<'resolving' | 'transferring' | 'done' | 'error'>('resolving');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const host = await resolveHost(target);
                setStatus('transferring');
                if (direction === 'push') {
                    await ssh.pushFiles(host, local, remote);
                } else {
                    await ssh.pullFiles(host, remote, local);
                }
                setStatus('done');
            } catch (e: any) {
                setError(e.message);
                setStatus('error');
            }
        })();
    }, []);

    const arrow = direction === 'push' ? '→' : '←';
    const label = direction === 'push' ? `${local} ${arrow} ${target}:${remote}` : `${target}:${remote} ${arrow} ${local}`;

    return (
        <Box flexDirection="column">
            {status === 'resolving' && <Text><Text color="green"><Spinner type="dots" /></Text> Resolving instance...</Text>}
            {status === 'transferring' && <Text><Text color="yellow"><Spinner type="dots" /></Text> {direction === 'push' ? 'Uploading' : 'Downloading'}: {label}</Text>}
            {status === 'done' && <Text color="green">✅ Transfer complete: {label}</Text>}
            {status === 'error' && <Text color="red">✗ {error}</Text>}
        </Box>
    );
}

export function runPush(target: string, localPath: string, remotePath: string) {
    render(<TransferView direction="push" target={target} local={localPath} remote={remotePath} />);
}

export function runPull(target: string, remotePath: string, localPath: string) {
    render(<TransferView direction="pull" target={target} local={localPath} remote={remotePath} />);
}

// --- Setup Command ---

function SetupView({ target, script }: { target: string; script: string }) {
    const [status, setStatus] = useState<'resolving' | 'uploading' | 'running' | 'done' | 'error'>('resolving');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const host = await resolveHost(target);

                // Upload training dir
                setStatus('uploading');
                await ssh.pushFiles(host, './training', '/home/ubuntu/OpenDASM/training');

                // Run setup script
                setStatus('running');
                await ssh.runRemote(host, `bash ${script}`, { stream: true });
                setStatus('done');
            } catch (e: any) {
                setError(e.message);
                setStatus('error');
            }
        })();
    }, []);

    return (
        <Box flexDirection="column">
            <Text bold color="cyan">Setup: {target}</Text>
            {status === 'resolving' && <Text><Text color="green"><Spinner type="dots" /></Text> Resolving instance...</Text>}
            {status === 'uploading' && <Text><Text color="yellow"><Spinner type="dots" /></Text> Uploading training directory...</Text>}
            {status === 'running' && <Text><Text color="yellow"><Spinner type="dots" /></Text> Running setup script (this takes a while)...</Text>}
            {status === 'done' && <Text color="green">✅ Setup complete!</Text>}
            {status === 'error' && <Text color="red">✗ {error}</Text>}
        </Box>
    );
}

export function runSetup(target: string, script = '/home/ubuntu/OpenDASM/training/scripts/setup-gh200-full.sh') {
    render(<SetupView target={target} script={script} />);
}
