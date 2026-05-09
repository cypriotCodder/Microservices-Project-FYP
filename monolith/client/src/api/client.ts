export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchFromAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;

    const userStr = localStorage.getItem('user');
    const token = userStr ? JSON.parse(userStr).token : null;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'API request failed');
    }

    return response.json();
}
