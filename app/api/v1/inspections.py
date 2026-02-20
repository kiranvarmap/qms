from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional, List
from app.db import get_session
from app.models.orm_models import Inspection as InspectionORM
from sqlalchemy import select, or_
import uuid
import os

router = APIRouter()

VALID_STATUSES = {'pending', 'in_review', 'pass', 'fail', 'conditional_pass'}


class InspectionOut(BaseModel):
    id: str
    batch_id: Optional[str]
    operator_id: Optional[str]
    status: str
    defect_count: int
    notes: Optional[str]
    severity: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


class CreateInspectionRequest(BaseModel):
    batch_id: Optional[str] = None
    operator_id: Optional[str] = None
    status: str = 'pending'
    defect_count: int = 0
    notes: Optional[str] = None
    severity: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: str


@router.get("", response_model=List[InspectionOut])
@router.get("/", response_model=List[InspectionOut])
def list_inspections(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    session = get_session()
    try:
        q = select(InspectionORM)
        if status:
            q = q.where(InspectionORM.status == status)
        if search:
            q = q.where(or_(
                InspectionORM.batch_id.ilike(f"%{search}%"),
                InspectionORM.operator_id.ilike(f"%{search}%"),
                InspectionORM.id.ilike(f"%{search}%"),
            ))
        q = q.order_by(InspectionORM.created_at.desc()).limit(limit).offset(offset)
        rows = session.execute(q).scalars().all()
        return [_ins_out(r) for r in rows]
    finally:
        session.close()


@router.post("", response_model=InspectionOut, status_code=201)
@router.post("/", response_model=InspectionOut, status_code=201)
def create_inspection(req: CreateInspectionRequest, background_tasks: BackgroundTasks):
    status = req.status if req.status in VALID_STATUSES else 'pending'
    session = get_session()
    try:
        ins_id = f"ins-{uuid.uuid4().hex[:12]}"
        ins = InspectionORM(
            id=ins_id,
            batch_id=req.batch_id,
            operator_id=req.operator_id,
            status=status,
            defect_count=req.defect_count or 0,
            notes=req.notes,
            severity=req.severity,
        )
        session.add(ins)
        session.commit()
        session.refresh(ins)
        try:
            import redis as _redis
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            r = _redis.from_url(redis_url, decode_responses=True)
            r.rpush('worker:queue', ins.id)
        except Exception:
            background_tasks.add_task(_post_create_actions, {'id': ins.id})
        return _ins_out(ins)
    finally:
        session.close()


@router.get("/{inspection_id}", response_model=InspectionOut)
def get_inspection(inspection_id: str):
    session = get_session()
    try:
        ins = session.get(InspectionORM, inspection_id)
        if not ins:
            raise HTTPException(404, "Not found")
        return _ins_out(ins)
    finally:
        session.close()


@router.patch("/{inspection_id}/status", response_model=InspectionOut)
def update_status(inspection_id: str, req: UpdateStatusRequest):
    if req.status not in VALID_STATUSES:
        raise HTTPException(422, f"status must be one of {VALID_STATUSES}")
    session = get_session()
    try:
        ins = session.get(InspectionORM, inspection_id)
        if not ins:
            raise HTTPException(404, "Not found")
        ins.status = req.status
        session.commit()
        session.refresh(ins)
        return _ins_out(ins)
    finally:
        session.close()


@router.delete("/{inspection_id}", status_code=204)
def delete_inspection(inspection_id: str):
    session = get_session()
    try:
        ins = session.get(InspectionORM, inspection_id)
        if not ins:
            raise HTTPException(404, "Not found")
        session.delete(ins)
        session.commit()
    finally:
        session.close()


def _ins_out(r: InspectionORM) -> InspectionOut:
    return InspectionOut(
        id=r.id,
        batch_id=r.batch_id,
        operator_id=r.operator_id,
        status=r.status,
        defect_count=r.defect_count or 0,
        notes=r.notes,
        severity=r.severity,
        created_at=r.created_at.isoformat() if r.created_at else None,
        updated_at=r.updated_at.isoformat() if r.updated_at else None,
    )


def _post_create_actions(inspection_payload: dict):
    print("[worker] post create actions", inspection_payload)
