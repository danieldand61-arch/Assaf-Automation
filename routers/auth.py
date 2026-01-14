"""
Authentication routes (signup, login, logout)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging
from database.supabase_client import get_supabase

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/signup")
async def signup(request: SignupRequest):
    """
    Register a new user
    """
    try:
        supabase = get_supabase()
        
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
        
        if response.user:
            logger.info(f"✅ User registered: {request.email}")
            
            # Create default account for user
            account_response = supabase.table("accounts").insert({
                "user_id": response.user.id,
                "name": f"{request.full_name or request.email}'s Account",
                "description": "Default account"
            }).execute()
            
            # Set as active account
            supabase.table("user_settings").insert({
                "user_id": response.user.id,
                "active_account_id": account_response.data[0]["id"]
            }).execute()
            
            return {
                "success": True,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email
                },
                "session": {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token
                }
            }
        else:
            raise HTTPException(status_code=400, detail="Signup failed")
            
    except Exception as e:
        logger.error(f"❌ Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login(request: LoginRequest):
    """
    Login existing user
    """
    try:
        supabase = get_supabase()
        
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if response.user:
            logger.info(f"✅ User logged in: {request.email}")
            
            # Get active account
            settings = supabase.table("user_settings").select("active_account_id").eq("user_id", response.user.id).single().execute()
            
            return {
                "success": True,
                "user": {
                    "id": response.user.id,
                    "email": response.user.email
                },
                "session": {
                    "access_token": response.session.access_token,
                    "refresh_token": response.session.refresh_token
                },
                "active_account_id": settings.data.get("active_account_id") if settings.data else None
            }
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
    except Exception as e:
        logger.error(f"❌ Login error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid email or password")


@router.post("/logout")
async def logout():
    """
    Logout user (client should delete tokens)
    """
    try:
        supabase = get_supabase()
        supabase.auth.sign_out()
        
        return {"success": True, "message": "Logged out successfully"}
    except Exception as e:
        logger.error(f"❌ Logout error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token
    """
    try:
        supabase = get_supabase()
        
        response = supabase.auth.refresh_session(request.refresh_token)
        
        return {
            "success": True,
            "session": {
                "access_token": response.session.access_token,
                "refresh_token": response.session.refresh_token
            }
        }
    except Exception as e:
        logger.error(f"❌ Token refresh error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid refresh token")
