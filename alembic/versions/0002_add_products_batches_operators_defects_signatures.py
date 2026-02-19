"""add products batches operators defect_types inspection_defects signatures users

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'products',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('sku', sa.String(128), nullable=False, unique=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('category', sa.String(128), nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'batches',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('product_id', sa.String(64), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('batch_number', sa.String(128), nullable=False, unique=True),
        sa.Column('quantity', sa.Integer, default=0),
        sa.Column('production_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'operators',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('employee_id', sa.String(64), nullable=False, unique=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('email', sa.String(256), nullable=True, unique=True),
        sa.Column('department', sa.String(128), nullable=True),
        sa.Column('role', sa.String(64), nullable=False, server_default='operator'),
        sa.Column('active', sa.Boolean, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'defect_types',
        sa.Column('id', sa.String(64), primary_key=True),
        sa.Column('code', sa.String(64), nullable=False, unique=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('severity', sa.String(32), nullable=False, server_default='minor'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

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

    # Add new columns to inspections
    op.add_column('inspections', sa.Column('batch_id_fk', sa.String(64), sa.ForeignKey('batches.id'), nullable=True))
    op.add_column('inspections', sa.Column('operator_id_fk', sa.String(64), sa.ForeignKey('operators.id'), nullable=True))
    op.add_column('inspections', sa.Column('batch_id_text', sa.String(128), nullable=True))
    op.add_column('inspections', sa.Column('operator_id_text', sa.String(128), nullable=True))
    op.add_column('inspections', sa.Column('severity', sa.String(32), nullable=True, server_default='minor'))
    op.add_column('inspections', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()))

    op.create_table(
        'inspection_defects',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('inspection_id', sa.String(64), sa.ForeignKey('inspections.id'), nullable=False),
        sa.Column('defect_type_id', sa.String(64), sa.ForeignKey('defect_types.id'), nullable=False),
        sa.Column('quantity', sa.Integer, default=1),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'signatures',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('inspection_id', sa.String(64), sa.ForeignKey('inspections.id'), nullable=False),
        sa.Column('signer_id', sa.String(64), sa.ForeignKey('operators.id'), nullable=True),
        sa.Column('signer_name', sa.String(256), nullable=False),
        sa.Column('signer_role', sa.String(64), nullable=False),
        sa.Column('ip_address', sa.String(64), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('revoked', sa.Boolean, server_default=sa.false()),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_by', sa.String(256), nullable=True),
    )


def downgrade():
    op.drop_table('signatures')
    op.drop_table('inspection_defects')
    op.drop_column('inspections', 'updated_at')
    op.drop_column('inspections', 'severity')
    op.drop_column('inspections', 'operator_id_text')
    op.drop_column('inspections', 'batch_id_text')
    op.drop_column('inspections', 'operator_id_fk')
    op.drop_column('inspections', 'batch_id_fk')
    op.drop_table('users')
    op.drop_table('defect_types')
    op.drop_table('operators')
    op.drop_table('batches')
    op.drop_table('products')
