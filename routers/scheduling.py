"""
Post scheduling routes with Supabase integration
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import logging
from middleware.auth import get_current_user
from database.supabase_client import get_supabase

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])
logger = logging.getLogger(__name__)

class SchedulePostRequest(BaseModel):
    post_data: dict  # {text, hashtags, cta, imageUrl}
    platforms: List[str]
    scheduled_time: str  # ISO format
    timezone: str = "UTC"

class ScheduledPost(BaseModel):
    id: str
    post_data: dict
    platforms: List[str]
    scheduled_time: str
    status: str
    created_at: str

@router.post("/schedule")
async def schedule_post(
    request: SchedulePostRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Schedule a post for later publication
    """
    try:
        supabase = get_supabase()
        
        # Get active account
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active account found")
        
        if not request.platforms:
            raise HTTPException(status_code=400, detail="Select at least one platform to post")
        
        # Validate scheduled time is in future
        scheduled_dt = datetime.fromisoformat(request.scheduled_time.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        if scheduled_dt <= now:
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
        
        # Create scheduled post in database
        post_data = {
            "account_id": active_account_id,
            "user_id": current_user["user_id"],
            "text": request.post_data.get("text", ""),
            "hashtags": request.post_data.get("hashtags", []),
            "call_to_action": request.post_data.get("cta", ""),
            "image_url": request.post_data.get("imageUrl"),
            "scheduled_time": scheduled_dt.isoformat(),
            "timezone": request.timezone,
            "platforms": request.platforms,
            "status": "pending"
        }
        
        result = supabase.table("scheduled_posts").insert(post_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create scheduled post")
        
        created_post = result.data[0]
        
        logger.info(f"📅 Scheduled post {created_post['id']} for {request.scheduled_time}")
        logger.info(f"   Account: {active_account_id}")
        logger.info(f"   Platforms: {request.platforms}")
        
        return {
            "success": True,
            "post_id": created_post["id"],
            "scheduled_time": request.scheduled_time,
            "message": "Post scheduled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Scheduling error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduled")
async def get_scheduled_posts(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all scheduled posts for current account
    """
    try:
        supabase = get_supabase()
        
        # Get active account
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        if not active_account_id:
            return {"scheduled_posts": [], "total": 0}
        
        # Get scheduled posts for this account
        result = supabase.table("scheduled_posts")\
            .select("*")\
            .eq("account_id", active_account_id)\
            .order("scheduled_time", desc=False)\
            .execute()
        
        posts = result.data if result.data else []
        
        return {
            "success": True,
            "scheduled_posts": posts,
            "total": len(posts)
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching scheduled posts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scheduled/{post_id}")
async def cancel_scheduled_post(
    post_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel a scheduled post
    """
    try:
        supabase = get_supabase()
        
        # Get active account
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active account found")
        
        # Delete the post (only if it belongs to user's account)
        result = supabase.table("scheduled_posts")\
            .delete()\
            .eq("id", post_id)\
            .eq("account_id", active_account_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Scheduled post not found")
        
        logger.info(f"🗑️ Cancelled scheduled post {post_id}")
        
        return {
            "success": True,
            "message": "Scheduled post cancelled"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error cancelling post: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/publish-now")
async def publish_now(
    request: SchedulePostRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Publish a post immediately to connected platforms
    """
    try:
        supabase = get_supabase()
        
        # Get active account
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active account found")
        
        if not request.platforms:
            raise HTTPException(status_code=400, detail="Select at least one platform to post")
        
        # Schedule for immediate execution (current time)
        now = datetime.now(timezone.utc)
        
        post_data = {
            "account_id": active_account_id,
            "user_id": current_user["user_id"],
            "text": request.post_data.get("text", ""),
            "hashtags": request.post_data.get("hashtags", []),
            "call_to_action": request.post_data.get("cta", ""),
            "image_url": request.post_data.get("imageUrl"),
            "scheduled_time": now.isoformat(),
            "timezone": request.timezone,
            "platforms": request.platforms,
            "status": "pending"
        }
        
        result = supabase.table("scheduled_posts").insert(post_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create post")
        
        created_post = result.data[0]
        
        logger.info(f"📤 Created immediate post {created_post['id']}")
        logger.info(f"   Account: {active_account_id}")
        logger.info(f"   Platforms: {request.platforms}")
        
        return {
            "success": True,
            "post_id": created_post["id"],
            "message": "Post will be published shortly"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Publish now error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))
