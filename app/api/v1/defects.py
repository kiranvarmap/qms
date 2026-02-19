from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import select
from app.db import get_session
from app.models.orm_models import DefectType, InspectionDefect, Inspection
import uuid

router = APIRouter()


class DefectTypeIn(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    severity: str = "minor"  # minor | major | critical


class DefectTypeOut(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str]
    severity: str
    created_at: Optional[str]


class AttachDefectIn(BaseModel):
    defect_type_id: str
    quantity: int = 1
    notes: Optional[str] = None


class InspectionDefectOut(BaseModel):
    id: int
    defect_type_id: str
    defect_code: str
    defect_name: str
    severity: str
    quantity: int
    notes: Optional[str]
    created_at: Optional[str]


# ── Defect Types (catalogue) ──────────────────────────────────────────────

@router.get("/types", response_model=List[DefectTypeOut])
def list_defect_types():
    session = get_session()
    try:
        rows = session.execute(select(DefectType).order_by(DefectType.name)).scalars().all()
        return [_dt_out(r) for r in rows]
    finally:
        session.close()


@router.post("/types", response_model=DefectTypeOut, status_code=201)
def create_defect_type(req: DefectTypeIn):
    session = get_session()
    try:
        dt = DefectType(
            id=f"dt-{uuid.uuid4().hex[:12]}",
            code=req.code, name=req.name,
            description=req.description, severity=req.severity,
        )
        session.add(dt)
        session.commit()
        session.refresh(dt)
        return _dt_out(dt)
    finally:
        session.close()


@router.delete("/types/{defect_type_id}", status_code=204)
def delete_defect_type(defect_type_id: str):
    session = get_session()
    try:
        dt = session.get(DefectType, defect_type_id)
        if not dt:
            raise HTTPException(404, "Defect type not found")
        session.delete(dt)
        session.commit()
    finally:
        session.close()


# ── Defects on an Inspection ──────────────────────────────────────────────

@router.get("/inspection/{inspection_id}", response_model=List[InspectionDefectOut])
def list_inspection_defects(inspection_id: str):
    session = get_session()
    try:
        rows = session.execute(
            select(InspectionDefect).where(InspectionDefect.inspection_id == inspection_id)
        ).scalars().all()
        return [_id_out(r) for r in rows]
    finally:
        session.close()


@router.post("/inspection/{inspection_id}", response_model=InspectionDefectOut, status_code=201)
def attach_defect(inspection_id: str, req: AttachDefectIn):
    session = get_session()
    try:
        ins = session.get(Inspection, inspection_id)
        if not ins:
            raise HTTPException(404, "Inspection not found")
        dt = session.get(DefectType, req.defect_type_id)
        if not dt:
            raise HTTPException(404, "Defect type not found")
        id_row = InspectionDefect(
            inspection_id=inspection_id,
            defect_type_id=req.defect_type_id,
            quantity=req.quantity,
            notes=req.notes,
        )
        session.add(id_row)
        # update defect_count on inspection
        ins.defect_count = (ins.defect_count or 0) + req.quantity
        session.commit()
        session.refresh(id_row)
        return _id_out(id_row)
    finally:
        session.close()


@router.delete("/inspection/{inspection_id}/{defect_id}", status_code=204)
def remove_defect(inspection_id: str, defect_id: int):
    session = get_session()
    try:
        id_row = session.get(InspectionDefect, defect_id)
        if not id_row or id_row.inspection_id != inspection_id:
            raise HTTPException(404, "Defect record not found")
        ins = session.get(Inspection, inspection_id)
        if ins:
            ins.defect_count = max(0, (ins.defect_count or 0) - id_row.quantity)
        session.delete(id_row)
        session.commit()
    finally:
        session.close()


def _dt_out(r: DefectType) -> DefectTypeOut:
    return DefectTypeOut(
        id=r.id, code=r.code, name=r.name,
        description=r.description, severity=r.severity,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


def _id_out(r: InspectionDefect) -> InspectionDefectOut:
    return InspectionDefectOut(
        id=r.id,
        defect_type_id=r.defect_type_id,
        defect_code=r.defect_type.code if r.defect_type else "",
        defect_name=r.defect_type.name if r.defect_type else "",
        severity=r.defect_type.severity if r.defect_type else "minor",
        quantity=r.quantity,
        notes=r.notes,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )
