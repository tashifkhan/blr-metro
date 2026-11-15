import { Platform } from 'react-native';

/**
 * Runtime configuration.
 *
 * The default points at the local FastAPI process (no version suffix).
 * Routes include their own `/api/v1` prefix.
 *
 * A localhost default is not reachable from a physical device or a release
 * build, so set `EXPO_PUBLIC_API_BASE_URL` in `app/.env` to the deployed
 * origin; see `.env.example`.
 */

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8091';

/**
 * Normalize a configured base so path joining never doubles a trailing slash
 * or repeats a prefix that the service paths already carry.
 *
 * Every service path starts with `/api/v1`, so the base must be an origin.
 * Two things get pasted in by mistake: `/api/v1` from older env files, and
 * `/api` from a public URL where the Worker proxies it. Left in, either one
 * builds `/api/api/v1/...`, which the API answers with a 404.
 */
function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.replace(/\/api(\/v\d+)?$/i, '');
}

/**
 * On the web the app is served by a Worker that also reverse-proxies `/api/*`
 * to the backend, so the page's own origin is the API origin. Calling the
 * Vercel host directly from the browser would be a cross-origin request the
 * API does not allow.
 */
function resolveApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) {
    return normalizeApiBaseUrl(configured);
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return DEFAULT_API_BASE_URL;
}

export const env = {
  apiBaseUrl: resolveApiBaseUrl(),
} as const;
