"""ensure users table and fix nullable constraints

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return inspect(bind).has_table(name)


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    cols = [c['name'] for c in inspect(bind).get_columns(table)]
    return column in cols


def upgrade():
    # --- users table (safe: only create if missing) ---
    if not _table_exists('users'):
        op.create_table(
            'users',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('username', sa.String(128), nullable=False, unique=True),
            sa.Column('hashed_password', sa.String(256), nullable=False),
            sa.Column('full_name', sa.String(256), nullable=True),
            sa.Column('role', sa.String(64), nullable=False, server_default='operator'),
            sa.Column('active', sa.Boolean, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # --- products: make sku nullable so products can be created without one ---
    if _table_exists('products') and _column_exists('products', 'sku'):
        op.alter_column('products', 'sku', nullable=True)

    # --- operators: make employee_id nullable ---
    if _table_exists('operators') and _column_exists('operators', 'employee_id'):
        op.alter_column('operators', 'employee_id', nullable=True)

    # --- batches: add expiry_date and status columns if missing ---
    if _table_exists('batches'):
        if not _column_exists('batches', 'expiry_date'):
            op.add_column('batches', sa.Column('expiry_date', sa.String(32), nullable=True))
        if not _column_exists('batches', 'status'):
            op.add_column('batches', sa.Column('status', sa.String(32), server_default='active', nullable=True))

    # --- inspections: add severity / updated_at if migration 0002 failed partially ---
    if _table_exists('inspections'):
        if not _column_exists('inspections', 'severity'):
            op.add_column('inspections', sa.Column('severity', sa.String(32), server_default='minor', nullable=True))
        if not _column_exists('inspections', 'updated_at'):
            op.add_column('inspections', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))

    # --- inspection_defects: create if missing ---
    if not _table_exists('inspection_defects'):
        op.create_table(
            'inspection_defects',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('inspection_id', sa.String(64), sa.ForeignKey('inspections.id'), nullable=False),
            sa.Column('defect_type_id', sa.String(64), nullable=False),
            sa.Column('quantity', sa.Integer, server_default='1'),
            sa.Column('notes', sa.Text, nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # --- signatures: create if missing ---
    if not _table_exists('signatures'):
        op.create_table(
            'signatures',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('inspection_id', sa.String(64), sa.ForeignKey('inspections.id'), nullable=False),
            sa.Column('signer_id', sa.String(64), nullable=True),
            sa.Column('signer_name', sa.String(256), nullable=False),
            sa.Column('signer_role', sa.String(64), nullable=False),
            sa.Column('ip_address', sa.String(64), nullable=True),
            sa.Column('signed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column('revoked', sa.Boolean, server_default=sa.false()),
            sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('revoked_by', sa.String(256), nullable=True),
        )

    # --- defect_types: create if missing ---
    if not _table_exists('defect_types'):
        op.create_table(
            'defect_types',
            sa.Column('id', sa.String(64), primary_key=True),
            sa.Column('code', sa.String(64), nullable=True),
            sa.Column('name', sa.String(256), nullable=False),
            sa.Column('description', sa.Text, nullable=True),
            sa.Column('severity', sa.String(32), server_default='minor', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade():
    pass
