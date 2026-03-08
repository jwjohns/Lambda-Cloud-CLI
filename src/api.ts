/**
 * Lambda Cloud API client
 * Base URL: https://cloud.lambdalabs.com/api/v1/
 * Auth: Bearer token
 */

import type {
    Instance,
    InstanceTypeAvailability,
    SSHKey,
    FileSystem,
    LaunchRequest,
    LaunchResponse,
    TerminateRequest,
    ApiError,
} from './types.js';

const BASE_URL = 'https://cloud.lambda.ai/api/v1';

export class LambdaApi {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const url = `${BASE_URL}${path}`;
        const auth = Buffer.from(`${this.apiKey}:`).toString('base64');
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            const err = data as ApiError;
            throw new Error(
                `Lambda API error (${response.status}): ${err.error?.message || 'Unknown error'}` +
                (err.error?.suggestion ? `\nSuggestion: ${err.error.suggestion}` : '')
            );
        }

        return data as T;
    }

    // --- Instances ---

    async listInstances(): Promise<Instance[]> {
        const data = await this.request<{ data: Instance[] }>('/instances');
        return data.data;
    }

    async getInstance(id: string): Promise<Instance> {
        const data = await this.request<{ data: Instance }>(`/instances/${id}`);
        return data.data;
    }

    async listInstanceTypes(): Promise<InstanceTypeAvailability[]> {
        const data = await this.request<{ data: Record<string, InstanceTypeAvailability> }>('/instance-types');
        return Object.values(data.data);
    }

    async launchInstance(req: LaunchRequest): Promise<LaunchResponse> {
        const data = await this.request<{ data: LaunchResponse }>('/instance-operations/launch', {
            method: 'POST',
            body: JSON.stringify(req),
        });
        return data.data;
    }

    async terminateInstances(instanceIds: string[]): Promise<void> {
        await this.request<{ data: { terminated_instances: { id: string }[] } }>(
            '/instance-operations/terminate',
            {
                method: 'POST',
                body: JSON.stringify({ instance_ids: instanceIds } as TerminateRequest),
            }
        );
    }

    // --- SSH Keys ---

    async listSshKeys(): Promise<SSHKey[]> {
        const data = await this.request<{ data: SSHKey[] }>('/ssh-keys');
        return data.data;
    }

    async addSshKey(name: string, publicKey?: string): Promise<SSHKey & { private_key?: string }> {
        const body: Record<string, string> = { name };
        if (publicKey) body.public_key = publicKey;
        const data = await this.request<{ data: SSHKey & { private_key?: string } }>('/ssh-keys', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return data.data;
    }

    async deleteSshKey(id: string): Promise<void> {
        await this.request(`/ssh-keys/${id}`, { method: 'DELETE' });
    }

    // --- Filesystems ---

    async listFilesystems(): Promise<FileSystem[]> {
        const data = await this.request<{ data: FileSystem[] }>('/file-systems');
        return data.data;
    }

    async createFilesystem(name: string, region: string): Promise<FileSystem> {
        const data = await this.request<{ data: FileSystem }>('/file-systems', {
            method: 'POST',
            body: JSON.stringify({ name, region }),
        });
        return data.data;
    }

    // --- Utility ---

    /** Check if API key is valid */
    async validate(): Promise<boolean> {
        try {
            await this.listSshKeys();
            return true;
        } catch {
            return false;
        }
    }

    /** Find available regions for a specific instance type */
    async getAvailability(typeName: string): Promise<{ name: string; description: string }[]> {
        const types = await this.listInstanceTypes();
        const match = types.find(t => t.instance_type.name === typeName);
        return match?.regions_with_capacity_available ?? [];
    }
}
