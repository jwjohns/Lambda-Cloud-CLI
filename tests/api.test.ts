import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LambdaApi } from '../src/api.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockResponse(data: any, ok = true, status = 200) {
    return {
        ok,
        status,
        json: () => Promise.resolve(data),
    };
}

describe('LambdaApi', () => {
    let api: LambdaApi;

    beforeEach(() => {
        api = new LambdaApi('test_api_key_123');
        mockFetch.mockReset();
    });

    describe('constructor', () => {
        it('should create an instance with API key', () => {
            expect(api).toBeDefined();
        });
    });

    describe('listInstances', () => {
        it('should return instances array', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({
                data: [
                    { id: 'inst-1', name: 'my-gpu', status: 'active', ip: '1.2.3.4' },
                    { id: 'inst-2', name: 'other', status: 'booting', ip: null },
                ]
            }));

            const result = await api.listInstances();
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('inst-1');
            expect(result[0].status).toBe('active');
            expect(result[1].ip).toBeNull();
        });

        it('should return empty array when no instances', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({ data: [] }));
            const result = await api.listInstances();
            expect(result).toEqual([]);
        });

        it('should use Basic auth with base64 key', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({ data: [] }));
            await api.listInstances();

            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toBe('https://cloud.lambda.ai/api/v1/instances');
            const expectedAuth = Buffer.from('test_api_key_123:').toString('base64');
            expect(opts.headers['Authorization']).toBe(`Basic ${expectedAuth}`);
        });
    });

    describe('getInstance', () => {
        it('should return a single instance', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({
                data: { id: 'inst-1', name: 'gpu-box', status: 'active', ip: '10.0.0.1' }
            }));

            const result = await api.getInstance('inst-1');
            expect(result.id).toBe('inst-1');
            expect(result.ip).toBe('10.0.0.1');
        });
    });

    describe('listInstanceTypes', () => {
        it('should return instance types with availability', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({
                data: {
                    'gpu_1x_gh200': {
                        instance_type: {
                            name: 'gpu_1x_gh200',
                            price_cents_per_hour: 199,
                            specs: { gpus: 1, vcpus: 64, memory_gib: 432, storage_gib: 4096 },
                        },
                        regions_with_capacity_available: [{ name: 'us-east-3', description: 'US East' }],
                    },
                    'gpu_1x_h100_sxm5': {
                        instance_type: {
                            name: 'gpu_1x_h100_sxm5',
                            price_cents_per_hour: 378,
                            specs: { gpus: 1, vcpus: 26, memory_gib: 225, storage_gib: 2816 },
                        },
                        regions_with_capacity_available: [],
                    }
                }
            }));

            const result = await api.listInstanceTypes();
            expect(result).toHaveLength(2);
            const gh200 = result.find(t => t.instance_type.name === 'gpu_1x_gh200');
            expect(gh200?.regions_with_capacity_available).toHaveLength(1);
            expect(gh200?.regions_with_capacity_available[0].name).toBe('us-east-3');
        });
    });

    describe('launchInstance', () => {
        it('should POST launch request and return instance IDs', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({
                data: { instance_ids: ['inst-new-1'] }
            }));

            const result = await api.launchInstance({
                instance_type_name: 'gpu_1x_gh200',
                region_name: 'us-east-3',
                ssh_key_names: ['my-key'],
            });

            expect(result.instance_ids).toEqual(['inst-new-1']);
            const [, opts] = mockFetch.mock.calls[0];
            expect(opts.method).toBe('POST');
            const body = JSON.parse(opts.body);
            expect(body.instance_type_name).toBe('gpu_1x_gh200');
        });
    });

    describe('terminateInstances', () => {
        it('should POST terminate request', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({
                data: { terminated_instances: [{ id: 'inst-1' }] }
            }));

            await api.terminateInstances(['inst-1']);
            const [url, opts] = mockFetch.mock.calls[0];
            expect(url).toContain('/instance-operations/terminate');
            expect(opts.method).toBe('POST');
            const body = JSON.parse(opts.body);
            expect(body.instance_ids).toEqual(['inst-1']);
        });
    });

    describe('listSshKeys', () => {
        it('should return SSH keys', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({
                data: [{ id: 'key-1', name: 'my-key', public_key: 'ssh-ed25519 AAAA...' }]
            }));

            const result = await api.listSshKeys();
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('my-key');
        });
    });

    describe('getAvailability', () => {
        it('should return available regions for a type', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({
                data: {
                    'gpu_1x_gh200': {
                        instance_type: { name: 'gpu_1x_gh200', price_cents_per_hour: 199, specs: {} },
                        regions_with_capacity_available: [{ name: 'us-east-3', description: 'US East' }],
                    }
                }
            }));

            const result = await api.getAvailability('gpu_1x_gh200');
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('us-east-3');
        });

        it('should return empty array for unknown type', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({ data: {} }));
            const result = await api.getAvailability('gpu_99x_fake');
            expect(result).toEqual([]);
        });
    });

    describe('validate', () => {
        it('should return true for valid key', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse({ data: [] }));
            const result = await api.validate();
            expect(result).toBe(true);
        });

        it('should return false for invalid key', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(
                { error: { message: 'Unauthorized' } }, false, 401
            ));
            const result = await api.validate();
            expect(result).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should throw on API error with message', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(
                { error: { message: 'Rate limited', suggestion: 'Try again later' } },
                false, 429
            ));

            await expect(api.listInstances()).rejects.toThrow('Rate limited');
        });

        it('should include suggestion in error', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(
                { error: { message: 'Bad request', suggestion: 'Check your params' } },
                false, 400
            ));

            await expect(api.listInstances()).rejects.toThrow('Check your params');
        });
    });
});
