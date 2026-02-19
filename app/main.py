from fastapi import FastAPI, Request, Response
from fastapi.responses import PlainTextResponse
from app.api.v1 import inspections, documents, telemetry
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST, Gauge
import time
import os
from redis.asyncio import Redis
from typing import Optional

app = FastAPI(title="Quality Control Monolith", version="0.1.0")

# Prometheus metrics
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
