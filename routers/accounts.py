"""
Business accounts management routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import logging
import asyncio
from database.supabase_client import get_supabase
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["accounts"])
logger = logging.getLogger(__name__)

class CreateAccountRequest(BaseModel):
    name: str
    description: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    brand_voice: str = "professional"
    logo_url: Optional[str] = None
    brand_colors: List[str] = []
    metadata: Optional[dict] = None

class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    brand_voice: Optional[str] = None
    logo_url: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    metadata: Optional[dict] = None
    default_language: Optional[str] = None
    default_include_emojis: Optional[bool] = None
    default_include_logo: Optional[bool] = None

@router.get("")
async def get_accounts(user = Depends(get_current_user)):
    """
    Get all accounts for current user
    """
    try:
        supabase = get_supabase()
        
        # Get accounts owned by user
        owned_accounts = supabase.table("accounts").select("*").eq("user_id", user["user_id"]).eq("is_active", True).execute()
        
        # Get accounts where user is a team member
        team_accounts = supabase.table("team_members").select("account_id, role, accounts(*)").eq("user_id", user["user_id"]).execute()
        
        accounts = owned_accounts.data
        
        # Add team accounts
        for team_member in team_accounts.data:
            if team_member.get("accounts"):
                account = team_member["accounts"]
                account["role"] = team_member["role"]  # Add user's role
                accounts.append(account)
        
        return {
            "accounts": accounts,
            "total": len(accounts)
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{account_id}")
async def get_account(account_id: str, user = Depends(get_current_user)):
    """
    Get specific account details
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("accounts").select("*").eq("id", account_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Verify user has access
        if response.data["user_id"] != user["user_id"]:
            # Check if user is team member
            team_check = supabase.table("team_members").select("role").eq("account_id", account_id).eq("user_id", user["user_id"]).execute()
            if not team_check.data:
                raise HTTPException(status_code=403, detail="Access denied")
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_account(request: CreateAccountRequest, user = Depends(get_current_user)):
    """
    Create a new business account.
    Includes retry logic for race condition where Supabase Auth returns JWT
    before auth.users row is committed to the database.
    
    postgrest-py APIError has .code, .message, .details attributes;
    str(e) returns empty string due to a bug in __init__, so we check attrs directly.
    """
    supabase = get_supabase()
    user_id = user["user_id"]
    
    # Pre-check: verify user exists in Supabase Auth service
    try:
        auth_user = supabase.auth.admin.get_user_by_id(user_id)
        if not auth_user or not getattr(auth_user, 'user', None):
            logger.error(f"❌ User {user_id} not found in Supabase Auth")
            raise HTTPException(
                status_code=404,
                detail="User not found. Please sign out and register again."
            )
        logger.info(f"✅ User {user_id} confirmed in Supabase Auth")
    except HTTPException:
        raise
    except Exception as e:
        # Non-blocking: if admin API fails, proceed and let DB handle it
        logger.warning(f"⚠️ Auth admin check failed (proceeding anyway): {e}")
    
    # Retry INSERT — auth.users row may not be committed yet
    max_retries = 10
    last_error = None
    
    for attempt in range(max_retries):
        try:
            response = supabase.table("accounts").insert({
                "user_id": user_id,
                "name": request.name,
                "description": request.description,
                "industry": request.industry,
                "target_audience": request.target_audience,
                "brand_voice": request.brand_voice,
                "logo_url": request.logo_url,
                "brand_colors": request.brand_colors,
                "metadata": request.metadata or {}
            }).execute()
            
            logger.info(f"✅ Account created: {request.name} by {user['email']}")
            return {"success": True, "account": response.data[0]}
            
        except Exception as e:
            last_error = e
            # postgrest APIError: check .code/.message/.details (str(e) is empty!)
            err_code = getattr(e, 'code', '') or ''
            err_msg = getattr(e, 'message', '') or ''
            err_details = getattr(e, 'details', '') or ''
            err_repr = repr(e)
            
            is_fk_error = (
                err_code == '23503'
                or 'foreign key' in err_msg.lower()
                or 'is not present in table' in err_details.lower()
                or 'foreign key' in err_repr.lower()
            )
            
            if is_fk_error and attempt < max_retries - 1:
                logger.warning(
                    f"⏳ FK violation: user {user_id} not in auth.users yet. "
                    f"Retry {attempt + 1}/{max_retries}..."
                )
                await asyncio.sleep(1)
                continue
            
            logger.error(
                f"❌ Create account failed: code={err_code}, "
                f"msg={err_msg}, details={err_details}"
            )
            break
    
    # Return meaningful error
    err_detail = getattr(last_error, 'message', '') or repr(last_error)
    raise HTTPException(status_code=500, detail=err_detail)


@router.patch("/{account_id}")
async def update_account(account_id: str, request: UpdateAccountRequest, user = Depends(get_current_user)):
    """
    Update account details
    """
    try:
        supabase = get_supabase()
        
        # Verify ownership
        account = supabase.table("accounts").select("user_id, metadata").eq("id", account_id).single().execute()
        if not account.data or account.data["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build update dict (only include provided fields)
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Merge metadata if provided (don't overwrite existing keys)
        if 'metadata' in update_data:
            existing_metadata = account.data.get('metadata', {}) or {}
            new_metadata = update_data['metadata'] or {}
            update_data['metadata'] = {**existing_metadata, **new_metadata}
        
        response = supabase.table("accounts").update(update_data).eq("id", account_id).execute()
        
        logger.info(f"✅ Account updated: {account_id}")
        
        return {
            "success": True,
            "account": response.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{account_id}")
async def delete_account(account_id: str, user = Depends(get_current_user)):
    """
    Delete (deactivate) account
    """
    try:
        supabase = get_supabase()
        
        # Verify ownership
        account = supabase.table("accounts").select("user_id").eq("id", account_id).single().execute()
        if not account.data or account.data["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Soft delete (set is_active = false)
        supabase.table("accounts").update({"is_active": False}).eq("id", account_id).execute()
        
        logger.info(f"🗑️ Account deleted: {account_id}")
        
        return {
            "success": True,
            "message": "Account deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{account_id}/switch")
async def switch_active_account(account_id: str, user = Depends(get_current_user)):
    """
    Switch active account for user
    """
    try:
        supabase = get_supabase()
        
        # Verify user has access to this account
        account_check = supabase.table("accounts").select("id").eq("id", account_id).eq("user_id", user["user_id"]).execute()
        
        if not account_check.data:
            # Check team membership
            team_check = supabase.table("team_members").select("account_id").eq("account_id", account_id).eq("user_id", user["user_id"]).execute()
            if not team_check.data:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Update user settings
        supabase.table("user_settings").update({
            "active_account_id": account_id
        }).eq("user_id", user["user_id"]).execute()
        
        logger.info(f"🔄 User {user['email']} switched to account {account_id}")
        
        return {
            "success": True,
            "active_account_id": account_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error switching account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
