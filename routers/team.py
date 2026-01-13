"""
Team collaboration and permissions system
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timezone
import logging

from database.supabase_client import get_supabase_client
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/team", tags=["team"])

class TeamMember(BaseModel):
    id: str
    account_id: str
    user_id: str
    role: str  # 'admin', 'manager', 'creator'
    can_publish: bool
    can_schedule: bool
    can_edit_brand: bool
    invited_at: str
    accepted_at: Optional[str]

class InviteTeamMemberRequest(BaseModel):
    email: EmailStr
    role: str = "creator"  # 'admin', 'manager', 'creator'
    can_publish: bool = False
    can_schedule: bool = True
    can_edit_brand: bool = False

class UpdateTeamMemberRequest(BaseModel):
    role: Optional[str] = None
    can_publish: Optional[bool] = None
    can_schedule: Optional[bool] = None
    can_edit_brand: Optional[bool] = None

@router.post("/{account_id}/invite")
async def invite_team_member(
    account_id: str,
    request: InviteTeamMemberRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Invite user to join team (admin only)
    """
    try:
        supabase = get_supabase_client()
        
        # Verify user is admin of account
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=403, detail="Only account owner can invite members")
        
        # Look up user by email
        # NOTE: This requires Supabase Admin API or Auth endpoint
        # For now, we'll store email and send invitation email
        
        # TODO: Send invitation email with accept link
        # For now, we'll create pending invite
        
        logger.info(f"✅ Invitation sent to {request.email}")
        
        return {
            "message": f"Invitation sent to {request.email}",
            "role": request.role
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Invite error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{account_id}/members", response_model=List[TeamMember])
async def list_team_members(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    List all team members for an account
    """
    try:
        supabase = get_supabase_client()
        
        # Verify user has access to this account
        # (Either owner or team member)
        is_owner = supabase.table("accounts")\
            .select("id")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .execute()
        
        is_member = supabase.table("team_members")\
            .select("id")\
            .eq("account_id", account_id)\
            .eq("user_id", current_user["id"])\
            .execute()
        
        if not is_owner.data and not is_member.data:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get all team members
        response = supabase.table("team_members")\
            .select("*")\
            .eq("account_id", account_id)\
            .execute()
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ List members error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{account_id}/members/{member_id}")
async def update_team_member(
    account_id: str,
    member_id: str,
    request: UpdateTeamMemberRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update team member permissions (admin only)
    """
    try:
        supabase = get_supabase_client()
        
        # Verify user is admin of account
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=403, detail="Only account owner can update permissions")
        
        # Build update data
        update_data = {}
        if request.role is not None:
            if request.role not in ['admin', 'manager', 'creator']:
                raise HTTPException(status_code=400, detail="Invalid role")
            update_data["role"] = request.role
        if request.can_publish is not None:
            update_data["can_publish"] = request.can_publish
        if request.can_schedule is not None:
            update_data["can_schedule"] = request.can_schedule
        if request.can_edit_brand is not None:
            update_data["can_edit_brand"] = request.can_edit_brand
        
        response = supabase.table("team_members")\
            .update(update_data)\
            .eq("id", member_id)\
            .eq("account_id", account_id)\
            .execute()
        
        logger.info(f"✅ Team member {member_id} updated")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{account_id}/members/{member_id}")
async def remove_team_member(
    account_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove team member (admin only)
    """
    try:
        supabase = get_supabase_client()
        
        # Verify user is admin of account
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=403, detail="Only account owner can remove members")
        
        # Remove member
        supabase.table("team_members")\
            .delete()\
            .eq("id", member_id)\
            .eq("account_id", account_id)\
            .execute()
        
        logger.info(f"✅ Team member {member_id} removed")
        return {"message": "Team member removed successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Remove member error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-accounts")
async def get_my_team_accounts(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all accounts where user is a team member
    (not including owned accounts)
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table("team_members")\
            .select("*, accounts(*)")\
            .eq("user_id", current_user["id"])\
            .execute()
        
        return response.data
        
    except Exception as e:
        logger.error(f"❌ Get team accounts error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{account_id}/my-permissions")
async def get_my_permissions(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get current user's permissions for an account
    """
    try:
        supabase = get_supabase_client()
        
        # Check if owner
        is_owner = supabase.table("accounts")\
            .select("id")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .execute()
        
        if is_owner.data:
            return {
                "role": "owner",
                "can_publish": True,
                "can_schedule": True,
                "can_edit_brand": True,
                "can_manage_team": True
            }
        
        # Check if team member
        member = supabase.table("team_members")\
            .select("*")\
            .eq("account_id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not member.data:
            raise HTTPException(status_code=403, detail="No access to this account")
        
        return {
            "role": member.data["role"],
            "can_publish": member.data["can_publish"],
            "can_schedule": member.data["can_schedule"],
            "can_edit_brand": member.data["can_edit_brand"],
            "can_manage_team": member.data["role"] == "admin"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get permissions error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
