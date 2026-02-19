from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy import select
from app.db import get_session
from app.models.orm_models import Product, Batch
import uuid

router = APIRouter()


# ── Products ──────────────────────────────────────────────────────────────

class ProductIn(BaseModel):
    sku: str
    name: str
    category: Optional[str] = None
    description: Optional[str] = None


class ProductOut(BaseModel):
    id: str
    sku: str
    name: str
    category: Optional[str]
    description: Optional[str]
    created_at: Optional[str]


@router.get("/products", response_model=List[ProductOut])
def list_products():
    session = get_session()
    try:
        rows = session.execute(select(Product).order_by(Product.name)).scalars().all()
        return [ProductOut(id=r.id, sku=r.sku, name=r.name, category=r.category,
                           description=r.description,
                           created_at=r.created_at.isoformat() if r.created_at else None)
                for r in rows]
    finally:
        session.close()


@router.post("/products", response_model=ProductOut, status_code=201)
def create_product(req: ProductIn):
    session = get_session()
    try:
        p = Product(id=f"prod-{uuid.uuid4().hex[:12]}", sku=req.sku,
                    name=req.name, category=req.category, description=req.description)
        session.add(p)
        session.commit()
        session.refresh(p)
        return ProductOut(id=p.id, sku=p.sku, name=p.name, category=p.category,
                          description=p.description,
                          created_at=p.created_at.isoformat() if p.created_at else None)
    finally:
        session.close()


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: str):
    session = get_session()
    try:
        p = session.get(Product, product_id)
        if not p:
            raise HTTPException(404, "Product not found")
        return ProductOut(id=p.id, sku=p.sku, name=p.name, category=p.category,
                          description=p.description,
                          created_at=p.created_at.isoformat() if p.created_at else None)
    finally:
        session.close()


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: str):
    session = get_session()
    try:
        p = session.get(Product, product_id)
        if not p:
            raise HTTPException(404, "Product not found")
        session.delete(p)
        session.commit()
    finally:
        session.close()


# ── Batches ──────────────────────────────────────────────────────────────

class BatchIn(BaseModel):
    product_id: str
    batch_number: str
    quantity: int = 0
    production_date: Optional[str] = None
    notes: Optional[str] = None


class BatchOut(BaseModel):
    id: str
    product_id: str
    product_name: Optional[str]
    batch_number: str
    quantity: int
    production_date: Optional[str]
    notes: Optional[str]
    created_at: Optional[str]


@router.get("/batches", response_model=List[BatchOut])
def list_batches():
    session = get_session()
    try:
        rows = session.execute(
            select(Batch).order_by(Batch.created_at.desc())
        ).scalars().all()
        return [_batch_out(r) for r in rows]
    finally:
        session.close()


@router.post("/batches", response_model=BatchOut, status_code=201)
def create_batch(req: BatchIn):
    session = get_session()
    try:
        prod = session.get(Product, req.product_id)
        if not prod:
            raise HTTPException(400, "Product not found")
        from datetime import datetime
        prod_date = None
        if req.production_date:
            try:
                prod_date = datetime.fromisoformat(req.production_date)
            except Exception:
                pass
        b = Batch(id=f"batch-{uuid.uuid4().hex[:12]}", product_id=req.product_id,
                  batch_number=req.batch_number, quantity=req.quantity,
                  production_date=prod_date, notes=req.notes)
        session.add(b)
        session.commit()
        session.refresh(b)
        return _batch_out(b)
    finally:
        session.close()


@router.get("/batches/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: str):
    session = get_session()
    try:
        b = session.get(Batch, batch_id)
        if not b:
            raise HTTPException(404, "Batch not found")
        return _batch_out(b)
    finally:
        session.close()


@router.delete("/batches/{batch_id}", status_code=204)
def delete_batch(batch_id: str):
    session = get_session()
    try:
        b = session.get(Batch, batch_id)
        if not b:
            raise HTTPException(404, "Batch not found")
        session.delete(b)
        session.commit()
    finally:
        session.close()


def _batch_out(b: Batch) -> BatchOut:
    return BatchOut(
        id=b.id,
        product_id=b.product_id,
        product_name=b.product.name if b.product else None,
        batch_number=b.batch_number,
        quantity=b.quantity or 0,
        production_date=b.production_date.isoformat() if b.production_date else None,
        notes=b.notes,
        created_at=b.created_at.isoformat() if b.created_at else None,
    )
