# Namma Metro app

Expo SDK 54 app with React Navigation, React Native Paper, and Material 3 colors. It runs on Android, iOS, and the web. Screens include journey planning, stations, lines, a network map, alerts, and appearance settings.

```bash
bun install
bun run start
```

Native builds use `https://blr-metro.tashif.codes` by default. Copy `.env.example` to `.env` to override the API for local development.

```bash
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8091 bun run web
bunx tsc --noEmit
bun run build:web
```

Vercel deploys the exported site and FastAPI together from the repository root. Web builds use the page origin for API requests. Leave `EXPO_PUBLIC_API_BASE_URL` unset in production.

The optional Cloudflare Worker in `worker/` proxies API requests to `API_ORIGIN` in `wrangler.jsonc`. Set that value before using `bun run deploy:web`.
