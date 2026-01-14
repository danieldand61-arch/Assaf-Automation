"""
Authentication middleware for FastAPI
"""
from fastapi import Depends, HTTPException, Header
from typing import Optional
import jwt
import os
import logging

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv("JWT_SECRET")

async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Extract user from JWT token in Authorization header
    Required for protected routes
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        # Decode JWT
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "user")
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_optional_user(authorization: Optional[str] = Header(None)):
    """
    Extract user from JWT token (optional)
    Returns None if no token provided
    """
    if not authorization:
        return None
    
    try:
        return await get_current_user(authorization)
    except:
        return None


async def get_account_id(authorization: Optional[str] = Header(None), 
                         x_account_id: Optional[str] = Header(None)):
    """
    Get active account ID from header
    For multi-account support
    """
    user = await get_current_user(authorization)
    
    if not x_account_id:
        raise HTTPException(status_code=400, detail="X-Account-ID header required")
    
    # TODO: Verify user has access to this account
    # (check team_members table or accounts.user_id)
    
    return {
        "user": user,
        "account_id": x_account_id
    }
