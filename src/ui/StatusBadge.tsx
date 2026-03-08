/**
 * Color-coded status badges for instances
 */

import React from 'react';
import { Text } from 'ink';

const STATUS_COLORS: Record<string, string> = {
    active: 'green',
    booting: 'yellow',
    unhealthy: 'red',
    terminated: 'gray',
};

const STATUS_ICONS: Record<string, string> = {
    active: '●',
    booting: '◐',
    unhealthy: '✗',
    terminated: '○',
};

interface StatusBadgeProps {
    status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
    const color = STATUS_COLORS[status] || 'white';
    const icon = STATUS_ICONS[status] || '?';
    return <Text color={color as any}>{icon} {status}</Text>;
}

/** Format cents to dollars */
export function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}/hr`;
}

/** Format bytes to human-readable */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Format uptime/duration */
export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}
