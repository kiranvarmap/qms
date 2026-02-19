from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import select
from app.db import get_session
from app.models.orm_models import Signature, Inspection
from datetime import datetime

router = APIRouter()


class SignatureIn(BaseModel):
    signer_name: str
    signer_role: str  # inspector | reviewer | approver
    signer_id: Optional[str] = None


class SignatureOut(BaseModel):
    id: int
    inspection_id: str
    signer_id: Optional[str]
    signer_name: str
    signer_role: str
    ip_address: Optional[str]
    signed_at: Optional[str]
    revoked: bool
    revoked_at: Optional[str]
    revoked_by: Optional[str]


@router.get("/{inspection_id}/signatures", response_model=List[SignatureOut])
def list_signatures(inspection_id: str):
    session = get_session()
    try:
        rows = session.execute(
            select(Signature)
            .where(Signature.inspection_id == inspection_id)
            .order_by(Signature.signed_at)
        ).scalars().all()
        return [_sig_out(r) for r in rows]
    finally:
        session.close()


@router.post("/{inspection_id}/signatures", response_model=SignatureOut, status_code=201)
def sign_inspection(inspection_id: str, req: SignatureIn, request: Request):
    session = get_session()
    try:
        ins = session.get(Inspection, inspection_id)
        if not ins:
            raise HTTPException(404, "Inspection not found")

        # Check not already signed by this role (active)
        existing = session.execute(
            select(Signature).where(
                Signature.inspection_id == inspection_id,
                Signature.signer_role == req.signer_role,
                Signature.revoked == False,
            )
        ).scalars().first()
        if existing:
            raise HTTPException(409, f"Already signed by a {req.signer_role}")

        ip = request.client.host if request.client else None
        sig = Signature(
            inspection_id=inspection_id,
            signer_id=req.signer_id,
            signer_name=req.signer_name,
            signer_role=req.signer_role,
            ip_address=ip,
        )
        session.add(sig)
        session.commit()
        session.refresh(sig)
        return _sig_out(sig)
    finally:
        session.close()


@router.delete("/{inspection_id}/signatures/{sig_id}", response_model=SignatureOut)
def revoke_signature(inspection_id: str, sig_id: int, revoked_by: str = "admin"):
    session = get_session()
    try:
        sig = session.get(Signature, sig_id)
        if not sig or sig.inspection_id != inspection_id:
            raise HTTPException(404, "Signature not found")
        if sig.revoked:
            raise HTTPException(400, "Signature already revoked")
        sig.revoked = True
        sig.revoked_at = datetime.utcnow()
        sig.revoked_by = revoked_by
        session.commit()
        session.refresh(sig)
        return _sig_out(sig)
    finally:
        session.close()


def _sig_out(r: Signature) -> SignatureOut:
    return SignatureOut(
        id=r.id,
        inspection_id=r.inspection_id,
        signer_id=r.signer_id,
        signer_name=r.signer_name,
        signer_role=r.signer_role,
        ip_address=r.ip_address,
        signed_at=r.signed_at.isoformat() if r.signed_at else None,
        revoked=r.revoked,
        revoked_at=r.revoked_at.isoformat() if r.revoked_at else None,
        revoked_by=r.revoked_by,
    )
