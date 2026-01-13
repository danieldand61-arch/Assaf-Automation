"""
Authentication routes - Sign up, Login, Password reset
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
import logging

from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict

@router.post("/signup", response_model=AuthResponse)
async def sign_up(request: SignUpRequest):
    """Register new user"""
    try:
        supabase = get_supabase_client()
        
        # Sign up user
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name
                }
            }
        })
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user"
            )
        
        logger.info(f"✅ New user registered: {request.email}")
        
        # Auto-create default account for new user
        supabase.table("accounts").insert({
            "user_id": response.user.id,
            "name": f"{request.full_name}'s Account"
        }).execute()
        
        return AuthResponse(
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
            user=response.user.model_dump()
        )
        
    except Exception as e:
        logger.error(f"❌ Sign up error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login user"""
    try:
        supabase = get_supabase_client()
        
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        logger.info(f"✅ User logged in: {request.email}")
        
        return AuthResponse(
            access_token=response.session.access_token,
            refresh_token=response.session.refresh_token,
            user=response.user.model_dump()
        )
        
    except Exception as e:
        logger.error(f"❌ Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

@router.post("/logout")
async def logout():
    """Logout user (client-side token removal)"""
    return {"message": "Logged out successfully"}

@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """Refresh access token"""
    try:
        supabase = get_supabase_client()
        response = supabase.auth.refresh_session(refresh_token)
        
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token
        }
    except Exception as e:
        logger.error(f"❌ Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
