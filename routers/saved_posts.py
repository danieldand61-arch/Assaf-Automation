"""
Saved Posts Router - Post Library Management
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
import logging
import hashlib
import base64
import uuid
from datetime import datetime, timedelta
from middleware.auth import get_current_user
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/saved-posts", tags=["saved-posts"])


def _upload_base64_to_storage(data_url: str) -> tuple[str, bool]:
    """Upload base64 data URL to Supabase Storage. Returns (public_url, is_video)."""
    try:
        header, b64data = data_url.split(",", 1)
        mime = header.split(":")[1].split(";")[0] if ":" in header else "image/jpeg"
        is_video = mime.startswith("video/")
        ext = "mp4" if is_video else "jpg"
        if "png" in mime:
            ext = "png"
        elif "webp" in mime:
            ext = "webp"

        file_bytes = base64.b64decode(b64data)
        if len(file_bytes) < 100:
            return data_url, False

        supabase = get_supabase()
        filename = f"library/{uuid.uuid4().hex}.{ext}"
        bucket = "posts"
        try:
            supabase.storage.from_(bucket).upload(
                path=filename, file=file_bytes,
                file_options={"content-type": mime, "upsert": "true"}
            )
        except Exception:
            bucket = "products"
            supabase.storage.from_(bucket).upload(
                path=filename, file=file_bytes,
                file_options={"content-type": mime, "upsert": "true"}
            )
        public_url = supabase.storage.from_(bucket).get_public_url(filename)
        logger.info(f"✅ Uploaded media to storage: {filename} ({len(file_bytes)} bytes, video={is_video})")
        return public_url, is_video
    except Exception as e:
        logger.warning(f"⚠️ Failed to upload base64 to storage: {e}")
        return data_url, False


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
        
        # Dedup: check if identical post already exists for this account
        text_hash = hashlib.md5(post.text.strip().encode()).hexdigest()
        existing = supabase.table("saved_posts")\
            .select("id")\
            .eq("account_id", active_account_id)\
            .eq("text_hash", text_hash)\
            .limit(1)\
            .execute()
        
        if existing.data:
            return {
                "success": True,
                "post_id": existing.data[0]["id"],
                "message": "Post already in library",
                "duplicate": True
            }

        image_url = post.image_url or ''
        is_video = False
        if image_url.startswith("data:"):
            image_url, is_video = _upload_base64_to_storage(image_url)

        post_data = {
            "account_id": active_account_id,
            "user_id": current_user["user_id"],
            "text": post.text,
            "hashtags": post.hashtags,
            "call_to_action": post.call_to_action,
            "image_url": image_url,
            "title": post.title,
            "notes": post.notes,
            "source_url": post.source_url,
            "platforms": post.platforms,
            "text_hash": text_hash,
            "saved_at": datetime.utcnow().isoformat(),
            "is_video": is_video,
        }
        if is_video:
            post_data["expires_at"] = (datetime.utcnow() + timedelta(days=7)).isoformat()
        
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
        
        # Clean up expired video posts
        try:
            supabase.table("saved_posts")\
                .delete()\
                .eq("account_id", active_account_id)\
                .eq("is_video", True)\
                .lt("expires_at", datetime.utcnow().isoformat())\
                .execute()
        except Exception:
            pass

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
