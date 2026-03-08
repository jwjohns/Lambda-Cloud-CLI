import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfig, getApiKey, setConfig } from '../src/config.js';

describe('Config', () => {
    describe('getConfig', () => {
        it('should return config object', () => {
            const config = getConfig();
            expect(config).toBeDefined();
            expect(typeof config).toBe('object');
        });

        it('should have expected keys', () => {
            const config = getConfig();
            // Config should be an object with possible keys
            expect(config).toHaveProperty('apiKey');
        });
    });

    describe('getApiKey', () => {
        it('should return a string or empty', () => {
            const key = getApiKey();
            expect(typeof key).toBe('string');
        });
    });

    describe('setConfig', () => {
        const originalValue = getConfig().defaultRegion;

        afterEach(() => {
            // Restore original value
            if (originalValue) {
                setConfig('defaultRegion', originalValue);
            }
        });

        it('should set and retrieve a config value', () => {
            setConfig('defaultRegion', 'us-west-2');
            const config = getConfig();
            expect(config.defaultRegion).toBe('us-west-2');
        });

        it('should accept string keys', () => {
            expect(() => setConfig('defaultInstanceType', 'gpu_1x_a100')).not.toThrow();
        });
    });
});
