/**
 * lambda-cli config — View and set configuration
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, render } from 'ink';
import { getConfig, setConfig, getApiKey, getConfigPath } from '../config.js';
import { LambdaApi } from '../api.js';
import Spinner from 'ink-spinner';
import type { LambdaConfig } from '../types.js';

function ConfigView() {
    const conf = getConfig();
    const masked = conf.apiKey
        ? conf.apiKey.slice(0, 8) + '...' + conf.apiKey.slice(-4)
        : '(not set)';

    return (
        <Box flexDirection="column">
            <Text bold color="cyan">Lambda CLI Configuration</Text>
            <Text dimColor>Path: {getConfigPath()}</Text>
            <Box marginTop={1} flexDirection="column">
                <Text>  apiKey:              <Text color={conf.apiKey ? 'green' : 'red'}>{masked}</Text></Text>
                <Text>  defaultSshKey:       <Text color="white">{conf.defaultSshKey || '(auto)'}</Text></Text>
                <Text>  defaultRegion:       <Text color="white">{conf.defaultRegion || '(auto)'}</Text></Text>
                <Text>  defaultInstanceType: <Text color="white">{conf.defaultInstanceType || 'gpu_1x_gh200'}</Text></Text>
                <Text>  sshPrivateKeyPath:   <Text color="white">{conf.sshPrivateKeyPath || '(auto-detect)'}</Text></Text>
            </Box>
        </Box>
    );
}

function ConfigSetView({ configKey, value }: { configKey: string; value: string }) {
    const [done, setDone] = useState(false);
    const [validated, setValidated] = useState<boolean | null>(null);

    useEffect(() => {
        setConfig(configKey as keyof LambdaConfig, value);
        setDone(true);

        // If setting API key, validate it
        if (configKey === 'apiKey') {
            const api = new LambdaApi(value);
            api.validate().then(setValidated);
        }
    }, []);

    return (
        <Box flexDirection="column">
            {done ? (
                <>
                    <Text color="green">✅ Set {configKey} = {configKey === 'apiKey' ? value.slice(0, 8) + '...' : value}</Text>
                    {validated === true && <Text color="green">   API key validated ✓</Text>}
                    {validated === false && <Text color="red">   ⚠️ API key validation failed — check your key</Text>}
                </>
            ) : (
                <Text><Text color="green"><Spinner type="dots" /></Text> Setting {configKey}...</Text>
            )}
        </Box>
    );
}

export function runConfigShow() {
    render(<ConfigView />);
}

export function runConfigSet(key: string, value: string) {
    const validKeys: (keyof LambdaConfig)[] = ['apiKey', 'defaultSshKey', 'defaultRegion', 'defaultInstanceType', 'sshPrivateKeyPath'];
    if (!validKeys.includes(key as any)) {
        console.error(`Invalid config key: ${key}. Valid keys: ${validKeys.join(', ')}`);
        process.exit(1);
    }
    render(<ConfigSetView configKey={key} value={value} />);
}
