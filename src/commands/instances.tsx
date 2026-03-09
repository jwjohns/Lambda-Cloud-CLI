/**
 * lambda-cli instances — List running instances with status, IP, GPU, cost
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render } from 'ink';
import Spinner from 'ink-spinner';
import { LambdaApi } from '../api.js';
import { getApiKey } from '../config.js';
import { Table } from '../ui/Table.js';
import { formatPrice } from '../ui/StatusBadge.js';
import { getInstanceCost, syncTrackedInstances, getTotalCost } from '../cost-tracker.js';
import type { Instance } from '../types.js';

function InstancesView() {
    const [instances, setInstances] = useState<Instance[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const api = new LambdaApi(getApiKey());
        api.listInstances()
            .then(setInstances)
            .catch(e => setError(e.message));
    }, []);

    if (error) return <Text color="red">Error: {error}</Text>;
    if (!instances) {
        return (
            <Text>
                <Text color="green"><Spinner type="dots" /></Text> Loading instances...
            </Text>
        );
    }

    if (instances.length === 0) {
        return (
            <Box flexDirection="column">
                <Text bold color="cyan">Running Instances</Text>
                <Text dimColor>  No running instances.</Text>
            </Box>
        );
    }

    const statusIcon = (s: string) => {
        switch (s) {
            case 'active': return '🟢';
            case 'booting': return '🟡';
            case 'unhealthy': return '🔴';
            default: return '⚪';
        }
    };

    // Sync tracker with actual running instances
    syncTrackedInstances(instances.map(i => i.id));

    const data = instances.map(inst => {
        const cost = getInstanceCost(inst.id);
        return {
            status: `${statusIcon(inst.status)} ${inst.status}`,
            name: inst.name || inst.id.slice(0, 8),
            ip: inst.ip || '—',
            gpu: `${inst.instance_type.specs.gpus}x ${inst.instance_type.gpu_description || inst.instance_type.description}`,
            region: inst.region.name,
            price: formatPrice(inst.instance_type.price_cents_per_hour),
            uptime: cost?.uptime || '—',
            cost: cost?.cost || '—',
            id: inst.id.slice(0, 12),
        };
    });

    const total = getTotalCost();

    return (
        <Box flexDirection="column">
            <Table
                title="Running Instances"
                columns={[
                    { key: 'status', label: 'Status', width: 14 },
                    { key: 'name', label: 'Name', width: 14 },
                    { key: 'ip', label: 'IP', width: 18 },
                    { key: 'gpu', label: 'GPU', width: 22 },
                    { key: 'region', label: 'Region', width: 14 },
                    { key: 'price', label: '$/hr', width: 10, align: 'right' },
                    { key: 'uptime', label: 'Uptime', width: 10, align: 'right' },
                    { key: 'cost', label: 'Cost', width: 10, align: 'right' },
                    { key: 'id', label: 'ID', width: 14 },
                ]}
                data={data}
            />
            {total.count > 0 && (
                <Box marginTop={1}>
                    <Text dimColor>  💰 Session total: </Text>
                    <Text bold color="yellow">{total.total}</Text>
                    <Text dimColor> across {total.count} instance(s)</Text>
                </Box>
            )}
        </Box>
    );
}

export function runInstances() {
    render(<InstancesView />);
}
