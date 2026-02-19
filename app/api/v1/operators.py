from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import select, func
from app.db import get_session
from app.models.orm_models import Operator, Inspection
import uuid

router = APIRouter()


class OperatorIn(BaseModel):
    employee_id: Optional[str] = None
    name: str
    email: Optional[str] = None
    department: Optional[str] = None
    role: str = "operator"


class OperatorOut(BaseModel):
    id: str
    employee_id: Optional[str]
    name: str
    email: Optional[str]
    department: Optional[str]
    role: str
    active: bool
    created_at: Optional[str]
    inspection_count: Optional[int] = 0
    pass_rate: Optional[float] = None


@router.get("/", response_model=List[OperatorOut])
def list_operators():
    session = get_session()
    try:
        rows = session.execute(
            select(Operator).where(Operator.active == True).order_by(Operator.name)
        ).scalars().all()
        result = []
        for op in rows:
            total = session.execute(
                select(func.count()).select_from(Inspection)
                .where(Inspection.operator_id == op.id)
            ).scalar() or 0
            passes = session.execute(
                select(func.count()).select_from(Inspection)
                .where(Inspection.operator_id == op.id, Inspection.status == 'pass')
            ).scalar() or 0
            pass_rate = round(passes / total * 100, 1) if total > 0 else None
            result.append(OperatorOut(
                id=op.id, employee_id=op.employee_id, name=op.name,
                email=op.email, department=op.department, role=op.role,
                active=op.active,
                created_at=op.created_at.isoformat() if op.created_at else None,
                inspection_count=total, pass_rate=pass_rate,
            ))
        return result
    finally:
        session.close()


@router.post("/", response_model=OperatorOut, status_code=201)
def create_operator(req: OperatorIn):
    session = get_session()
    try:
        op = Operator(
            id=f"op-{uuid.uuid4().hex[:12]}",
            employee_id=req.employee_id or f"EMP-{uuid.uuid4().hex[:6].upper()}",
            name=req.name,
            email=req.email, department=req.department, role=req.role,
        )
        session.add(op)
        session.commit()
        session.refresh(op)
        return OperatorOut(
            id=op.id, employee_id=op.employee_id, name=op.name,
            email=op.email, department=op.department, role=op.role,
            active=op.active,
            created_at=op.created_at.isoformat() if op.created_at else None,
            inspection_count=0, pass_rate=None,
        )
    finally:
        session.close()


@router.get("/{operator_id}", response_model=OperatorOut)
def get_operator(operator_id: str):
    session = get_session()
    try:
        op = session.get(Operator, operator_id)
        if not op:
            raise HTTPException(404, "Operator not found")
        total = session.execute(
            select(func.count()).select_from(Inspection)
            .where(Inspection.operator_id == op.id)
        ).scalar() or 0
        passes = session.execute(
            select(func.count()).select_from(Inspection)
            .where(Inspection.operator_id == op.id, Inspection.status == 'pass')
        ).scalar() or 0
        pass_rate = round(passes / total * 100, 1) if total > 0 else None
        return OperatorOut(
            id=op.id, employee_id=op.employee_id, name=op.name,
            email=op.email, department=op.department, role=op.role,
            active=op.active,
            created_at=op.created_at.isoformat() if op.created_at else None,
            inspection_count=total, pass_rate=pass_rate,
        )
    finally:
        session.close()


@router.delete("/{operator_id}", status_code=204)
def deactivate_operator(operator_id: str):
    session = get_session()
    try:
        op = session.get(Operator, operator_id)
        if not op:
            raise HTTPException(404, "Operator not found")
        op.active = False
        session.commit()
    finally:
        session.close()
