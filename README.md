# GBA CONSOLE

New CRM console SPA built with Vite, React, TypeScript, Mantine, and Onest.

## Local

```bash
npm install
npm run dev
```

By default, the local console connects to the shared dev API and Analytics.
Reports and history use **Analytics**, a separate server from the main API.
Updating or starting only the main API does not update or start the report server.

To use both backends locally, create `.env.local` in this repository:

```dotenv
VITE_API_BASE_URL=/
VITE_API_LANGUAGE=uk
VITE_DEV_API_PROXY_TARGET=http://localhost:35981
VITE_DEV_HISTORY_PROXY_TARGET=http://localhost:35982
VITE_REALTIME_BASE_URL=/
```

These ports match the `Global.Business.Assistant.Api` and
`Global.Business.Assistant.Analytics` launch profiles in `gba-server`.
Start both projects with the intended local configuration and restart
`npm run dev` after changing `.env.local`. Existing shell environment variables
take precedence over dotenv files. Keep `VITE_API_BASE_URL=/` to use Vite's
separate API and Analytics routes; an absolute backend URL bypasses the proxy.

If reports fail immediately on opening the page, check the failed request in
browser Network and the Vite/Analytics logs:

- `/api/v1/uk/report/datasets` and `/report/catalogue` load the constructor's
  definitions. `/report/templates` loads saved templates.
- A Vite connection error or a gateway 502/504 points to the configured upstream
  and service availability; a 500/503 from Analytics needs its matching log entry.
- Pulling commits does not apply SQL migrations to a separate local database.
  If Analytics logs a missing SQL object, identify that object and the relevant
  migration first. The `SourceReports` migrations concern register publications;
  they are not a general fix for every constructor error.

## Checks

```bash
npm run lint
npm run build
```

## Dev Deployment

The dev deployment is wired from `gba-infra` as service `gba-console`.

```bash
cd /root/projects/gba-infra
docker compose -p gba-dev -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up -d --build gba-console
docker exec gba-prod-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

URL: https://gba-console-dev.85.17.167.167.nip.io/
