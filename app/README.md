# Namma Metro app

Expo Router app for the API in `../api`. Expo SDK 58, `@expo/ui` for buttons, lists, the search field, and the map switch, Material 3 color roles. Tabs are Plan, Lines, Map, and News.

```bash
bun install
cp .env.example .env   # optional, for a device pointed at a local API
bun run start
```

Web export and the Worker:

```bash
bun run build:web
bun run preview:web
```

`API_ORIGIN` in `wrangler.jsonc` is the FastAPI host. Set it before `bun run deploy:web`. The hostname is not pinned yet. Do not hang this off `ncr-metro.tashif.codes`.

On web, leave `EXPO_PUBLIC_API_BASE_URL` unset. The page calls its own origin, and the Worker proxies `/api`.
