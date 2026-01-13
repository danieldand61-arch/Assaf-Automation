"""
Account management routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
import logging
from uuid import UUID

from database.supabase_client import get_supabase_client, get_user_accounts, get_account_by_id
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])

class CreateAccountRequest(BaseModel):
    name: str
    logo_url: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    brand_voice: Optional[str] = "professional"

class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    brand_voice: Optional[str] = None

class AccountResponse(BaseModel):
    id: str
    name: str
    logo_url: Optional[str]
    brand_colors: List[str]
    brand_voice: str
    created_at: str
    is_active: bool

@router.get("", response_model=List[AccountResponse])
async def list_accounts(user: dict = Depends(get_current_user)):
    """Get all accounts for current user"""
    accounts = await get_user_accounts(user["id"])
    return accounts

@router.post("", response_model=AccountResponse)
async def create_account(
    request: CreateAccountRequest,
    user: dict = Depends(get_current_user)
):
    """Create new account"""
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("accounts").insert({
            "user_id": user["id"],
            "name": request.name,
            "logo_url": request.logo_url,
            "brand_colors": request.brand_colors or [],
            "brand_voice": request.brand_voice
        }).execute()
        
        logger.info(f"✅ Account created: {request.name} for user {user['email']}")
        return response.data[0]
        
    except Exception as e:
        logger.error(f"❌ Create account error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: str,
    user: dict = Depends(get_current_user)
):
    """Get account by ID"""
    account = await get_account_by_id(account_id, user["id"])
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return account

@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    request: UpdateAccountRequest,
    user: dict = Depends(get_current_user)
):
    """Update account"""
    try:
        # Verify ownership
        account = await get_account_by_id(account_id, user["id"])
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        supabase = get_supabase_client()
        
        # Build update data (only fields that were provided)
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.logo_url is not None:
            update_data["logo_url"] = request.logo_url
        if request.brand_colors is not None:
            update_data["brand_colors"] = request.brand_colors
        if request.brand_voice is not None:
            update_data["brand_voice"] = request.brand_voice
        
        response = supabase.table("accounts").update(update_data).eq("id", account_id).execute()
        
        logger.info(f"✅ Account updated: {account_id}")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update account error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{account_id}")
async def delete_account(
    account_id: str,
    user: dict = Depends(get_current_user)
):
    """Delete account (soft delete - set is_active=false)"""
    try:
        # Verify ownership
        account = await get_account_by_id(account_id, user["id"])
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        supabase = get_supabase_client()
        supabase.table("accounts").update({"is_active": False}).eq("id", account_id).execute()
        
        logger.info(f"✅ Account deleted: {account_id}")
        return {"message": "Account deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete account error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
