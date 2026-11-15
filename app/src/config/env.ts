import { Platform } from 'react-native';

/**
 * Runtime configuration.
 *
 * Native builds default to the production API origin, with no version suffix.
 * Routes include their own `/api/v1` prefix.
 *
 * Set `EXPO_PUBLIC_API_BASE_URL` in `app/.env` for local device development.
 * Web builds use their own origin unless this variable is set.
 */

const DEFAULT_API_BASE_URL = 'https://blr-metro.tashif.codes';

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
 * Vercel serves the web app and `/api/*` from one origin. The optional
 * Cloudflare Worker also proxies those paths to its configured API origin.
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
