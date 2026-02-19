Quality Control System — Modular Monolith (FastAPI)

This scaffold is an opinionated starting point for the single-application modular monolith requested.

Features included in scaffold:
- FastAPI backend with modular routers (inspections, documents, telemetry)
- SQLAlchemy (Postgres) models and alembic-ready layout (simple SQL init script provided)
- S3-compatible attachments flow using presigned URLs (stub)
- Background worker pattern via FastAPI BackgroundTasks (simple) with discussion how to replace with Celery/Temporal
- Dockerfile and docker-compose for local dev (Postgres + MinIO + Redis)
- Helm chart skeleton for K8s deployment
- GitHub Actions CI template (lint, unit tests, build)

Render deployment (MVP) — quick checklist
----------------------------------------
This repo includes a `render.yaml` manifest (already in repo) and a GitHub Action to trigger Render service deploys.

Goal: get the web + worker running on Render using managed Postgres and Redis with minimal steps.

What you need to create in Render (the bare minimum):

- Managed Postgres (Render service) — Render will expose `DATABASE_URL` to your service.
- Managed Redis (Render service) — Render will expose `REDIS_URL` to your service.
- Web service (Docker) — service that runs the HTTP API (uses `uvicorn app.main:app ...` or the included Dockerfile).
- Worker service (Docker, background) — runs `python worker.py` as the start command.

Minimal secrets / environment variables to set (two places: GitHub secrets and Render service env vars):

1) GitHub repository secrets (for the included GitHub Action `render-deploy.yml`):
	- `RENDER_API_KEY` — your Render API key (create in Render dashboard -> Account -> API Keys)
	- `RENDER_SERVICE_ID_WEB` — the service ID for the web service (found in the Render service URL)
	- `RENDER_SERVICE_ID_WORKER` — the service ID for the worker service

2) Render service environment variables (set in each service's Settings -> Environment):
	- `DATABASE_URL` — provided automatically by Render for managed Postgres (no action needed)
	- `REDIS_URL` — provided automatically by Render for managed Redis (no action needed)
	- Optional (for S3 object storage): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT` (if using MinIO or a custom endpoint)
	- Optional production settings: `SECRET_KEY` (app secret), `RENDER_ENV=production`

Notes about Redis and the app
- The app will read `REDIS_URL` automatically if present (Render-managed Redis). If you prefer, you may instead set `REDIS_HOST` and `REDIS_PORT` env vars; the app supports both.

Deploy steps (fast path):

1) Connect your GitHub repository to Render and ensure `render.yaml` is present in the repository root.
2) In Render, create or import services from the `render.yaml` manifest. Confirm the web and worker services exist.
3) In your GitHub repo Settings -> Secrets add `RENDER_API_KEY`, `RENDER_SERVICE_ID_WEB`, and `RENDER_SERVICE_ID_WORKER`.
4) Push to `main` (or whichever branch your Action watches). The GitHub Action will call the Render API to trigger service deploys for the web and worker.

Health, metrics and verification
- Health endpoint: `GET /healthz` — checks Postgres and Redis and returns component statuses. Configure Render's health check path to `/healthz` (port 8000).
- Metrics endpoint: `GET /metrics` — Prometheus format; exposes `worker_queue_length` gauge used for autoscaling.

Initializing the database (migrations)
- Quick local initialization (dev):
```bash
docker-compose up -d
source .venv/bin/activate
pip install -r requirements.txt
python app/db_init.py
```

- On Render (one-off migration run): use a temporary one-off job or run the init command in a shell connected to the service (Render supports one-off jobs). The command to run is the same: `python app/db_init.py`.

Next steps I implemented for you now
- Health endpoint `{GET /healthz}` that checks both Redis and Postgres and returns 200/503 with details.
- Improved Redis support: the app accepts `REDIS_URL` (Render-managed) or `REDIS_HOST`/`REDIS_PORT`.
- A concise checklist of Render secrets and where to set them (this section).

If you'd like me to also:
- add Alembic migrations and a managed migration runner (I can generate migrations for the current schema and wire a `release` step), or
- create a small Render one-off Job definition that runs `python app/db_init.py` automatically on first deploy — tell me and I'll add it.
- add a `worker.py` example (a simple loop that consumes the Redis list and prints items) and wire the worker startCommand in `render.yaml` to run it.
 - add a `worker.py` example (a simple loop that consumes the Redis list, writes audit entries to Postgres, and logs) and wire the worker startCommand in `render.yaml` to run it. (Added)

Worker local test (dev)
-----------------------
1) Start dependencies:
```bash
docker-compose up -d
```

2) Run the worker locally (in a separate terminal):
```bash
python worker.py
```

3) Push a test item to the queue using the API or curl (app must be running):
```bash
curl -X POST "http://localhost:8000/_dev/queue/push?item=test1"
curl -X POST "http://localhost:8000/_dev/queue/push?item=test2"
```

4) Observe `worker.py` logs; the worker will LPOP the items and insert audit rows into the `worker_audit` table in Postgres.

Render verification
-------------------
When deployed to Render, the worker runs as the `qc-monolith-worker` background service. Verify:

- On Render dashboard, open Logs for `qc-monolith-worker` and confirm the worker started and connected to Redis/Postgres.
- Push items to the queue using the web service (or Redis CLI) and confirm worker processes them and logs appear in Render.

How to wire GitHub Actions to deploy specific Render services
----------------------------------------------------------
1) Find your Render service IDs:
	- In the Render dashboard open the service and look in the URL; the service ID is the value after `/services/`.
	- Or call the Render API to list services for your account: `curl -H "Authorization: Bearer $RENDER_API_KEY" https://api.render.com/v1/services`

2) In your GitHub repository Settings -> Secrets, create the following secrets:
	- `RENDER_API_KEY` (your Render API key)
	- `RENDER_SERVICE_ID_WEB` (service ID for `qc-monolith-web`)
	- `RENDER_SERVICE_ID_WORKER` (service ID for `qc-monolith-worker`)

3) The workflow `.github/workflows/render-deploy.yml` will use these secrets to trigger deploys for those services when you push to `main`.

If you don't provide service IDs, the workflow will skip deploys and you can rely on Render's repo auto-deploy feature instead.

