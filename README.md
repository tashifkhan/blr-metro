# blr-metro

A journey planner for Namma Metro. Separate from the Delhi app. One operator, one ticket, and the public BMRCL fare API.

- `api/` is a FastAPI service. It fetches the live station list and the live fare, and it builds the route from line order because BMRCL does not return one.
- `app/` is an Expo app. Plan, lines, the official maps, and the news list.
- `docs/bmrc-api.md` is the note on what the upstream actually returns.

There is no travel time. We do not have one. First and last trains are not in this API either.

## API

```bash
cd api
uv sync --group dev
uv run uvicorn main:app --reload --port 8081
uv run pytest
```

## App

```bash
cd app
bun install
# point a device at the local API
echo 'EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8091' > .env
bun run start
```

The web build talks to its own origin. A Worker in `app/worker` proxies `/api` at the FastAPI host named by `API_ORIGIN`.

```bash
cd app
bun run build:web
# wrangler deploy, after API_ORIGIN and the hostname in wrangler.jsonc are real
```
