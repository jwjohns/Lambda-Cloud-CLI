/**
 * Config management for Lambda CLI
 * Stores API key, SSH key preferences, default region, etc.
 */

import Conf from 'conf';
import type { LambdaConfig } from './types.js';

const config = new Conf<LambdaConfig>({
    projectName: 'lambda-cli',
    schema: {
        apiKey: { type: 'string', default: '' },
        defaultSshKey: { type: 'string', default: '' },
        defaultRegion: { type: 'string', default: '' },
        defaultInstanceType: { type: 'string', default: 'gpu_1x_gh200' },
        sshPrivateKeyPath: { type: 'string', default: '' },
    },
});

export function getConfig(): LambdaConfig {
    return {
        apiKey: config.get('apiKey'),
        defaultSshKey: config.get('defaultSshKey'),
        defaultRegion: config.get('defaultRegion'),
        defaultInstanceType: config.get('defaultInstanceType'),
        sshPrivateKeyPath: config.get('sshPrivateKeyPath'),
    };
}

export function setConfig(key: keyof LambdaConfig, value: string): void {
    config.set(String(key) as keyof LambdaConfig, value);
}

export function getApiKey(): string {
    const key = config.get('apiKey') || process.env.LAMBDA_API_KEY || '';
    if (!key) {
        throw new Error(
            'No API key configured. Run: lambda-cli config set apiKey <your-key>\n' +
            'Or set LAMBDA_API_KEY environment variable.\n' +
            'Get your key at: https://cloud.lambdalabs.com/api-keys'
        );
    }
    return key;
}

export function getConfigPath(): string {
    return config.path;
}
