import { describe, it, expect } from 'vitest';
import { getConfig, setConfig } from '../src/config.js';

describe('Config', () => {
    describe('getConfig', () => {
        it('should return config object with expected shape', () => {
            const config = getConfig();
            expect(config).toBeDefined();
            expect(typeof config).toBe('object');
        });
    });

    describe('setConfig', () => {
        const originalValue = getConfig().defaultRegion;

        it('should set and retrieve a config value', () => {
            setConfig('defaultRegion', 'us-west-test');
            const config = getConfig();
            expect(config.defaultRegion).toBe('us-west-test');
            // Restore
            setConfig('defaultRegion', originalValue || 'us-east-3');
        });

        it('should not throw on valid keys', () => {
            expect(() => setConfig('defaultInstanceType', 'gpu_1x_a100')).not.toThrow();
        });
    });
});
