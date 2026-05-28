# GBA CONSOLE

New CRM console SPA built with Vite, React, TypeScript, Mantine, and Onest.

## Local

```bash
npm install
npm run dev
```

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
