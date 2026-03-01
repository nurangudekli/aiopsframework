"""
Authentication API routes.

POST /auth/register  → create a new user
POST /auth/login     → authenticate and receive JWT
GET  /auth/me        → get current authenticated user info
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from backend.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user,
    get_user_by_email,
    get_user_by_username,
    hash_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Schemas ────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    email: str


class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: str


# ── Endpoints ──────────────────────────────────────────────────
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    """Register a new user account."""
    if await get_user_by_username(payload.username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    if await get_user_by_email(payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = await create_user(payload.username, payload.email, hash_password(payload.password))

    token = create_access_token(user["username"])
    return TokenResponse(access_token=token, username=user["username"], email=user["email"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    """Authenticate with username + password, receive a JWT."""
    user = await authenticate_user(payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user["username"], extra_claims={"is_admin": user.get("is_admin", False)})
    return TokenResponse(access_token=token, username=user["username"], email=user["email"])


@router.get("/me", response_model=UserInfo)
async def me(current_user: dict = Depends(get_current_user)):
    """Return info about the currently authenticated user."""
    return UserInfo(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        is_active=current_user.get("is_active", True),
        is_admin=current_user.get("is_admin", False),
        created_at=current_user.get("created_at", ""),
    )
