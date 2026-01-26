"""
TikTok Video Upload Router
Handles video uploads to TikTok via Content Posting API
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
import httpx
import os
import logging
from middleware.auth import get_current_user
from database.supabase_client import get_supabase
import hashlib
import mimetypes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tiktok", tags=["tiktok-upload"])

TIKTOK_API_URL = "https://open.tiktokapis.com/v2"

# TikTok video requirements
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB
ALLOWED_FORMATS = ["video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"]
MIN_DURATION = 3  # seconds
MAX_DURATION = 600  # 10 minutes


@router.post("/upload-video")
async def upload_video_to_tiktok(
    video: UploadFile = File(...),
    title: str = Form(...),
    privacy_level: str = Form("PUBLIC_TO_EVERYONE"),  # or MUTUAL_FOLLOW_FRIENDS, SELF_ONLY
    disable_duet: bool = Form(False),
    disable_comment: bool = Form(False),
    disable_stitch: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a video to TikTok
    
    Steps:
    1. Get TikTok connection with access token
    2. Initialize upload (get upload URL)
    3. Upload video chunks to TikTok
    4. Publish video with metadata
    """
    try:
        logger.info(f"🎬 Starting TikTok video upload")
        logger.info(f"   User: {current_user['user_id']}")
        logger.info(f"   Video: {video.filename}")
        logger.info(f"   Title: {title}")
        
        # Get active account
        supabase = get_supabase()
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active account found")
        
        # Get TikTok connection
        connection = supabase.table("account_connections")\
            .select("*")\
            .eq("account_id", active_account_id)\
            .eq("platform", "tiktok")\
            .eq("is_connected", True)\
            .single()\
            .execute()
        
        if not connection.data:
            raise HTTPException(
                status_code=400, 
                detail="TikTok not connected. Please connect your TikTok account first."
            )
        
        access_token = connection.data["access_token"]
        
        # Validate video file
        content_type = video.content_type
        if content_type not in ALLOWED_FORMATS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid video format. Allowed: MP4, MOV, WEBM, AVI"
            )
        
        # Read video content
        video_content = await video.read()
        video_size = len(video_content)
        
        if video_size > MAX_VIDEO_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Video too large. Max size: {MAX_VIDEO_SIZE / (1024*1024)}MB"
            )
        
        logger.info(f"   Video size: {video_size / (1024*1024):.2f}MB")
        
        # Step 1: Initialize upload
        logger.info("📤 Step 1: Initializing upload...")
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            init_response = await client.post(
                f"{TIKTOK_API_URL}/post/publish/video/init/",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8"
                },
                json={
                    "post_info": {
                        "title": title,
                        "privacy_level": privacy_level,
                        "disable_duet": disable_duet,
                        "disable_comment": disable_comment,
                        "disable_stitch": disable_stitch,
                        "video_cover_timestamp_ms": 1000
                    },
                    "source_info": {
                        "source": "FILE_UPLOAD",
                        "video_size": video_size,
                        "chunk_size": video_size,  # Upload in one chunk
                        "total_chunk_count": 1
                    }
                }
            )
            
            if init_response.status_code != 200:
                error_data = init_response.json()
                logger.error(f"❌ Init failed: {error_data}")
                raise HTTPException(
                    status_code=init_response.status_code,
                    detail=f"TikTok upload init failed: {error_data.get('error', {}).get('message', 'Unknown error')}"
                )
            
            init_data = init_response.json()
            
            if init_data.get("error", {}).get("code") != "ok":
                error_msg = init_data.get("error", {}).get("message", "Unknown error")
                logger.error(f"❌ Init error: {error_msg}")
                raise HTTPException(status_code=400, detail=f"TikTok error: {error_msg}")
            
            upload_url = init_data["data"]["upload_url"]
            publish_id = init_data["data"]["publish_id"]
            
            logger.info(f"✅ Upload initialized. Publish ID: {publish_id}")
            
            # Step 2: Upload video
            logger.info("📤 Step 2: Uploading video...")
            
            upload_response = await client.put(
                upload_url,
                headers={
                    "Content-Type": "video/mp4",
                    "Content-Length": str(video_size)
                },
                content=video_content
            )
            
            if upload_response.status_code not in [200, 201]:
                logger.error(f"❌ Upload failed: {upload_response.status_code}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to upload video to TikTok servers"
                )
            
            logger.info(f"✅ Video uploaded successfully")
            
            # Step 3: Check publish status
            logger.info("📤 Step 3: Checking publish status...")
            
            status_response = await client.post(
                f"{TIKTOK_API_URL}/post/publish/status/fetch/",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8"
                },
                json={
                    "publish_id": publish_id
                }
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                status = status_data.get("data", {}).get("status")
                logger.info(f"   Status: {status}")
            
            logger.info(f"✅ Video published to TikTok!")
            
            return {
                "success": True,
                "publish_id": publish_id,
                "status": "processing",
                "message": "Video uploaded successfully! TikTok is processing it now."
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ TikTok upload error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/check-status/{publish_id}")
async def check_publish_status(
    publish_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check the status of a video publish
    """
    try:
        # Get active account
        supabase = get_supabase()
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active account found")
        
        # Get TikTok connection
        connection = supabase.table("account_connections")\
            .select("*")\
            .eq("account_id", active_account_id)\
            .eq("platform", "tiktok")\
            .eq("is_connected", True)\
            .single()\
            .execute()
        
        if not connection.data:
            raise HTTPException(status_code=400, detail="TikTok not connected")
        
        access_token = connection.data["access_token"]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{TIKTOK_API_URL}/post/publish/status/fetch/",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json; charset=UTF-8"
                },
                json={
                    "publish_id": publish_id
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail="Failed to check status"
                )
            
            data = response.json()
            return {
                "success": True,
                "data": data.get("data", {})
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Status check error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
