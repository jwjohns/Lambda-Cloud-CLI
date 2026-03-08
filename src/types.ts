/**
 * Lambda Cloud API types
 */

export interface InstanceType {
    name: string;
    description: string;
    price_cents_per_hour: number;
    specs: {
        vcpus: number;
        memory_gib: number;
        storage_gib: number;
        gpus: number;
        gpu_description: string;
    };
}

export interface InstanceTypeAvailability {
    instance_type: InstanceType;
    regions_with_capacity_available: { name: string; description: string }[];
}

export interface Instance {
    id: string;
    name: string | null;
    ip: string | null;
    private_ip: string | null;
    status: 'booting' | 'active' | 'unhealthy' | 'terminated';
    ssh_key_names: string[];
    file_system_names: string[];
    region: { name: string; description: string };
    instance_type: InstanceType;
    hostname: string | null;
    jupyter_token: string | null;
    jupyter_url: string | null;
}

export interface SSHKey {
    id: string;
    name: string;
    public_key: string;
}

export interface FileSystem {
    id: string;
    name: string;
    created: string;
    mount_point: string;
    region: { name: string; description: string };
    is_in_use: boolean;
    bytes_used: number;
}

export interface LaunchRequest {
    region_name: string;
    instance_type_name: string;
    ssh_key_names: string[];
    file_system_names?: string[];
    quantity?: number;
    name?: string;
}

export interface LaunchResponse {
    instance_ids: string[];
}

export interface TerminateRequest {
    instance_ids: string[];
}

export interface ApiError {
    error: {
        code: string;
        message: string;
        suggestion?: string;
    };
}

export interface LambdaConfig {
    apiKey: string;
    defaultSshKey?: string;
    defaultRegion?: string;
    defaultInstanceType?: string;
    sshPrivateKeyPath?: string;
    wandbApiKey?: string;
}
