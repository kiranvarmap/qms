from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from app.db import get_session
from app.models.orm_models import User
import uuid
import hashlib
import hmac
import os
import json
import base64
import time

router = APIRouter()

SECRET = os.getenv("JWT_SECRET", "qms-dev-secret-change-in-prod")


def _hash_password(password: str) -> str:
    return hashlib.sha256(f"{SECRET}{password}".encode()).hexdigest()


def _make_token(user_id: str, username: str, role: str) -> str:
    """Minimal JWT-like token (base64 encoded JSON + HMAC signature)."""
    payload = json.dumps({"sub": user_id, "username": username, "role": role,
                          "exp": int(time.time()) + 86400 * 7})
    encoded = base64.b64encode(payload.encode()).decode()
    sig = hmac.new(SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{sig}"


def decode_token(token: str) -> Optional[dict]:
    try:
        parts = token.rsplit(".", 1)
        if len(parts) != 2:
            return None
        encoded, sig = parts
        expected = hmac.new(SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.b64decode(encoded).decode())
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    username: str
    role: str
    full_name: Optional[str]


class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "operator"


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    session = get_session()
    try:
        user = session.execute(
            select(User).where(User.username == req.username, User.active == True)
        ).scalars().first()
        if not user or user.hashed_password != _hash_password(req.password):
            raise HTTPException(401, "Invalid credentials")
        token = _make_token(user.id, user.username, user.role)
        return LoginResponse(token=token, user_id=user.id, username=user.username,
                             role=user.role, full_name=user.full_name)
    finally:
        session.close()


@router.post("/register", response_model=LoginResponse, status_code=201)
def register(req: RegisterRequest):
    """Open registration — for demo only. In production restrict to admin."""
    session = get_session()
    try:
        existing = session.execute(
            select(User).where(User.username == req.username)
        ).scalars().first()
        if existing:
            raise HTTPException(409, "Username already exists")
        user = User(
            id=f"usr-{uuid.uuid4().hex[:12]}",
            username=req.username,
            hashed_password=_hash_password(req.password),
            full_name=req.full_name,
            role=req.role,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        token = _make_token(user.id, user.username, user.role)
        return LoginResponse(token=token, user_id=user.id, username=user.username,
                             role=user.role, full_name=user.full_name)
    finally:
        session.close()


@router.get("/me")
def get_me(authorization: Optional[str] = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(authorization[7:])
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload
