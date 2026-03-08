/**
 * lambda-cli poll — Poll for GPU availability with live TUI, auto-launch, desktop notification
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, render, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { LambdaApi } from '../api.js';
import { getApiKey, getConfig } from '../config.js';
import { Table } from '../ui/Table.js';
import { formatPrice } from '../ui/StatusBadge.js';
import type { InstanceTypeAvailability } from '../types.js';
import { execSync } from 'child_process';

interface PollOptions {
    interval: number;
    autoLaunch: boolean;
    region?: string;
}

function sendNotification(title: string, message: string) {
    try {
        if (process.platform === 'darwin') {
            execSync(`osascript -e 'display notification "${message}" with title "${title}" sound name "Glass"'`);
        }
    } catch { /* ignore notification errors */ }
}

function PollView({ typeName, options }: { typeName: string; options: PollOptions }) {
    const { exit } = useApp();
    const [types, setTypes] = useState<InstanceTypeAvailability[]>([]);
    const [lastCheck, setLastCheck] = useState<Date | null>(null);
    const [checkCount, setCheckCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [launched, setLaunched] = useState(false);
    const [launching, setLaunching] = useState(false);

    const poll = useCallback(async () => {
        try {
            const api = new LambdaApi(getApiKey());
            const allTypes = await api.listInstanceTypes();

            // Filter by pattern (supports wildcards like gpu_*)
            const pattern = typeName.replace('*', '.*');
            const regex = new RegExp(pattern, 'i');
            const matching = allTypes.filter(t => regex.test(t.instance_type.name));

            setTypes(matching);
            setLastCheck(new Date());
            setCheckCount(c => c + 1);
            setError(null);

            // Check availability
            const available = matching.filter(t => t.regions_with_capacity_available.length > 0);
            if (available.length > 0) {
                const first = available[0]!;
                const region = first.regions_with_capacity_available[0]!;
                sendNotification(
                    '🚀 GPU Available!',
                    `${first.instance_type.name} in ${region.description}`
                );

                if (options.autoLaunch && !launched && !launching) {
                    setLaunching(true);
                    try {
                        const conf = getConfig();
                        const sshKeys = conf.defaultSshKey ? [conf.defaultSshKey] : [];
                        if (sshKeys.length === 0) {
                            const keys = await api.listSshKeys();
                            if (keys.length > 0) sshKeys.push(keys[0]!.name);
                        }

                        const result = await api.launchInstance({
                            instance_type_name: first.instance_type.name,
                            region_name: options.region || region.name,
                            ssh_key_names: sshKeys,
                        });
                        setLaunched(true);
                        sendNotification('✅ Instance Launched!', `ID: ${result.instance_ids[0]}`);
                    } catch (e: any) {
                        setError(`Auto-launch failed: ${e.message}`);
                    }
                    setLaunching(false);
                }
            }
        } catch (e: any) {
            setError(e.message);
        }
    }, [typeName, options, launched, launching]);

    useEffect(() => {
        poll();
        const timer = setInterval(poll, options.interval * 1000);
        return () => clearInterval(timer);
    }, [poll]);

    if (launched) {
        return (
            <Box flexDirection="column">
                <Text color="green" bold>✅ Instance auto-launched successfully!</Text>
                <Text>Run `lambda-cli instances` to see details.</Text>
            </Box>
        );
    }

    const data = types.map(t => ({
        type: t.instance_type.name,
        gpu: `${t.instance_type.specs.gpus}x ${t.instance_type.specs.gpu_description}`,
        price: formatPrice(t.instance_type.price_cents_per_hour),
        status: t.regions_with_capacity_available.length > 0 ? '🟢 AVAILABLE' : '🔴 Sold out',
        regions: t.regions_with_capacity_available.length > 0
            ? t.regions_with_capacity_available.map(r => r.name).join(', ')
            : '—',
    }));

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    Polling for: {typeName} (every {options.interval}s)
                    {options.autoLaunch && <Text color="yellow"> [auto-launch ON]</Text>}
                </Text>
            </Box>

            <Table
                columns={[
                    { key: 'type', label: 'Type', width: 25 },
                    { key: 'gpu', label: 'GPU', width: 28 },
                    { key: 'price', label: 'Price', width: 12 },
                    { key: 'status', label: 'Status', width: 16 },
                    { key: 'regions', label: 'Regions', width: 25 },
                ]}
                data={data}
            />

            <Box marginTop={1}>
                {launching ? (
                    <Text color="yellow"><Spinner type="dots" /> Launching instance...</Text>
                ) : (
                    <Text dimColor>
                        Checks: {checkCount} | Last: {lastCheck?.toLocaleTimeString() ?? '—'} |{' '}
                        <Text color="green"><Spinner type="dots" /></Text> Next check in {options.interval}s
                    </Text>
                )}
            </Box>

            {error && (
                <Box marginTop={1}>
                    <Text color="red">Error: {error}</Text>
                </Box>
            )}
        </Box>
    );
}

export function runPoll(typeName: string, options: PollOptions) {
    render(<PollView typeName={typeName} options={options} />);
}
