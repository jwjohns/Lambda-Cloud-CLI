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
    approximate?: boolean; // true if launch time was auto-discovered (not exact)
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
        uptime: formatUptime(uptimeMs, tracked.approximate),
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
        uptime: formatUptime(uptimeMs, tracked.approximate),
        cost: formatCost(costCents),
        launchedAt: tracked.launchedAt,
    };
}

/** Instance info needed for auto-discovery */
export interface InstanceInfo {
    id: string;
    name?: string | null;
    instanceType: string;
    priceCentsPerHour: number;
    region: string;
}

/** Sync tracked instances with API data — auto-discover untracked, remove stale */
export function syncTrackedInstances(activeInstances: InstanceInfo[]): void {
    const instances = store.get('instances');
    const activeIds = new Set(activeInstances.map(i => i.id));
    let changed = false;

    // Remove instances that are no longer active
    for (const id of Object.keys(instances)) {
        if (!activeIds.has(id)) {
            delete instances[id];
            changed = true;
        }
    }

    // Auto-discover: track any active instances we don't know about
    for (const inst of activeInstances) {
        if (!instances[inst.id]) {
            instances[inst.id] = {
                instanceId: inst.id,
                name: inst.name || undefined,
                instanceType: inst.instanceType,
                launchedAt: Date.now(),
                priceCentsPerHour: inst.priceCentsPerHour,
                region: inst.region,
                approximate: true,
            };
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

function formatUptime(ms: number, approximate?: boolean): string {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const prefix = approximate ? '~' : '';
    if (hours === 0) return `${prefix}${minutes}m`;
    return `${prefix}${hours}h ${minutes}m`;
}

function formatCost(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}
