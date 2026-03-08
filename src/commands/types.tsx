/**
 * lambda-cli types — List available GPU instance types with pricing and availability
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render } from 'ink';
import Spinner from 'ink-spinner';
import { LambdaApi } from '../api.js';
import { getApiKey } from '../config.js';
import { Table } from '../ui/Table.js';
import { formatPrice } from '../ui/StatusBadge.js';
import type { InstanceTypeAvailability } from '../types.js';

function TypesView({ filter }: { filter?: string }) {
    const [types, setTypes] = useState<InstanceTypeAvailability[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const api = new LambdaApi(getApiKey());
        api.listInstanceTypes()
            .then(data => {
                let filtered = data;
                if (filter) {
                    const f = filter.toLowerCase();
                    filtered = data.filter(t =>
                        t.instance_type.name.toLowerCase().includes(f) ||
                        (t.instance_type.specs?.gpu_description || '').toLowerCase().includes(f) ||
                        (t.instance_type.description || '').toLowerCase().includes(f)
                    );
                }
                // Sort: available first, then by GPU count desc
                filtered.sort((a, b) => {
                    const aAvail = a.regions_with_capacity_available.length > 0 ? 1 : 0;
                    const bAvail = b.regions_with_capacity_available.length > 0 ? 1 : 0;
                    if (aAvail !== bAvail) return bAvail - aAvail;
                    return b.instance_type.specs.gpus - a.instance_type.specs.gpus;
                });
                setTypes(filtered);
            })
            .catch(e => setError(e.message));
    }, []);

    if (error) return <Text color="red">Error: {error}</Text>;
    if (!types) {
        return (
            <Text>
                <Text color="green"><Spinner type="dots" /></Text> Loading instance types...
            </Text>
        );
    }

    const data = types.map(t => ({
        name: t.instance_type.name,
        gpu: `${t.instance_type.specs?.gpus || 0}x ${t.instance_type.specs?.gpu_description || 'Unknown'}`,
        vcpus: t.instance_type.specs?.vcpus || 0,
        ram: `${t.instance_type.specs?.memory_gib || 0} GB`,
        storage: `${t.instance_type.specs?.storage_gib || 0} GB`,
        price: formatPrice(t.instance_type.price_cents_per_hour),
        available: t.regions_with_capacity_available.length > 0
            ? t.regions_with_capacity_available.map(r => r.name).join(', ')
            : '—',
    }));

    return (
        <Table
            title={`Instance Types${filter ? ` (filter: ${filter})` : ''}`}
            columns={[
                { key: 'name', label: 'Type', width: 25 },
                { key: 'gpu', label: 'GPU', width: 30 },
                { key: 'vcpus', label: 'vCPUs', width: 8, align: 'right' },
                { key: 'ram', label: 'RAM', width: 10, align: 'right' },
                { key: 'price', label: 'Price', width: 12, align: 'right' },
                { key: 'available', label: 'Regions Available', width: 30 },
            ]}
            data={data}
        />
    );
}

export function runTypes(filter?: string) {
    render(<TypesView filter={filter} />);
}
