This folder contains Alembic migration configuration used by
`scripts/run_migrations.py`.

How it works:
- `alembic/env.py` imports `app.db.Base` to discover models' metadata.
- `scripts/run_migrations.py` sets the `sqlalchemy.url` from the `DATABASE_URL`
  environment variable and runs `alembic upgrade head`.

Notes:
- For now the project uses SQLAlchemy's `Base.metadata` to create tables when
  the worker starts; you should generate proper alembic revisions before
  applying to production.
- To create a new revision locally run:

  python -m alembic revision --autogenerate -m "create inspections"

  and then inspect the generated script under `alembic/versions/`.
