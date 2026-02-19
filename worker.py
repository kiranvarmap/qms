#!/usr/bin/env python3
"""Simple worker that consumes items from Redis list 'worker:queue' and writes audit entries to Postgres.

This is intended for the Render background worker service in the MVP.
Environment variables expected:
- REDIS_URL (e.g. redis://localhost:6379)
- DATABASE_URL (Postgres connection string)

Run: python worker.py
"""
import os
import time
import signal
import sys
import logging
from app.db import get_session, engine
from app.models.orm_models import WorkerAudit, Inspection as InspectionORM
import redis

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger('worker')

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://qc_user:qc_pass@localhost:5432/qc_db')
QUEUE_KEY = 'worker:queue'
SHUTDOWN = False


def handle_signal(sig, frame):
    global SHUTDOWN
    logger.info('Received signal %s, shutting down gracefully...', sig)
    SHUTDOWN = True


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


# note: legacy psycopg2-based helpers removed; worker now uses SQLAlchemy ORM


def main():
    r = redis.from_url(REDIS_URL, decode_responses=True)

    # Use blocking loop to pop items
    logger.info('Worker started. Connecting to Redis: %s', REDIS_URL)

    # Ensure tables exist (simple helper) - for production use Alembic
    try:
        # create tables if they don't exist
        from app.db import Base
        Base.metadata.create_all(bind=engine)
    except Exception:
        logger.exception('Failed to create tables via SQLAlchemy')

    while not SHUTDOWN:
        try:
            item = r.lpop(QUEUE_KEY)
            if item:
                # process and write audit row via SQLAlchemy
                session = get_session()
                try:
                    logger.info('Processing item: %s', item)
                    ins = session.get(InspectionORM, item)
                    # Insert audit row with the raw item for now
                    audit = WorkerAudit(item=item)
                    session.add(audit)
                    session.commit()
                    logger.info('Inserted audit row for item: %s', item)
                finally:
                    session.close()
            else:
                # no item -> sleep briefly
                time.sleep(1)
        except Exception as e:
            logger.exception('Error in worker loop: %s', e)
            time.sleep(5)

    # graceful shutdown
    logger.info('Worker exiting, closing connections')
    try:
        r.close()
    except Exception:
        pass


if __name__ == '__main__':
    main()
