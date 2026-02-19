"""create inspections and worker_audit tables

Revision ID: 0001_create_inspections_and_worker_audit
Revises: 
Create Date: 2026-02-19 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0001_create_inspections_and_worker_audit'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'inspections',
        sa.Column('id', sa.String(length=64), primary_key=True, nullable=False),
        sa.Column('batch_id', sa.String(length=128), nullable=False),
        sa.Column('operator_id', sa.String(length=128), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('defect_count', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )

    op.create_table(
        'worker_audit',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('item', sa.Text(), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )


def downgrade():
    op.drop_table('worker_audit')
    op.drop_table('inspections')
