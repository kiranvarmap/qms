from fastapi import APIRouter, HTTPException, Header, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import select
from app.db import get_session
from app.models.orm_models import SignoffDocument, SignRequest
from app.api.v1.auth import decode_token
import uuid
import os
import shutil
from datetime import datetime, timezone

router = APIRouter()

UPLOAD_DIR = "/tmp/qms_pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_user(authorization: Optional[str]) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return decode_token(authorization[7:])


def _require_auth(authorization: Optional[str]) -> dict:
    user = _get_user(authorization)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


# ── Pydantic models ───────────────────────────────────────────────────────

class SignerIn(BaseModel):
    assigned_to_id: Optional[str] = None
    assigned_to_name: str
    assigned_to_role: str = "operator"
    assigned_to_email: Optional[str] = None
    sign_order: int = 1
    placeholder_page: Optional[int] = 1
    placeholder_x: Optional[float] = None
    placeholder_y: Optional[float] = None
    placeholder_w: Optional[float] = None
    placeholder_h: Optional[float] = None


class DocumentIn(BaseModel):
    title: str
    description: Optional[str] = None
    batch_id: Optional[str] = None
    batch_number: Optional[str] = None
    signers: List[SignerIn] = []


class SignerOut(BaseModel):
    id: str
    document_id: str
    assigned_to_id: Optional[str]
    assigned_to_name: str
    assigned_to_role: str
    assigned_to_email: Optional[str]
    sign_order: int
    placeholder_page: Optional[int]
    placeholder_x: Optional[float]
    placeholder_y: Optional[float]
    placeholder_w: Optional[float]
    placeholder_h: Optional[float]
    status: str
    signed_at: Optional[str]
    notes: Optional[str]
    rejection_reason: Optional[str]


class DocumentOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    batch_id: Optional[str]
    batch_number: Optional[str]
    created_by: Optional[str]
    created_by_name: Optional[str]
    status: str
    pdf_path: Optional[str]
    pdf_filename: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]
    sign_requests: List[SignerOut] = []
    total_signers: int = 0
    signed_count: int = 0


class SignActionIn(BaseModel):
    notes: Optional[str] = None


class RejectActionIn(BaseModel):
    reason: Optional[str] = None
    notes: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[DocumentOut])
@router.get("/", response_model=List[DocumentOut])
def list_documents(
    status: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    authorization: Optional[str] = Header(None),
):
    _require_auth(authorization)
    session = get_session()
    try:
        q = select(SignoffDocument).order_by(SignoffDocument.created_at.desc()).limit(limit)
        if status:
            q = q.where(SignoffDocument.status == status)
        if batch_id:
            q = q.where(SignoffDocument.batch_id == batch_id)
        rows = session.execute(q).scalars().all()
        return [_doc_out(r) for r in rows]
    finally:
        session.close()


@router.post("", response_model=DocumentOut, status_code=201)
@router.post("/", response_model=DocumentOut, status_code=201)
def create_document(req: DocumentIn, authorization: Optional[str] = Header(None)):
    user = _require_auth(authorization)
    session = get_session()
    try:
        doc_id = f"doc-{uuid.uuid4().hex[:12]}"
        doc = SignoffDocument(
            id=doc_id,
            title=req.title,
            description=req.description,
            batch_id=req.batch_id,
            batch_number=req.batch_number,
            created_by=user.get('sub'),
            created_by_name=user.get('username'),
            status='draft' if not req.signers else 'in_progress',
        )
        session.add(doc)
        session.flush()
        for s in req.signers:
            sr = SignRequest(
                id=f"sr-{uuid.uuid4().hex[:12]}",
                document_id=doc_id,
                assigned_to_id=s.assigned_to_id,
                assigned_to_name=s.assigned_to_name,
                assigned_to_role=s.assigned_to_role,
                assigned_to_email=s.assigned_to_email,
                sign_order=s.sign_order,
                placeholder_page=s.placeholder_page or 1,
                placeholder_x=s.placeholder_x,
                placeholder_y=s.placeholder_y,
                placeholder_w=s.placeholder_w,
                placeholder_h=s.placeholder_h,
                status='pending',
            )
            session.add(sr)
        session.commit()
        session.refresh(doc)
        return _doc_out(doc)
    finally:
        session.close()


