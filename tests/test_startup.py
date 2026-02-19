from fastapi.testclient import TestClient
import os


def test_app_import_and_health():
    # Ensure environment is in a minimal state for the test
    # Remove DATABASE_URL and REDIS_URL to exercise 'not-configured' branches
    os.environ.pop('DATABASE_URL', None)
    os.environ.pop('REDIS_URL', None)

    # Import the app and run a simple health check
    from app.main import app, METRICS_AVAILABLE

    client = TestClient(app)

    r = client.get('/healthz')
    assert r.status_code == 200
    assert isinstance(r.text, str)

    # Metrics endpoint must not crash on import; it may be 200 or 503 depending
    # on whether prometheus_client is present. We assert it's a valid response.
    r2 = client.get('/metrics')
    assert r2.status_code in (200, 503)
