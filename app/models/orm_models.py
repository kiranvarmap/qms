from sqlalchemy import Column, String, Integer, Text, DateTime
from sqlalchemy.sql import func
from app.db import Base


class Inspection(Base):
    __tablename__ = 'inspections'
    id = Column(String(64), primary_key=True, index=True)
    batch_id = Column(String(128), nullable=False)
    operator_id = Column(String(128), nullable=False)
    status = Column(String(32), nullable=False)
    defect_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkerAudit(Base):
    __tablename__ = 'worker_audit'
    id = Column(Integer, primary_key=True, autoincrement=True)
    item = Column(Text)
    processed_at = Column(DateTime(timezone=True), server_default=func.now())
