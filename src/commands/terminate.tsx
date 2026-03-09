/**
 * lambda-cli terminate — Terminate instances with confirmation
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { LambdaApi } from '../api.js';
import { getApiKey } from '../config.js';
import { formatPrice } from '../ui/StatusBadge.js';
import { trackTerminate } from '../cost-tracker.js';
import type { Instance } from '../types.js';

function TerminateView({ instanceId, force }: { instanceId?: string; force: boolean }) {
    const { exit } = useApp();
    const [instances, setInstances] = useState<Instance[] | null>(null);
    const [confirmed, setConfirmed] = useState(force);
    const [terminated, setTerminated] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const api = new LambdaApi(getApiKey());
        if (instanceId) {
            // Terminate specific instance
            api.listInstances()
                .then(all => {
                    const match = all.filter(i =>
                        i.id === instanceId || i.id.startsWith(instanceId) ||
                        i.name === instanceId
                    );
                    if (match.length === 0) {
                        setError(`No instance found matching "${instanceId}"`);
                    } else {
                        setInstances(match);
                    }
                })
                .catch(e => setError(e.message));
        } else {
            // Show all and ask
            api.listInstances()
                .then(all => {
                    if (all.length === 0) setError('No running instances.');
                    else setInstances(all);
                })
                .catch(e => setError(e.message));
        }
    }, []);

    useEffect(() => {
        if (confirmed && instances && !terminated) {
            const api = new LambdaApi(getApiKey());
            api.terminateInstances(instances.map(i => i.id))
                .then(() => setTerminated(true))
                .catch(e => setError(e.message));
        }
    }, [confirmed, instances, terminated]);

    useInput((input) => {
        if (input === 'y' || input === 'Y') setConfirmed(true);
        if (input === 'n' || input === 'N' || input === 'q') exit();
    });

    if (error) return <Text color="red">Error: {error}</Text>;
    if (!instances) {
        return <Text><Text color="green"><Spinner type="dots" /></Text> Loading instances...</Text>;
    }

    if (terminated) {
        return (
            <Box flexDirection="column">
                <Text color="green" bold>✅ Terminated {instances.length} instance(s)</Text>
                {instances.map(i => {
                    const costInfo = trackTerminate(i.id);
                    return (
                        <Box key={i.id} flexDirection="column">
                            <Text>   {i.id.slice(0, 12)} ({i.name || i.instance_type.name})</Text>
                            {costInfo && (
                                <Text dimColor>   💰 Uptime: {costInfo.uptime} — Session cost: <Text color="yellow" bold>{costInfo.cost}</Text></Text>
                            )}
                        </Box>
                    );
                })}
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            <Text bold color="red">⚠️  Terminate {instances.length} instance(s)?</Text>
            {instances.map(i => (
                <Text key={i.id}>
                    {'  '}{i.id.slice(0, 12)} — {i.instance_type.specs.gpus}x {i.instance_type.gpu_description || i.instance_type.description} — {i.ip || '(no IP)'} — {formatPrice(i.instance_type.price_cents_per_hour)}
                </Text>
            ))}
            <Box marginTop={1}>
                <Text color="yellow">Press Y to confirm, N to cancel</Text>
            </Box>
        </Box>
    );
}

export function runTerminate(instanceId?: string, force = false) {
    render(<TerminateView instanceId={instanceId} force={force} />);
}
