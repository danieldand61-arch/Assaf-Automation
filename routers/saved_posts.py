"""
Saved Posts Router - Post Library Management
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
import logging
from datetime import datetime
from middleware.auth import get_current_user
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/saved-posts", tags=["saved-posts"])


class SavePostRequest(BaseModel):
    text: str
    hashtags: List[str] = []
    call_to_action: Optional[str] = None
    image_url: Optional[str] = None
    title: Optional[str] = None
    notes: Optional[str] = None
    source_url: Optional[str] = None
    platforms: List[str] = []


class UpdatePostRequest(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None


@router.post("/save")
async def save_post(
    post: SavePostRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Save a post to the library
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
        
        # Save post
        post_data = {
            "account_id": active_account_id,
            "user_id": current_user["user_id"],
            "text": post.text,
            "hashtags": post.hashtags,
            "call_to_action": post.call_to_action,
            "image_url": post.image_url,
            "title": post.title,
            "notes": post.notes,
            "source_url": post.source_url,
            "platforms": post.platforms,
            "saved_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("saved_posts").insert(post_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save post")
        
        logger.info(f"✅ Post saved to library: {result.data[0]['id']}")
        
        return {
            "success": True,
            "post_id": result.data[0]["id"],
            "message": "Post saved to library"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Save post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def get_saved_posts(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all saved posts for current account
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
        
        # Get saved posts
        result = supabase.table("saved_posts")\
            .select("*")\
            .eq("account_id", active_account_id)\
            .order("created_at", desc=True)\
            .execute()
        
        posts = result.data if result.data else []
        
        return {
            "success": True,
            "posts": posts,
            "total": len(posts)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get saved posts error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{post_id}")
async def get_saved_post(
    post_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a specific saved post
    """
    try:
        supabase = get_supabase()
        
        result = supabase.table("saved_posts")\
            .select("*")\
            .eq("id", post_id)\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        return {
            "success": True,
            "post": result.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get saved post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{post_id}")
async def update_saved_post(
    post_id: str,
    update: UpdatePostRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update a saved post (title, notes)
    """
    try:
        supabase = get_supabase()
        
        update_data = {}
        if update.title is not None:
            update_data["title"] = update.title
        if update.notes is not None:
            update_data["notes"] = update.notes
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        update_data["updated_at"] = datetime.utcnow().isoformat()
        
        result = supabase.table("saved_posts")\
            .update(update_data)\
            .eq("id", post_id)\
            .eq("user_id", current_user["user_id"])\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        return {
            "success": True,
            "message": "Post updated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update saved post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{post_id}")
async def delete_saved_post(
    post_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a saved post
    """
    try:
        supabase = get_supabase()
        
        result = supabase.table("saved_posts")\
            .delete()\
            .eq("id", post_id)\
            .eq("user_id", current_user["user_id"])\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Post not found")
        
        logger.info(f"✅ Post deleted from library: {post_id}")
        
        return {
            "success": True,
            "message": "Post deleted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete saved post error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
