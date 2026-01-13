"""
Post scheduling routes
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from database.supabase_client import get_supabase_client
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])

class SchedulePostRequest(BaseModel):
    account_id: str
    platforms: List[str]
    content: str
    hashtags: List[str] = []
    image_url: Optional[str] = None
    scheduled_at: datetime
    timezone: str = "UTC"
    is_recurring: bool = False
    recurring_pattern: Optional[str] = None

class UpdateScheduledPostRequest(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None

@router.post("/schedule")
async def schedule_post(
    request: SchedulePostRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Schedule a post for future publication
    """
    try:
        supabase = get_supabase_client()
        
        # Verify account ownership
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", request.account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Create scheduled post
        response = supabase.table("scheduled_posts").insert({
            "account_id": request.account_id,
            "platforms": request.platforms,
            "content": request.content,
            "hashtags": request.hashtags,
            "image_url": request.image_url,
            "scheduled_at": request.scheduled_at.isoformat(),
            "timezone": request.timezone,
            "is_recurring": request.is_recurring,
            "recurring_pattern": request.recurring_pattern,
            "status": "pending"
        }).execute()
        
        logger.info(f"✅ Post scheduled for {request.scheduled_at}")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error scheduling post: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/posts")
async def get_scheduled_posts(
    account_id: str,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all scheduled posts for an account
    """
    try:
        supabase = get_supabase_client()
        
        # Verify account ownership
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Query scheduled posts
        query = supabase.table("scheduled_posts")\
            .select("*")\
            .eq("account_id", account_id)\
            .order("scheduled_at", desc=False)
        
        if status:
            query = query.eq("status", status)
        
        response = query.execute()
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching scheduled posts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/posts/{post_id}")
async def get_scheduled_post(
    post_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a single scheduled post by ID
    """
    try:
        supabase = get_supabase_client()
        
        # Get post with account check
        response = supabase.table("scheduled_posts")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", post_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching post: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/posts/{post_id}")
async def update_scheduled_post(
    post_id: str,
    request: UpdateScheduledPostRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a scheduled post
    """
    try:
        supabase = get_supabase_client()
        
        # Verify ownership
        post = supabase.table("scheduled_posts")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", post_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not post.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Build update data
        update_data = {}
        if request.content is not None:
            update_data["content"] = request.content
        if request.image_url is not None:
            update_data["image_url"] = request.image_url
        if request.scheduled_at is not None:
            update_data["scheduled_at"] = request.scheduled_at.isoformat()
        if request.status is not None:
            update_data["status"] = request.status
        
        response = supabase.table("scheduled_posts")\
            .update(update_data)\
            .eq("id", post_id)\
            .execute()
        
        logger.info(f"✅ Post {post_id} updated")
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating post: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/posts/{post_id}")
async def delete_scheduled_post(
    post_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel/delete a scheduled post
    """
    try:
        supabase = get_supabase_client()
        
        # Verify ownership and update status to cancelled
        post = supabase.table("scheduled_posts")\
            .select("*, accounts!inner(user_id)")\
            .eq("id", post_id)\
            .eq("accounts.user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not post.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        # Soft delete - set status to cancelled
        supabase.table("scheduled_posts")\
            .update({"status": "cancelled"})\
            .eq("id", post_id)\
            .execute()
        
        logger.info(f"✅ Post {post_id} cancelled")
        return {"message": "Post cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting post: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/calendar")
async def get_calendar_view(
    account_id: str,
    start_date: datetime,
    end_date: datetime,
    current_user: dict = Depends(get_current_user)
):
    """
    Get posts for calendar view (date range)
    """
    try:
        supabase = get_supabase_client()
        
        # Verify account ownership
        account = supabase.table("accounts")\
            .select("*")\
            .eq("id", account_id)\
            .eq("user_id", current_user["id"])\
            .single()\
            .execute()
        
        if not account.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Get posts in date range
        response = supabase.table("scheduled_posts")\
            .select("*")\
            .eq("account_id", account_id)\
            .gte("scheduled_at", start_date.isoformat())\
            .lte("scheduled_at", end_date.isoformat())\
            .neq("status", "cancelled")\
            .order("scheduled_at")\
            .execute()
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching calendar: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
