export class PlatformClient {
    executionBaseUrl;
    email;
    password;
    sessionToken;
    sessionExpiresAt;
    constructor(config) {
        this.executionBaseUrl = config.executionBaseUrl.replace(/\/$/, '');
        this.email = config.email;
        this.password = config.password;
    }
    async getOverview() {
        return this.request('/mini/overview');
    }
    async listFields() {
        return this.request('/mini/fields');
    }
    async getFieldDetail(fieldId) {
        return this.request(`/mini/fields/${encodeURIComponent(fieldId)}`);
    }
    async listDevices(includeDemo = true) {
        const search = new URLSearchParams();
        if (includeDemo) {
            search.set('includeDemo', 'true');
        }
        return this.request(`/mini/devices?${search.toString()}`);
    }
    async getDeviceDetail(deviceId) {
        return this.request(`/mini/devices/${encodeURIComponent(deviceId)}`);
    }
    async listPlans() {
        return this.request('/mini/plans');
    }
    async getPlanDetail(planId) {
        return this.request(`/mini/plans/${encodeURIComponent(planId)}`);
    }
    async startPlan(planId) {
        return this.request(`/mini/plans/${encodeURIComponent(planId)}/start`, {
            method: 'POST',
        });
    }
    async stopPlan(planId) {
        return this.request(`/mini/plans/${encodeURIComponent(planId)}/stop`, {
            method: 'POST',
        });
    }
    async controlDevice(input) {
        return this.request(`/mini/devices/${encodeURIComponent(input.deviceId)}/control`, {
            method: 'POST',
            body: JSON.stringify({
                action: input.action,
                stationIndex: input.stationIndex,
                durationSeconds: input.durationSeconds ?? 60,
            }),
        });
    }
    async request(path, init) {
        const token = await this.getAccessToken();
        const response = await fetch(`${this.executionBaseUrl}${path}`, {
            ...init,
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
                ...(init?.headers ?? {}),
            },
        });
        const payload = (await response.json().catch(() => ({})));
        if (!response.ok) {
            throw new Error(payload.error ?? `Upstream request failed: ${response.status}`);
        }
        return payload.data;
    }
    async getAccessToken() {
        if (this.sessionToken && this.sessionExpiresAt && this.sessionExpiresAt > Date.now() + 60_000) {
            return this.sessionToken;
        }
        const response = await fetch(`${this.executionBaseUrl}/mini/auth/login`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                email: this.email,
                password: this.password,
            }),
        });
        const payload = (await response.json().catch(() => ({})));
        if (!response.ok || !payload.data?.accessToken) {
            throw new Error(payload.error ?? 'Platform login failed.');
        }
        this.sessionToken = payload.data.accessToken;
        this.sessionExpiresAt = payload.data.expiresAt ? Date.parse(payload.data.expiresAt) : Date.now() + 3600_000;
        return this.sessionToken;
    }
}
