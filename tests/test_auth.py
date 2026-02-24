"""Tests for the authentication service."""

import pytest
from datetime import timedelta

from backend.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    JWT_ALGORITHM,
)


def test_hash_and_verify_password():
    """Password hashing and verification round-trip."""
    password = "test-secret-password-123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False


def test_create_and_decode_token():
    """JWT creation and decoding round-trip."""
    token = create_access_token("testuser")
    payload = decode_access_token(token)
    assert payload["sub"] == "testuser"
    assert "exp" in payload
    assert "iat" in payload


def test_create_token_with_extra_claims():
    """JWT with extra claims."""
    token = create_access_token("admin", extra_claims={"is_admin": True, "role": "superuser"})
    payload = decode_access_token(token)
    assert payload["sub"] == "admin"
    assert payload["is_admin"] is True
    assert payload["role"] == "superuser"


def test_decode_invalid_token():
    """Decoding a garbage token raises HTTPException."""
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token("not.a.valid.jwt.token")
    assert exc_info.value.status_code == 401


def test_decode_expired_token():
    """Decoding an expired token raises HTTPException."""
    from fastapi import HTTPException
    token = create_access_token("user", expires_delta=timedelta(seconds=-10))
    with pytest.raises(HTTPException) as exc_info:
        decode_access_token(token)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()
