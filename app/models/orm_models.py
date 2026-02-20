from sqlalchemy import (
    Column, String, Integer, Text, DateTime, Boolean, ForeignKey
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db import Base


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------
class Product(Base):
    __tablename__ = 'products'
    id = Column(String(64), primary_key=True, index=True)
    sku = Column(String(128), unique=True, nullable=True)
    name = Column(String(256), nullable=False)
    category = Column(String(128), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    batches = relationship('Batch', back_populates='product')


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------
class Batch(Base):
    __tablename__ = 'batches'
    id = Column(String(64), primary_key=True, index=True)
    product_id = Column(String(64), ForeignKey('products.id'), nullable=True)
    batch_number = Column(String(128), unique=True, nullable=False)
    quantity = Column(Integer, default=0)
    production_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(String(32), nullable=True)
    status = Column(String(32), default='active', nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship('Product', back_populates='batches')
    inspections = relationship('Inspection', back_populates='batch')


# ---------------------------------------------------------------------------
# Operators
# ---------------------------------------------------------------------------
class Operator(Base):
    __tablename__ = 'operators'
    id = Column(String(64), primary_key=True, index=True)
    employee_id = Column(String(64), unique=True, nullable=True)
    name = Column(String(256), nullable=False)
    email = Column(String(256), unique=True, nullable=True)
    department = Column(String(128), nullable=True)
    role = Column(String(64), nullable=False, default='operator')
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspections = relationship('Inspection', back_populates='operator')
    signatures = relationship('Signature', back_populates='signer')


# ---------------------------------------------------------------------------
# Defect Catalogue
# ---------------------------------------------------------------------------
class DefectType(Base):
    __tablename__ = 'defect_types'
    id = Column(String(64), primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(32), nullable=False, default='minor')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection_defects = relationship('InspectionDefect', back_populates='defect_type')


# ---------------------------------------------------------------------------
# Inspections (upgraded)
# ---------------------------------------------------------------------------
class Inspection(Base):
    __tablename__ = 'inspections'
    id = Column(String(64), primary_key=True, index=True)
    # Legacy plain-text fields (original schema)
    batch_id = Column(String(128), nullable=True)
    operator_id = Column(String(128), nullable=True)
    # FK references to new tables (added in migration 0002)
    batch_id_fk = Column('batch_id_fk', String(64), ForeignKey('batches.id'), nullable=True)
    operator_id_fk = Column('operator_id_fk', String(64), ForeignKey('operators.id'), nullable=True)
    batch_id_text = Column(String(128), nullable=True)
    operator_id_text = Column(String(128), nullable=True)
    status = Column(String(32), nullable=False, default='pending')
    defect_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    severity = Column(String(32), nullable=True, default='minor')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    batch = relationship('Batch', back_populates='inspections')
    operator = relationship('Operator', back_populates='inspections')
    defects = relationship('InspectionDefect', back_populates='inspection')
    signatures = relationship('Signature', back_populates='inspection')


# ---------------------------------------------------------------------------
# Inspection <-> Defect  (many-to-many join)
# ---------------------------------------------------------------------------
class InspectionDefect(Base):
    __tablename__ = 'inspection_defects'
    id = Column(Integer, primary_key=True, autoincrement=True)
    inspection_id = Column(String(64), ForeignKey('inspections.id'), nullable=False)
    defect_type_id = Column(String(64), ForeignKey('defect_types.id'), nullable=False)
    quantity = Column(Integer, default=1)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection = relationship('Inspection', back_populates='defects')
    defect_type = relationship('DefectType', back_populates='inspection_defects')


# ---------------------------------------------------------------------------
# Signatures
# ---------------------------------------------------------------------------
class Signature(Base):
    __tablename__ = 'signatures'
    id = Column(Integer, primary_key=True, autoincrement=True)
    inspection_id = Column(String(64), ForeignKey('inspections.id'), nullable=False)
    signer_id = Column(String(64), ForeignKey('operators.id'), nullable=True)
    signer_name = Column(String(256), nullable=False)
    signer_role = Column(String(64), nullable=False)
    ip_address = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    signed_at = Column(DateTime(timezone=True), server_default=func.now())
    revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by = Column(String(256), nullable=True)

    inspection = relationship('Inspection', back_populates='signatures')
    signer = relationship('Operator', back_populates='signatures')


# ---------------------------------------------------------------------------
# Auth Users
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = 'users'
    id = Column(String(64), primary_key=True, index=True)
    username = Column(String(128), unique=True, nullable=False)
    email = Column(String(256), unique=True, nullable=True)
    hashed_password = Column(String(256), nullable=False)
    full_name = Column(String(256), nullable=True)
    role = Column(String(64), nullable=False, default='operator')
    # approval_status: pending | approved | rejected
    approval_status = Column(String(32), nullable=False, default='approved')
    approved_by = Column(String(64), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Sign-off Documents (for batch PDF sign-off flows)
# ---------------------------------------------------------------------------
class SignoffDocument(Base):
    __tablename__ = 'signoff_documents'
    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    batch_id = Column(String(64), nullable=True)
    batch_number = Column(String(128), nullable=True)
    created_by = Column(String(64), nullable=True)
    created_by_name = Column(String(256), nullable=True)
    # overall status: draft | in_progress | complete | rejected
    status = Column(String(32), nullable=False, default='draft')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sign_requests = relationship('SignRequest', back_populates='document', cascade='all, delete-orphan')


# ---------------------------------------------------------------------------
# Sign Requests (assigned to specific users/roles)
# ---------------------------------------------------------------------------
class SignRequest(Base):
    __tablename__ = 'sign_requests'
    id = Column(String(64), primary_key=True, index=True)
    document_id = Column(String(64), ForeignKey('signoff_documents.id', ondelete='CASCADE'), nullable=False)
    # assigned to a user
    assigned_to_id = Column(String(64), nullable=True)
    assigned_to_name = Column(String(256), nullable=False)
    assigned_to_role = Column(String(64), nullable=False, default='operator')
    assigned_to_email = Column(String(256), nullable=True)
    # order in which they must sign
    sign_order = Column(Integer, default=1)
    # status: pending | signed | rejected | skipped
    status = Column(String(32), nullable=False, default='pending')
    signed_at = Column(DateTime(timezone=True), nullable=True)
    signed_by_ip = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship('SignoffDocument', back_populates='sign_requests')


# ---------------------------------------------------------------------------
# Worker Audit (existing)
# ---------------------------------------------------------------------------
class WorkerAudit(Base):
    __tablename__ = 'worker_audit'
    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(128), nullable=True)
    inspection_id = Column(String(64), nullable=True)
    worker_id = Column(String(128), nullable=True)
    status = Column(String(32), nullable=True)
    message = Column(Text, nullable=True)
    payload = Column(Text, nullable=True)
    item = Column(Text, nullable=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
