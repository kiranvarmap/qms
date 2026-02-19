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
import psycopg2
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


def ensure_audit_table(conn):
    cur = conn.cursor()
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS worker_audit (
            id SERIAL PRIMARY KEY,
            item TEXT,
            processed_at TIMESTAMP DEFAULT now()
        );
        '''
    )
    conn.commit()
    cur.close()


def process_item(item, conn):
    # Placeholder for real processing logic: parse item, call APIs, update records, etc.
    logger.info('Processing item: %s', item)
    cur = conn.cursor()
    cur.execute('INSERT INTO worker_audit(item) VALUES (%s)', (item,))
    conn.commit()
    cur.close()


def main():
    r = redis.from_url(REDIS_URL, decode_responses=True)

    # Use blocking loop to pop items
    logger.info('Worker started. Connecting to Redis: %s', REDIS_URL)

    # Establish DB connection once and reuse
    conn = None
    while not SHUTDOWN:
        try:
            if conn is None:
                conn = psycopg2.connect(DATABASE_URL)
                ensure_audit_table(conn)

            item = r.lpop(QUEUE_KEY)
            if item:
                process_item(item, conn)
            else:
                # no item -> sleep briefly
                time.sleep(1)
        except Exception as e:
            logger.exception('Error in worker loop: %s', e)
            # close and retry connection after short backoff
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
            conn = None
            time.sleep(5)

    # graceful shutdown
    logger.info('Worker exiting, closing connections')
    try:
        if conn:
            conn.close()
    except Exception:
        pass
    try:
        r.close()
    except Exception:
        pass


if __name__ == '__main__':
    main()
