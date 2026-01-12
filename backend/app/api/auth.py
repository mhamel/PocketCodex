from __future__ import annotations

import json
import secrets
from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..config import USERS_FILE
from ..models.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-memory token store (for simplicity)
_active_tokens: set[str] = set()


def _load_users() -> list[dict]:
    """Load users from the JSON configuration file."""
    if not USERS_FILE.exists():
        return []
    try:
        data = json.loads(USERS_FILE.read_text(encoding="utf-8"))
        return data.get("users", [])
    except Exception:
        return []


def validate_token(token: str) -> bool:
    """Check if a token is valid."""
    return token in _active_tokens


def invalidate_token(token: str) -> None:
    """Remove a token from the active set."""
    _active_tokens.discard(token)


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest) -> LoginResponse:
    """Authenticate user with username and password."""
    users = _load_users()

    for user in users:
        if user.get("username") == req.username and user.get("password") == req.password:
            # Generate a simple token
            token = secrets.token_hex(32)
            _active_tokens.add(token)
            return LoginResponse(
                success=True,
                message="Login successful",
                token=token
            )

    raise HTTPException(status_code=401, detail="Invalid username or password")


@router.post("/logout")
async def logout(token: str = "") -> dict:
    """Invalidate the current session token."""
    invalidate_token(token)
    return {"success": True, "message": "Logged out successfully"}


@router.get("/verify")
async def verify_token(token: str = "") -> dict:
    """Verify if a token is valid."""
    if validate_token(token):
        return {"valid": True}
    raise HTTPException(status_code=401, detail="Invalid or expired token")
