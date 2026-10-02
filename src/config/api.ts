/**
 * Production API Configuration
 * Always uses relative URLs (same-origin) by default so all API calls (/api/*)
 * route directly to the current domain (e.g. www.flowmakerai.site or custom server)
 * without leaking internal dev/staging URLs or triggering CORS errors.
 */

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customApi = (import.meta as any).env?.VITE_API_URL;
    if (customApi) {
      return customApi.replace(/\/$/, '');
    }
  }
  // Default: same-origin relative path (e.g. /api/users on https://www.flowmakerai.site)
  return '';
}

export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return `${base}${cleanPath}`;
}

