from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
from app.models import inspection_models

router = APIRouter()

class CreateInspectionRequest(BaseModel):
    batch_id: str
    operator_id: str
    status: str = Field(..., regex='^(pass|fail)$')
    defect_count: int = 0
    notes: Optional[str]

@router.post("/", response_model=inspection_models.InspectionOut)
def create_inspection(req: CreateInspectionRequest, background_tasks: BackgroundTasks):
    # TODO: persist to DB
    inspection = inspection_models.InspectionOut(
        id="ins-1",
        batch_id=req.batch_id,
        operator_id=req.operator_id,
        status=req.status,
        defect_count=req.defect_count,
        notes=req.notes,
        created_at="2026-02-18T00:00:00Z"
    )
    # simulate background processing (notifications, event publish)
    background_tasks.add_task(_post_create_actions, inspection.dict())
    return inspection

async def _post_create_actions(inspection_payload: dict):
    # placeholder for event publish to Redis/Kafka or workflow trigger
    print("[worker] post create actions", inspection_payload)

@router.get("/{inspection_id}", response_model=inspection_models.InspectionOut)
def get_inspection(inspection_id: str):
    # TODO: fetch from DB
    if inspection_id != "ins-1":
        raise HTTPException(status_code=404, detail="Not found")
    return inspection_models.InspectionOut(
        id="ins-1",
        batch_id="batch-123",
        operator_id="op-1",
        status="pass",
        defect_count=0,
        notes=None,
        created_at="2026-02-18T00:00:00Z"
    )
