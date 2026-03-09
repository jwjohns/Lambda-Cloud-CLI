/**
 * lambda-cli launch — Launch a new GPU instance
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render } from 'ink';
import Spinner from 'ink-spinner';
import { LambdaApi } from '../api.js';
import { getApiKey, getConfig } from '../config.js';
import { trackLaunch } from '../cost-tracker.js';

interface LaunchOptions {
    region?: string;
    sshKey?: string;
    filesystem?: string;
    name?: string;
}

function LaunchView({ typeName, options }: { typeName: string; options: LaunchOptions }) {
    const [status, setStatus] = useState<'resolving' | 'launching' | 'waiting' | 'done' | 'error'>('resolving');
    const [instanceId, setInstanceId] = useState<string | null>(null);
    const [instanceIp, setInstanceIp] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const api = new LambdaApi(getApiKey());
                const conf = getConfig();

                // 1. Resolve SSH key
                let sshKeys = options.sshKey ? [options.sshKey] : [];
                if (sshKeys.length === 0 && conf.defaultSshKey) {
                    sshKeys = [conf.defaultSshKey];
                }
                if (sshKeys.length === 0) {
                    const keys = await api.listSshKeys();
                    if (keys.length === 0) throw new Error('No SSH keys found. Add one first.');
                    sshKeys = [keys[0]!.name];
                }

                // 2. Resolve region
                let region = options.region || conf.defaultRegion;
                if (!region) {
                    const avail = await api.getAvailability(typeName);
                    if (avail.length === 0) throw new Error(`No availability for ${typeName}. Try polling.`);
                    region = avail[0]!.name;
                }

                // 3. Look up price
                const types = await api.listInstanceTypes();
                const typeInfo = types.find(t => t.instance_type.name === typeName);
                const priceCents = typeInfo?.instance_type.price_cents_per_hour ?? 0;

                // 4. Launch
                setStatus('launching');
                const result = await api.launchInstance({
                    instance_type_name: typeName,
                    region_name: region,
                    ssh_key_names: sshKeys,
                    file_system_names: options.filesystem ? [options.filesystem] : undefined,
                    name: options.name,
                });

                const id = result.instance_ids[0]!;
                setInstanceId(id);
                setStatus('waiting');

                // Track cost from launch time
                trackLaunch(id, typeName, priceCents, region, options.name);

                // 4. Wait for active
                for (let i = 0; i < 60; i++) {
                    await new Promise(r => setTimeout(r, 5000));
                    const inst = await api.getInstance(id);
                    if (inst.status === 'active' && inst.ip) {
                        setInstanceIp(inst.ip);
                        setStatus('done');
                        return;
                    }
                }
                throw new Error('Instance did not become active within 5 minutes');
            } catch (e: any) {
                setError(e.message);
                setStatus('error');
            }
        })();
    }, []);

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">Launch: {typeName}</Text>
            <Box marginTop={1} flexDirection="column">
                <Text>
                    {status === 'resolving' && <><Text color="green"><Spinner type="dots" /></Text> Resolving SSH key and region...</>}
                    {status === 'launching' && <><Text color="green"><Spinner type="dots" /></Text> Sending launch request...</>}
                    {status === 'waiting' && <><Text color="yellow"><Spinner type="dots" /></Text> Waiting for instance to boot... (ID: {instanceId?.slice(0, 12)})</>}
                    {status === 'done' && (
                        <Box flexDirection="column">
                            <Text color="green" bold>✅ Instance ready!</Text>
                            <Text>   ID: {instanceId}</Text>
                            <Text>   IP: {instanceIp}</Text>
                            <Text>   SSH: <Text color="cyan">ssh ubuntu@{instanceIp}</Text></Text>
                            <Text>   CLI: <Text color="cyan">lambda-cli ssh {instanceId?.slice(0, 12)}</Text></Text>
                        </Box>
                    )}
                    {status === 'error' && <Text color="red">✗ {error}</Text>}
                </Text>
            </Box>
        </Box>
    );
}

export function runLaunch(typeName: string, options: LaunchOptions) {
    render(<LaunchView typeName={typeName} options={options} />);
}
