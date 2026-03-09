/**
 * Local cost tracker for Lambda Cloud instances.
 * Stores launch timestamps and hourly rates to calculate running costs.
 */

import Conf from 'conf';

interface TrackedInstance {
    instanceId: string;
    name?: string;
    instanceType: string;
    launchedAt: number; // Unix timestamp ms
    priceCentsPerHour: number;
    region: string;
}

interface CostTrackerState {
    instances: Record<string, TrackedInstance>;
}

const store = new Conf<CostTrackerState>({
    projectName: 'lambda-cli',
    configName: 'cost-tracker',
    schema: {
        instances: { type: 'object', default: {} },
    },
});

/** Track a newly launched instance */
export function trackLaunch(
    instanceId: string,
    instanceType: string,
    priceCentsPerHour: number,
    region: string,
    name?: string,
): void {
    const instances = store.get('instances');
    instances[instanceId] = {
        instanceId,
        name,
        instanceType,
        launchedAt: Date.now(),
        priceCentsPerHour,
        region,
    };
    store.set('instances', instances);
}

/** Remove a terminated instance and return its final cost info */
export function trackTerminate(instanceId: string): {
    uptime: string;
    cost: string;
    costCents: number;
} | null {
    const instances = store.get('instances');
    const tracked = instances[instanceId];
    if (!tracked) return null;

    const uptimeMs = Date.now() - tracked.launchedAt;
    const hours = uptimeMs / (1000 * 60 * 60);
    const costCents = hours * tracked.priceCentsPerHour;

    delete instances[instanceId];
    store.set('instances', instances);

    return {
        uptime: formatUptime(uptimeMs),
        cost: formatCost(costCents),
        costCents,
    };
}

/** Get cost info for a running instance */
export function getInstanceCost(instanceId: string): {
    uptime: string;
    cost: string;
    launchedAt: number;
} | null {
    const instances = store.get('instances');
    const tracked = instances[instanceId];
    if (!tracked) return null;

    const uptimeMs = Date.now() - tracked.launchedAt;
    const hours = uptimeMs / (1000 * 60 * 60);
    const costCents = hours * tracked.priceCentsPerHour;

    return {
        uptime: formatUptime(uptimeMs),
        cost: formatCost(costCents),
        launchedAt: tracked.launchedAt,
    };
}

/** Sync tracked instances with API data — remove any that no longer exist */
export function syncTrackedInstances(activeIds: string[]): void {
    const instances = store.get('instances');
    const activeSet = new Set(activeIds);
    let changed = false;
    for (const id of Object.keys(instances)) {
        if (!activeSet.has(id)) {
            delete instances[id];
            changed = true;
        }
    }
    if (changed) store.set('instances', instances);
}

/** Get total cost across all tracked instances */
export function getTotalCost(): { total: string; count: number } {
    const instances = store.get('instances');
    let totalCents = 0;
    let count = 0;
    for (const tracked of Object.values(instances)) {
        const uptimeMs = Date.now() - tracked.launchedAt;
        const hours = uptimeMs / (1000 * 60 * 60);
        totalCents += hours * tracked.priceCentsPerHour;
        count++;
    }
    return { total: formatCost(totalCents), count };
}

function formatUptime(ms: number): string {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

function formatCost(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}
