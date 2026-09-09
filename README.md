# PLUMBLINE

Validation-driven field management for ICF construction crews. PLUMBLINE combines job and task tracking, field validation checklists, progress dashboards, exports, a live crew feed, and an optional BYOK AI assistant.

## Run locally

```bash
cp .env.example .env
docker compose up --build -d
curl http://127.0.0.1:3003/healthz
```

Open `http://localhost:3003`. The frontend proxies `/api` to the FastAPI service, and MongoDB data is stored in the `plumbline-mongo` volume.

## Production

The included Compose stack binds the web container to loopback on port 3003. `deployment/traefik-plumbline.yml` contains the matching Traefik file-provider route for:

```text
https://plumbline.srv1427612.hstgr.cloud
```

Copy that file into Traefik's watched dynamic configuration directory, then start the Compose stack.

## AI providers

AI features are optional. A manager can configure an OpenAI, Anthropic, or Google Gemini API key in **Admin → AI Settings**. Keys are stored in the application's MongoDB database; use this only on a trusted deployment and protect access appropriately.
