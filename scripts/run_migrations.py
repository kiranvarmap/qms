#!/usr/bin/env python3
"""Run Alembic migrations programmatically using the app's DATABASE_URL.

Usage:
  python scripts/run_migrations.py

This will read DATABASE_URL from the environment and run `alembic upgrade head`.
It's safe to run as a one-off Render job or during deployment to ensure schema is up-to-date.
"""
import os
import sys
from logging.config import fileConfig

from alembic.config import Config
from alembic import command


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(here, '..'))
    config_path = os.path.join(repo_root, 'alembic.ini')

    if not os.path.exists(config_path):
        print('alembic.ini not found; have you initialized alembic?')
        sys.exit(1)

    alembic_cfg = Config(config_path)

    # ensure Alembic uses the env DATABASE_URL or fall back to app.db's default
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        alembic_cfg.set_main_option('sqlalchemy.url', db_url)

    # configure logging from the ini file
    if alembic_cfg.config_file_name:
        fileConfig(alembic_cfg.config_file_name)

    print('Running alembic upgrade head against:', alembic_cfg.get_main_option('sqlalchemy.url'))
    command.upgrade(alembic_cfg, 'head')


if __name__ == '__main__':
    main()
