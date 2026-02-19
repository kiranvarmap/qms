from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from app.models import inspection_models
from app.db import get_session
from app.models.orm_models import Inspection as InspectionORM
from sqlalchemy import select
import uuid
import os

router = APIRouter()


@router.get("/", response_model=List[inspection_models.InspectionOut])
def list_inspections():
    """Return all inspections ordered by creation time descending."""
    session = get_session()
    try:
        rows = session.execute(
            select(InspectionORM).order_by(InspectionORM.created_at.desc())
        ).scalars().all()
        return [
            inspection_models.InspectionOut(
                id=r.id,
                batch_id=r.batch_id,
                operator_id=r.operator_id,
                status=r.status,
                defect_count=r.defect_count,
                notes=r.notes,
                created_at=r.created_at.isoformat() if r.created_at else None,
            )
            for r in rows
        ]
    finally:
        session.close()


class CreateInspectionRequest(BaseModel):
    batch_id: str
    operator_id: str
    # pydantic v2 removed `regex` kwarg; use `pattern` instead
    status: str = Field(..., pattern='^(pass|fail)$')
    defect_count: int = 0
    notes: Optional[str]


@router.post("/", response_model=inspection_models.InspectionOut)
def create_inspection(req: CreateInspectionRequest, background_tasks: BackgroundTasks):
    """Persist an inspection and enqueue it for background processing.

    This endpoint writes the inspection to Postgres and pushes the
    inspection ID onto the Redis queue `worker:queue` for the worker to
    consume.
    """
    # persist to DB
    session = get_session()
    try:
        ins_id = f"ins-{uuid.uuid4().hex[:12]}"
        ins = InspectionORM(
            id=ins_id,
            batch_id=req.batch_id,
            operator_id=req.operator_id,
            status=req.status,
            defect_count=req.defect_count,
            notes=req.notes,
        )
        session.add(ins)
        session.commit()
        session.refresh(ins)

        # enqueue for worker
        try:
            import redis as _redis
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
            r = _redis.from_url(redis_url, decode_responses=True)
            r.rpush('worker:queue', ins.id)
        except Exception:
            # enqueue failure should not break API response; log via background task
            background_tasks.add_task(_post_create_actions, {'id': ins.id})

        return inspection_models.InspectionOut(
            id=ins.id,
            batch_id=ins.batch_id,
            operator_id=ins.operator_id,
            status=ins.status,
            defect_count=ins.defect_count,
            notes=ins.notes,
            created_at=ins.created_at.isoformat() if ins.created_at is not None else None,
        )
    finally:
        session.close()


def _post_create_actions(inspection_payload: dict):
    # placeholder for event publish to Redis/Kafka or workflow trigger
    print("[worker] post create actions", inspection_payload)


@router.get("/{inspection_id}", response_model=inspection_models.InspectionOut)
def get_inspection(inspection_id: str):
    session = get_session()
    try:
        ins = session.get(InspectionORM, inspection_id)
        if not ins:
            raise HTTPException(status_code=404, detail="Not found")
        return inspection_models.InspectionOut(
            id=ins.id,
            batch_id=ins.batch_id,
            operator_id=ins.operator_id,
            status=ins.status,
            defect_count=ins.defect_count,
            notes=ins.notes,
            created_at=ins.created_at.isoformat() if ins.created_at is not None else None,
        )
    finally:
        session.close()
