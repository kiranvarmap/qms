"""Simple DB initialization helper for scaffold.

In production you'd use Alembic migrations. This script will create minimal tables for quick local testing.
"""
import os
import psycopg2

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://qc_user:qc_pass@localhost:5432/qc_db')

def init():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute('''
    CREATE TABLE IF NOT EXISTS inspections (
        id TEXT PRIMARY KEY,
        batch_id TEXT,
        operator_id TEXT,
        status TEXT,
        defect_count INT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT,
        current_version INT,
        status TEXT,
        created_at TIMESTAMP DEFAULT now()
    );
    ''')
    conn.commit()
    cur.close()
    conn.close()
    print('DB initialized')

if __name__ == '__main__':
    init()
