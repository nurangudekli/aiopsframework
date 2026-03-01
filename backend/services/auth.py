"""
Authentication & JWT Service.

Provides password hashing, JWT token creation/verification,
and FastAPI dependency for protected routes.
Backed by Azure Cosmos DB.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext

from backend.config import settings
from backend.cosmos_client import create_item, new_id, query_items, read_item, utcnow_iso

logger = logging.getLogger(__name__)

CONTAINER = "users"

# ── Password hashing ───────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

bearer_scheme = HTTPBearer(auto_error=False)

# JWT settings
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT tokens ─────────────────────────────────────────────────
def create_access_token(
    subject: str,
    *,
    extra_claims: Optional[dict] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=JWT_EXPIRY_HOURS))
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        **(extra_claims or {}),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises on invalid/expired."""
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}")


# ── User lookup ────────────────────────────────────────────────
async def get_user_by_username(username: str) -> Optional[dict]:
    results = await query_items(
        CONTAINER,
        "SELECT * FROM c WHERE c.username = @username",
        parameters=[{"name": "@username", "value": username}],
    )
    return results[0] if results else None


async def get_user_by_email(email: str) -> Optional[dict]:
    results = await query_items(
        CONTAINER,
        "SELECT * FROM c WHERE c.email = @email",
        parameters=[{"name": "@email", "value": email}],
    )
    return results[0] if results else None


async def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Return User dict if credentials are valid, else None."""
    user = await get_user_by_username(username)
    if user and verify_password(password, user["hashed_password"]):
        return user
    return None


async def create_user(username: str, email: str, hashed_pw: str) -> dict:
    """Create a new user in Cosmos DB."""
    doc = {
        "id": new_id(),
        "username": username,
        "email": email,
        "hashed_password": hashed_pw,
        "is_active": True,
        "is_admin": False,
        "created_at": utcnow_iso(),
    }
    return await create_item(CONTAINER, doc)


# ── FastAPI dependencies ───────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — extracts and validates JWT from Authorization header.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    username: str = payload.get("sub", "")
    user = await get_user_by_username(username)
    if user is None or not user.get("is_active"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    """Same as get_current_user but returns None instead of raising 401."""
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        username: str = payload.get("sub", "")
        return await get_user_by_username(username)
    except HTTPException:
        return None
