"""
Authentication middleware for FastAPI
"""
from fastapi import Depends, HTTPException, Header
from typing import Optional
import jwt
import os
import logging
import httpx
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# JWKS client for ES256 verification
jwks_client = None
if SUPABASE_URL:
    jwks_url = f"{SUPABASE_URL}/auth/v1/jwks"
    jwks_client = PyJWKClient(jwks_url)

async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Extract user from Supabase JWT token in Authorization header
    Required for protected routes
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    if not SUPABASE_JWT_SECRET:
        logger.error("❌ SUPABASE_JWT_SECRET not configured")
        raise HTTPException(status_code=500, detail="Authentication not configured")
    
    try:
        # Extract token from "Bearer <token>"
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        # Get token algorithm
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        
        logger.info(f"🔍 Token algorithm: {alg}")
        
        # Decode based on algorithm
        if alg == "ES256" and jwks_client:
            # Get signing key from JWKS for ES256
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                options={"verify_aud": True}
            )
        elif alg in ["HS256", "RS256"] and SUPABASE_JWT_SECRET:
            # Legacy support for HS256/RS256
            payload = jwt.decode(
                token, 
                SUPABASE_JWT_SECRET, 
                algorithms=["HS256", "RS256"],
                options={"verify_aud": False}
            )
        else:
            raise HTTPException(
                status_code=401, 
                detail=f"Unsupported algorithm: {alg} or missing configuration"
            )
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        logger.info(f"✅ User authenticated: {user_id}")
        
        return {
            "user_id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "authenticated")
        }
        
    except jwt.ExpiredSignatureError:
        logger.warning("⚠️ Token expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"⚠️ Invalid token: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"❌ Auth error: {str(e)}")
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