@router.get("/my-tasks")
def my_tasks(authorization: Optional[str] = Header(None)):
    """Returns all sign requests assigned to the current user (pending + completed)."""
    user = _require_auth(authorization)
    session = get_session()
    try:
        user_id = user.get('sub')
        username = user.get('username', '')
        full_name = user.get('full_name', '')
        email = user.get('email', '')
        q = select(SignRequest).where(
            (SignRequest.assigned_to_id == user_id) |
            (SignRequest.assigned_to_name == username) |
            (SignRequest.assigned_to_name == full_name) |
            (SignRequest.assigned_to_email == email)
        ).order_by(SignRequest.created_at.asc())
        rows = session.execute(q).scalars().all()
        result = []
        for r in rows:
            sr = _sr_out(r)
            # attach document info
            doc = session.get(SignoffDocument, r.document_id)
            sr_dict = sr.dict()
            if doc:
                sr_dict['document'] = {
                    'id': doc.id, 'title': doc.title,
                    'batch_number': doc.batch_number,
                    'status': doc.status,
                    'created_at': doc.created_at.isoformat() if doc.created_at else None,
                }
            result.append(sr_dict)
        return result
    finally:
        session.close()


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, authorization: Optional[str] = Header(None)):
    _require_auth(authorization)
    session = get_session()
    try:
        doc = session.get(SignoffDocument, document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        return _doc_out(doc)
    finally:
        session.close()


@router.post("/{document_id}/sign-requests", status_code=201)
def add_signer(document_id: str, req: SignerIn, authorization: Optional[str] = Header(None)):
    _require_auth(authorization)
    session = get_session()
    try:
        doc = session.get(SignoffDocument, document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        sr = SignRequest(
            id=f"sr-{uuid.uuid4().hex[:12]}",
            document_id=document_id,
            assigned_to_id=req.assigned_to_id,
            assigned_to_name=req.assigned_to_name,
            assigned_to_role=req.assigned_to_role,
            assigned_to_email=req.assigned_to_email,
            sign_order=req.sign_order,
            status='pending',
        )
        session.add(sr)
        if doc.status == 'draft':
            doc.status = 'in_progress'
        session.commit()
        session.refresh(sr)
        return _sr_out(sr)
    finally:
        session.close()


@router.post("/{document_id}/sign-requests/{request_id}/sign")
def sign_document(document_id: str, request_id: str, req: SignActionIn,
                  authorization: Optional[str] = Header(None)):
    user = _require_auth(authorization)
    session = get_session()
    try:
        sr = session.get(SignRequest, request_id)
        if not sr or sr.document_id != document_id:
            raise HTTPException(404, "Sign request not found")
        if sr.status != 'pending':
            raise HTTPException(400, f"Sign request is already {sr.status}")
        sr.status = 'signed'
        sr.signed_at = datetime.now(timezone.utc)
        sr.notes = req.notes
        session.flush()
        # Check if all sign requests for this document are complete
        doc = session.get(SignoffDocument, document_id)
        all_requests = session.execute(
            select(SignRequest).where(SignRequest.document_id == document_id)
        ).scalars().all()
        if all(r.status in ('signed', 'skipped') for r in all_requests):
            doc.status = 'complete'
        elif any(r.status == 'rejected' for r in all_requests):
            doc.status = 'rejected'
        session.commit()
        return {"message": "Document signed successfully", "sign_request": _sr_out(sr), "document_status": doc.status}
    finally:
        session.close()


@router.post("/{document_id}/sign-requests/{request_id}/reject")
def reject_sign(document_id: str, request_id: str, req: RejectActionIn,
                authorization: Optional[str] = Header(None)):
    _require_auth(authorization)
    session = get_session()
    try:
        sr = session.get(SignRequest, request_id)
        if not sr or sr.document_id != document_id:
            raise HTTPException(404, "Sign request not found")
        sr.status = 'rejected'
        sr.rejection_reason = req.reason or req.notes or 'Rejected'
        sr.signed_at = datetime.now(timezone.utc)
        doc = session.get(SignoffDocument, document_id)
        doc.status = 'rejected'
        session.commit()
        return {"message": "Signing rejected", "sign_request": _sr_out(sr)}
    finally:
        session.close()


@router.post("/{document_id}/upload-pdf")
async def upload_pdf(
    document_id: str,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    """Upload a PDF for a sign-off document."""
    _require_auth(authorization)
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(400, "Only PDF files are accepted")
    session = get_session()
    try:
        doc = session.get(SignoffDocument, document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        # Save file
        safe_name = f"{document_id}.pdf"
        dest = os.path.join(UPLOAD_DIR, safe_name)
        with open(dest, "wb") as f:
            shutil.copyfileobj(file.file, f)
        doc.pdf_path = dest
        doc.pdf_filename = file.filename
        session.commit()
        return {"message": "PDF uploaded", "pdf_filename": file.filename}
    finally:
        session.close()


@router.get("/{document_id}/pdf")
def serve_pdf(document_id: str, authorization: Optional[str] = Header(None)):
    """Serve the PDF file for a document."""
    _require_auth(authorization)
    session = get_session()
    try:
        doc = session.get(SignoffDocument, document_id)
        if not doc or not doc.pdf_path:
            raise HTTPException(404, "PDF not found")
        if not os.path.exists(doc.pdf_path):
            raise HTTPException(404, "PDF file missing from server")
        return FileResponse(doc.pdf_path, media_type="application/pdf",
                            filename=doc.pdf_filename or f"{document_id}.pdf")
    finally:
        session.close()


@router.patch("/{document_id}/sign-requests/{request_id}/placeholder")
def update_placeholder(
    document_id: str, request_id: str,
    req: SignerIn,
    authorization: Optional[str] = Header(None),
):
    """Update the PDF placeholder position for a sign request."""
    _require_auth(authorization)
    session = get_session()
    try:
        sr = session.get(SignRequest, request_id)
        if not sr or sr.document_id != document_id:
            raise HTTPException(404, "Sign request not found")
        sr.placeholder_page = req.placeholder_page or sr.placeholder_page
        sr.placeholder_x = req.placeholder_x if req.placeholder_x is not None else sr.placeholder_x
        sr.placeholder_y = req.placeholder_y if req.placeholder_y is not None else sr.placeholder_y
        sr.placeholder_w = req.placeholder_w if req.placeholder_w is not None else sr.placeholder_w
        sr.placeholder_h = req.placeholder_h if req.placeholder_h is not None else sr.placeholder_h
        session.commit()
        return _sr_out(sr)
    finally:
        session.close()


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, authorization: Optional[str] = Header(None)):
    _require_auth(authorization)
    session = get_session()
    try:
        doc = session.get(SignoffDocument, document_id)
        if not doc:
            raise HTTPException(404, "Document not found")
        session.delete(doc)
        session.commit()
    finally:
        session.close()


# ── Helpers ───────────────────────────────────────────────────────────────

def _sr_out(r: SignRequest) -> SignerOut:
    return SignerOut(
        id=r.id, document_id=r.document_id,
        assigned_to_id=r.assigned_to_id,
        assigned_to_name=r.assigned_to_name,
        assigned_to_role=r.assigned_to_role,
        assigned_to_email=r.assigned_to_email,
        sign_order=r.sign_order,
        placeholder_page=r.placeholder_page,
        placeholder_x=r.placeholder_x,
        placeholder_y=r.placeholder_y,
        placeholder_w=r.placeholder_w,
        placeholder_h=r.placeholder_h,
        status=r.status,
        signed_at=r.signed_at.isoformat() if r.signed_at else None,
        notes=r.notes,
        rejection_reason=r.rejection_reason,
    )


def _doc_out(r: SignoffDocument) -> DocumentOut:
    srs = [_sr_out(s) for s in (r.sign_requests or [])]
    signed = sum(1 for s in srs if s.status == 'signed')
    return DocumentOut(
        id=r.id, title=r.title, description=r.description,
        batch_id=r.batch_id, batch_number=r.batch_number,
        created_by=r.created_by, created_by_name=r.created_by_name,
        status=r.status,
        pdf_path=r.pdf_path,
        pdf_filename=r.pdf_filename,
        created_at=r.created_at.isoformat() if r.created_at else None,
        updated_at=r.updated_at.isoformat() if r.updated_at else None,
        sign_requests=srs,
        total_signers=len(srs),
        signed_count=signed,
    )
