from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
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


def _require_admin(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(authorization[7:])
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    if payload.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return payload


# ── Models ────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    username: str
    role: str
    full_name: Optional[str]
    email: Optional[str] = None
    is_admin: bool = False
    approval_status: str = 'approved'


class SignupRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "operator"


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str]
    full_name: Optional[str]
    role: str
    approval_status: str
    active: bool
    created_at: Optional[str]
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None


class ApprovalRequest(BaseModel):
    action: str  # 'approve' | 'reject'
    approved_by: Optional[str] = None


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    full_name: Optional[str] = None
    active: Optional[bool] = None


# ── Endpoints ────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    session = get_session()
    try:
        user = session.execute(
            select(User).where(User.username == req.username)
        ).scalars().first()
        if not user or user.hashed_password != _hash_password(req.password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.active:
            raise HTTPException(status_code=403, detail="Account is deactivated")
        approval = getattr(user, 'approval_status', 'approved')
        if approval == 'pending':
            raise HTTPException(status_code=403, detail="Your account is pending admin approval. Please wait.")
        if approval == 'rejected':
            raise HTTPException(status_code=403, detail="Your account request was rejected. Contact your admin.")
        token = _make_token(user.id, user.username, user.role)
        return LoginResponse(
            token=token, user_id=user.id, username=user.username,
            role=user.role, full_name=user.full_name,
            email=getattr(user, 'email', None),
            is_admin=(user.role == 'admin'),
            approval_status=approval,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")
    finally:
        session.close()


@router.post("/signup", status_code=201)
def signup(req: SignupRequest):
    """Public signup — user is created with approval_status=pending until admin approves."""
    session = get_session()
    try:
        existing = session.execute(
            select(User).where(User.username == req.username)
        ).scalars().first()
        if existing:
            raise HTTPException(409, "Username already taken")
        if req.email:
            email_exists = session.execute(
                select(User).where(User.email == req.email)
            ).scalars().first()
            if email_exists:
                raise HTTPException(409, "Email already registered")
        user = User(
            id=f"usr-{uuid.uuid4().hex[:12]}",
            username=req.username,
            email=req.email,
            hashed_password=_hash_password(req.password),
            full_name=req.full_name,
            role=req.role if req.role in ('operator', 'reviewer', 'manager') else 'operator',
            approval_status='pending',
            active=True,
        )
        session.add(user)
        session.commit()
        return {"message": "Signup successful. Your account is pending admin approval.", "user_id": user.id}
    finally:
        session.close()


@router.get("/users", response_model=List[UserOut])
def list_users(authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    session = get_session()
    try:
        rows = session.execute(select(User).order_by(User.created_at.desc())).scalars().all()
        return [_user_out(r) for r in rows]
    finally:
        session.close()


class UserBasic(BaseModel):
    id: str
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str = 'operator'


@router.get("/users/basic", response_model=List[UserBasic])
def list_users_basic(authorization: Optional[str] = Header(None)):
    """Minimal user list for any authenticated user — used for signer lookup/autocomplete."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token_data = decode_token(authorization[7:])
    if not token_data:
        raise HTTPException(401, "Invalid or expired token")
    session = get_session()
    try:
        rows = session.execute(
            select(User).where(User.approval_status == 'approved').order_by(User.full_name)
        ).scalars().all()
        return [UserBasic(id=r.id, username=r.username, full_name=r.full_name,
                          email=getattr(r, 'email', None), role=r.role) for r in rows]
    finally:
        session.close()


@router.patch("/users/{user_id}/approval")
def approve_user(user_id: str, req: ApprovalRequest, authorization: Optional[str] = Header(None)):
    admin = _require_admin(authorization)
    if req.action not in ('approve', 'reject'):
        raise HTTPException(400, "action must be 'approve' or 'reject'")
    session = get_session()
    try:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")
        from datetime import datetime, timezone
        user.approval_status = 'approved' if req.action == 'approve' else 'rejected'
        user.approved_by = req.approved_by or admin.get('username', 'admin')
        user.approved_at = datetime.now(timezone.utc)
        session.commit()
        return {"message": f"User {req.action}d successfully", "user": _user_out(user)}
    finally:
        session.close()


@router.patch("/users/{user_id}")
def update_user(user_id: str, req: UpdateUserRequest, authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    session = get_session()
    try:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(404, "User not found")
        if req.role is not None:
            user.role = req.role
        if req.full_name is not None:
            user.full_name = req.full_name
        if req.active is not None:
            user.active = req.active
        session.commit()
        return _user_out(user)
    finally:
        session.close()


@router.get("/me")
def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(authorization[7:])
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return payload


@router.get("/debug")
def debug_auth():
    from sqlalchemy import text
    from app.db import engine
    try:
        with engine.connect() as conn:
            tables = conn.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
            )).fetchall()
            table_names = [r[0] for r in tables]
            users_exist = 'users' in table_names
            user_count = 0
            admin_exists = False
            if users_exist:
                user_count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
                admin_exists = conn.execute(
                    text("SELECT COUNT(*) FROM users WHERE username='admin'")
                ).scalar() > 0
            return {"tables": table_names, "users_table_exists": users_exist,
                    "user_count": user_count, "admin_exists": admin_exists}
    except Exception as e:
        return {"error": str(e)}


def _user_out(r: User) -> UserOut:
    return UserOut(
        id=r.id, username=r.username,
        email=getattr(r, 'email', None),
        full_name=r.full_name, role=r.role,
        approval_status=getattr(r, 'approval_status', 'approved'),
        active=r.active,
        created_at=r.created_at.isoformat() if r.created_at else None,
        approved_at=r.approved_at.isoformat() if getattr(r, 'approved_at', None) else None,
        approved_by=getattr(r, 'approved_by', None),
    )
