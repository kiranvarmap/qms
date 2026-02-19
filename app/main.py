from fastapi import FastAPI, Request, Response
from fastapi.responses import PlainTextResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1 import inspections, documents, telemetry
import time
import os
from typing import Optional

# Attempt to import prometheus_client but tolerate its absence at import time.
# This prevents a hard crash during startup if dependencies are out-of-sync
# (e.g., a build that didn't install the package yet). We provide simple
# no-op fallbacks so the rest of the app can run; the /metrics endpoint
# will return 503 when real metrics are not available.
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST, Gauge
    METRICS_AVAILABLE = True
except Exception:
    METRICS_AVAILABLE = False

    class _DummyMetric:
        def labels(self, *a, **k):
            return self

        def inc(self, *a, **k):
            return None

        def observe(self, *a, **k):
            return None

        def set(self, *a, **k):
            return None

    # Provide light-weight no-op replacements so code using metrics doesn't explode
    Counter = lambda *a, **k: _DummyMetric()
    Histogram = lambda *a, **k: _DummyMetric()
    Gauge = lambda *a, **k: _DummyMetric()

    def generate_latest():
        return b""

    CONTENT_TYPE_LATEST = "text/plain; version=0.0.4; charset=utf-8"

from redis.asyncio import Redis

app = FastAPI(title="Quality Control Monolith", version="0.1.0")

# mount dev UI static files at /ui
# Use an absolute path based on this file location so static files are found
# regardless of the process working directory (Render can change the CWD).
from pathlib import Path
_here = Path(__file__).resolve().parent
static_dir = str(_here / 'static')
app.mount("/ui", StaticFiles(directory=static_dir, html=True), name="ui")

# Prometheus metrics (real or no-op depending on availability)
REQUEST_COUNT = Counter('qc_requests_total', 'Total API requests', ['method', 'endpoint', 'http_status'])
REQUEST_LATENCY = Histogram('qc_request_latency_seconds', 'Request latency', ['endpoint'])
WORKER_QUEUE_LENGTH = Gauge('worker_queue_length', 'Approximate number of items in background worker queue')

# initial queue length (0)
WORKER_QUEUE_LENGTH.set(0)

# Redis client (for queue length)
redis_client: Optional[Redis] = None


@app.on_event("startup")
async def startup_event():
    global redis_client
    # Support both a REDIS_URL (Render-managed Redis) or REDIS_HOST/REDIS_PORT env vars
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        # when running on Render the managed Redis service commonly exposes a REDIS_URL
        try:
            redis_client = Redis.from_url(redis_url, decode_responses=True)
        except Exception:
            # fallback to host/port if parsing fails
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", "6379"))
            redis_client = Redis(host=redis_host, port=redis_port, decode_responses=True)
    else:
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = int(os.getenv("REDIS_PORT", "6379"))
        redis_client = Redis(host=redis_host, port=redis_port, decode_responses=True)


@app.on_event("shutdown")
async def shutdown_event():
    global redis_client
    if redis_client:
        await redis_client.close()


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    endpoint = request.url.path
    try:
        response: Response = await call_next(request)
        status_code = response.status_code
    except Exception as ex:
        status_code = 500
        raise
    finally:
        duration = time.time() - start_time
        REQUEST_LATENCY.labels(endpoint=endpoint).observe(duration)
        REQUEST_COUNT.labels(method=request.method, endpoint=endpoint, http_status=str(status_code)).inc()
    return response


@app.get('/metrics')
async def metrics():
    # Update queue length gauge from Redis before returning metrics
    try:
        if redis_client:
            length = await redis_client.llen('worker:queue')
            WORKER_QUEUE_LENGTH.set(int(length))
    except Exception:
        # If Redis not available, leave gauge as-is
        pass
    data = generate_latest()
    return PlainTextResponse(data.decode('utf-8'), media_type=CONTENT_TYPE_LATEST)


app.include_router(inspections.router, prefix="/api/v1/inspections", tags=["inspections"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(telemetry.router, prefix="/api/v1/telemetry", tags=["telemetry"])


@app.get("/")
async def root_redirect():
    """Redirect root to the interactive docs for convenience."""
    return RedirectResponse(url="/docs")


@app.get('/_dev/audit/latest')
async def latest_audit(n: int = 10):
    """Return the last `n` rows from worker_audit table. This is a dev-only
    convenience endpoint to verify worker processing and DB writes.
    """
    # Keep imports local to avoid import-time failures in environments
    # where psycopg2 isn't installed (we already guard health checks similarly).
    try:
        import os as _os
        import psycopg2 as _psycopg2
        DATABASE_URL = _os.getenv('DATABASE_URL')
        if not DATABASE_URL:
            return JSONResponse({'error': 'DATABASE_URL not configured'}, status_code=400)

        conn = _psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute('SELECT id, item, processed_at FROM worker_audit ORDER BY processed_at DESC LIMIT %s', (n,))
        rows = cur.fetchall()
        cur.close()
        conn.close()

        results = [{'id': r[0], 'item': r[1], 'processed_at': r[2].isoformat() if r[2] is not None else None} for r in rows]
        return JSONResponse(results)
    except Exception as ex:
        return JSONResponse({'error': str(type(ex).__name__), 'detail': str(ex)}, status_code=500)


@app.get("/healthz")
async def health():
    """Health endpoint that checks Redis and Postgres connectivity.

    Returns 200 when core dependencies respond, otherwise 503 with details.
    """
    checks = {"redis": "unknown", "database": "unknown"}
    status_code = 200

    # Redis check
    try:
        if redis_client:
            pong = await redis_client.ping()
            checks["redis"] = "ok" if pong else "error"
        else:
            checks["redis"] = "not-configured"
    except Exception as ex:
        checks["redis"] = f"error: {type(ex).__name__}"
        status_code = 503

    # Postgres check (lightweight)
    try:
        import os as _os
        import psycopg2 as _psycopg2
        DATABASE_URL = _os.getenv('DATABASE_URL')
        if DATABASE_URL:
            conn = _psycopg2.connect(DATABASE_URL, connect_timeout=3)
            cur = conn.cursor()
            cur.execute('SELECT 1')
            _ = cur.fetchone()
            cur.close()
            conn.close()
            checks["database"] = "ok"
        else:
            checks["database"] = "not-configured"
    except Exception as ex:
        checks["database"] = f"error: {type(ex).__name__}"
        status_code = 503

    return Response(content=str(checks), status_code=status_code)


# helper endpoints for testing queue length scaling (dev only)
@app.post('/_dev/queue/push')
async def dev_queue_push(item: str = "x"):
    """Push an item to the Redis-backed worker queue for testing autoscaling."""
    if not redis_client:
        return {'error': 'redis not configured'}
    await redis_client.rpush('worker:queue', item)
    length = await redis_client.llen('worker:queue')
    WORKER_QUEUE_LENGTH.set(int(length))
    return {'queue': length}


@app.post('/_dev/queue/pop')
async def dev_queue_pop():
    """Pop an item from the Redis-backed worker queue."""
    if not redis_client:
        return {'error': 'redis not configured'}
    item = await redis_client.lpop('worker:queue')
    length = await redis_client.llen('worker:queue')
    WORKER_QUEUE_LENGTH.set(int(length))
    return {'popped': item, 'queue': length}
