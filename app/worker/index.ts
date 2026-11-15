/**
 * Serves the Expo web build and proxies /api to the FastAPI origin.
 * Static files never reach this handler. API calls do, so the page stays
 * on one origin.
 */

interface Env {
  ASSETS: Fetcher;
  API_ORIGIN: string;
}

const FORWARDED = ['accept', 'accept-language', 'content-type', 'range', 'user-agent'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname, search } = new URL(request.url);
    const proxied =
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname === '/docs' ||
      pathname === '/redoc' ||
      pathname === '/openapi.json';

    if (proxied) {
      const upstreamUrl = new URL(pathname + search, env.API_ORIGIN);
      const headers = new Headers();
      for (const name of FORWARDED) {
        const value = request.headers.get(name);
        if (value !== null) {
          headers.set(name, value);
        }
      }
      try {
        const upstream = await fetch(upstreamUrl, {
          method: request.method,
          headers,
          body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
          redirect: 'follow',
        });
        const response = new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: new Headers(upstream.headers),
        });
        if (
          request.method === 'GET' &&
          response.ok &&
          response.headers.get('content-type')?.includes('application/json') &&
          !pathname.includes('/journeys/')
        ) {
          response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
        }
        return response;
      } catch {
        return Response.json(
          { detail: 'The metro API is unreachable right now.', upstream_status_code: null },
          { status: 502 },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
