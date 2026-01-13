"""
Authentication middleware for FastAPI
Handles Supabase JWT token verification
"""
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging

from database.supabase_client import verify_auth_token

logger = logging.getLogger(__name__)

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials) -> dict:
    """
    Dependency to get current authenticated user from JWT token
    Usage in endpoints:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            ...
    """
    token = credentials.credentials
    user = verify_auth_token(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def get_optional_user(request: Request) -> Optional[dict]:
    """
    Get user if authenticated, otherwise None
    For endpoints that work both authenticated and unauthenticated
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "")
    return verify_auth_token(token)
