const rawBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
const baseUrl = rawBaseUrl
  ? rawBaseUrl.endsWith('/api')
    ? rawBaseUrl.replace(/\/+$|^\s+|\s+$/g, '')
    : `${rawBaseUrl.replace(/\/+$|^\s+|\s+$/g, '')}/api`
  : '/api';

function buildUrl(path, params) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;
  if (!params || Object.keys(params).length === 0) return url;

  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
    } else {
      search.append(key, String(value));
    }
  });
  return `${url}?${search.toString()}`;
}

export async function apiRequest(path, { method = 'GET', body, token, params } = {}) {
  const res = await fetch(buildUrl(path, params), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : null),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

