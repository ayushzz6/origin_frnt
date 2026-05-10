const API_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '');
const CSRF_COOKIE_NAME = 'origin_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeEndpoint(endpoint: string) {
    const [rawPath, ...queryParts] = endpoint.split('?');
    const path = rawPath || '/';
    const normalizedPath = path === '/' ? path : path.replace(/\/+$/, '');
    return queryParts.length ? `${normalizedPath}?${queryParts.join('?')}` : normalizedPath;
}

// Dispatched when the refresh token itself is expired — AuthContext listens and logs the user out
export const AUTH_EXPIRED_EVENT = 'origin:auth:expired';

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const prefix = `${name}=`;
    const match = document.cookie
        .split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function isMutatingMethod(method: string | undefined): boolean {
    return !SAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

async function attemptTokenRefresh(): Promise<boolean> {
    try {
        const response = await fetch(`${API_URL}/users/token/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            cache: 'no-store',
        });
        return response.ok;
    } catch {
        return false;
    }
}

async function ensureCsrfToken(method: string | undefined): Promise<void> {
    if (!isMutatingMethod(method) || readCookie(CSRF_COOKIE_NAME)) return;
    await attemptTokenRefresh();
}

function buildHeaders(method: string | undefined, body: BodyInit | null | undefined, overrides?: HeadersInit): Headers {
    const headers = new Headers(overrides);
    if (!(body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    if (isMutatingMethod(method) && !headers.has(CSRF_HEADER_NAME)) {
        const csrfToken = readCookie(CSRF_COOKIE_NAME);
        if (csrfToken) {
            headers.set(CSRF_HEADER_NAME, csrfToken);
        }
    }
    return headers;
}

function parseErrorMessage(errorData: Record<string, unknown>): string {
    if (errorData.detail) return String(errorData.detail);
    if (errorData.message) return String(errorData.message);
    if (errorData.non_field_errors) {
        const v = errorData.non_field_errors;
        return Array.isArray(v) ? String(v[0]) : String(v);
    }
    const firstKey = Object.keys(errorData)[0];
    if (firstKey) {
        const val = errorData[firstKey];
        const msg = Array.isArray(val) ? String(val[0]) : String(val);
        if (!msg.toLowerCase().includes(firstKey.toLowerCase())) {
            return `${firstKey}: ${msg}`;
        }
        return msg;
    }
    return 'API Request Failed';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiCall = async (
    endpoint: string, 
    options: RequestInit & { silentAuth?: boolean } = {}
): Promise<any> => {
    const { silentAuth, ...fetchOptions } = options;
    const { cache = 'no-store', ...requestOptions } = fetchOptions;
    const normalizedEndpoint = normalizeEndpoint(endpoint);

    await ensureCsrfToken(requestOptions.method);

    const doFetch = () =>
        fetch(`${API_URL}${normalizedEndpoint}`, {
            ...requestOptions,
            cache,
            credentials: 'include',
            headers: buildHeaders(requestOptions.method, requestOptions.body, options.headers),
        });

    let response = await doFetch();

    // On 401, try refreshing the access token once then retry
    if (response.status === 401) {
        const refreshed = await attemptTokenRefresh();
        if (refreshed) {
            response = await doFetch();
        } else {
            // Refresh failed — session is fully expired, force logout
            if (!silentAuth) {
                window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
            }
            throw new Error('Session expired. Please log in again.');
        }
    }

    if (!response.ok) {
        if (process.env.NODE_ENV === 'development') {
            console.error(`[API Error] ${response.status} ${normalizedEndpoint}`);
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(parseErrorMessage(errorData));
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
};
