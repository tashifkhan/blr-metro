# Namma Metro

A journey planner for Bengaluru, built with Expo and FastAPI. Station names and fares come from the public BMRCL service. The API computes routes from line order.

- [Open the app](https://blr-metro.tashif.codes)
- [API documentation](https://blr-metro.tashif.codes/docs)
- [Source](https://github.com/tashifkhan/blr-metro)

The app has station search, line lists, an interactive network map, journey planning, Kannada station names, and BMRCL notices. Fares include token, smart card peak, smart card off-peak, and group tickets. It keeps saved catalogs and journeys for offline use and marks cached answers on screen.

BMRCL does not return travel times, first or last trains, gates, or platforms through this API. The app leaves those fields empty. Station lists have a checked-in fallback. Fare requests require the live BMRCL service.

## Run locally

Start the API:

```bash
cd api
uv sync --group dev
uv run uvicorn main:app --reload --port 8091
```

Start the app in another terminal:

```bash
cd app
bun install
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8091 bun run web
```

For a physical device, use your computer's LAN address in `app/.env`, then run `bun run start`.

## Verify

```bash
cd api
uv run pytest -q
cd ../app
bunx tsc --noEmit
bun run build:web
```

## Deploy to Vercel

Deploy from the repository root:

```bash
bunx vercel link --project blr-metro
bunx vercel --prod
```

`vercel.json` builds the Expo site in `app/` and the Python function in `api/`. API paths and Swagger documentation reach FastAPI before the site fallback. Other page URLs load the app, including direct links to a station or journey. The browser calls `/api/v1` on the same domain, so no API URL environment variable is needed on Vercel.

Cloudflare DNS points `blr-metro.tashif.codes` to the Vercel project through a DNS-only CNAME. Vercel serves HTTPS for the app and API. The `blr-metro.vercel.app` address also works.

The GitHub repository connects to the Vercel project. Pushes to `main` deploy to production. Other branches get preview deployments.

## Repository

- `api/` contains the BMRCL client, station catalog, route graph, fare cache, and tests.
- `app/` contains the Expo app and the web install manifest.
- `docs/bmrc-api.md` records the upstream API contract.
- `app/worker/` is an optional Cloudflare deployment path for an externally hosted API.

The app adapts the MIT-licensed [Delhi NCR Metro app](https://github.com/tashifkhan/delhi-metro).

## License

[MIT](LICENSE).
