from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class DocumentMeta(BaseModel):
    title: str
    product_scope: Optional[str]
    effective_date: Optional[str]

class DocumentOut(BaseModel):
    id: str
    title: str
    version: int
    status: str

@router.post("/", response_model=DocumentOut)
async def create_document(meta: DocumentMeta):
    # In the real app: create DB record, return presigned URL for upload
    return DocumentOut(id="doc-1", title=meta.title, version=1, status="under_review")

@router.post("/{doc_id}/publish")
async def publish_document(doc_id: str):
    # Trigger workflow to approve/publish
    if doc_id != "doc-1":
        raise HTTPException(status_code=404, detail="Not found")
    # For scaffold, mark published directly
    return {"id": doc_id, "status": "published"}

@router.post("/{doc_id}/upload")
async def upload_document_file(doc_id: str, file: UploadFile = File(...)):
    # Simple direct upload to local disk for scaffold, in prod -> presigned S3
    contents = await file.read()
    path = f"/tmp/{doc_id}-{file.filename}"
    with open(path, "wb") as f:
        f.write(contents)
    return {"uploaded": True, "path": path}
