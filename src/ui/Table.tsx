/**
 * Reusable Ink table component with column alignment and colors
 */

import React from 'react';
import { Box, Text } from 'ink';

interface Column {
    key: string;
    label: string;
    width?: number;
    color?: string;
    align?: 'left' | 'right';
}

interface TableProps {
    columns: Column[];
    data: Record<string, string | number | boolean | null | undefined>[];
    title?: string;
}

export function Table({ columns, data, title }: TableProps) {
    // Calculate column widths
    const widths = columns.map(col => {
        const maxDataWidth = data.reduce((max, row) => {
            const val = String(row[col.key] ?? '');
            return Math.max(max, val.length);
        }, col.label.length);
        return col.width ?? Math.min(maxDataWidth + 2, 40);
    });

    return (
        <Box flexDirection="column">
            {title && (
                <Box marginBottom={1}>
                    <Text bold color="cyan">{title}</Text>
                </Box>
            )}

            {/* Header */}
            <Box>
                {columns.map((col, i) => (
                    <Box key={col.key} width={widths[i]}>
                        <Text bold dimColor>{col.label.toUpperCase().padEnd(widths[i])}</Text>
                    </Box>
                ))}
            </Box>

            {/* Separator */}
            <Box>
                <Text dimColor>{'─'.repeat(widths.reduce((a, b) => a + b, 0))}</Text>
            </Box>

            {/* Rows */}
            {data.map((row, rowIdx) => (
                <Box key={rowIdx}>
                    {columns.map((col, i) => {
                        const val = String(row[col.key] ?? '—');
                        const padded = col.align === 'right'
                            ? val.padStart(widths[i])
                            : val.padEnd(widths[i]);
                        return (
                            <Box key={col.key} width={widths[i]}>
                                <Text color={col.color as any}>{padded}</Text>
                            </Box>
                        );
                    })}
                </Box>
            ))}

            {/* Empty state */}
            {data.length === 0 && (
                <Box>
                    <Text dimColor italic>  No data</Text>
                </Box>
            )}
        </Box>
    );
}
