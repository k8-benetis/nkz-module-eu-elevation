/**
 * EU Elevation Module API Client
 */

export interface BboxIngestRequest {
    country_code: string;
    bbox: [number, number, number, number];
    source_urls: string[];
}

export interface ProcessResponse {
    job_id: string;
    status: string;
    message: string;
}

export interface JobStatus {
    job_id: string;
    status: string;
    result?: Record<string, any>;
    error?: string;
}

class ElevationApiClient {
    private baseUrl = '/api/elevation';

    private getToken(): string | null {
        const auth = (window as any).__nekazariAuth;
        return auth?.token || null;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers = new Headers(options.headers || {});
        headers.set('Content-Type', 'application/json');

        const token = this.getToken();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API error: ${response.status}`);
        }

        return response.json();
    }

    async startIngestion(request: BboxIngestRequest): Promise<ProcessResponse> {
        return this.request('/ingest', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    async getJobStatus(jobId: string): Promise<JobStatus> {
        return this.request(`/status/${jobId}`);
    }
}

export const elevationApi = new ElevationApiClient();
