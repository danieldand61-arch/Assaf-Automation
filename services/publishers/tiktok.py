"""
TikTok publisher - publishes video content to TikTok
"""
import httpx
import logging
from typing import Dict, Any
import os

logger = logging.getLogger(__name__)

async def publish_to_tiktok(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """
    Publish content to TikTok
    
    Note: TikTok requires video content, not static images.
    
    Args:
        connection: Database connection record with access_token and platform_user_id
        content: Post caption/description
        image_url: URL to video file (not image)
        
    Returns:
        Dict with post_id and post_url
    """
    try:
        access_token = connection.get("access_token")
        open_id = connection.get("platform_user_id")
        
        if not access_token or not open_id:
            raise Exception("Missing access token or user ID")
        
        logger.info(f"🎵 Publishing to TikTok: {open_id}")
        logger.info(f"📹 Video URL: {image_url}")
        
        # Check if this is actually video content
        is_video = any([
            'video' in image_url.lower(),
            '.mp4' in image_url.lower(),
            '/video/' in image_url.lower(),
            image_url.startswith('data:video')
        ])
        
        if not is_video:
            logger.warning("⚠️ TikTok publishing requires video content")
            raise Exception("TikTok requires video content. Please use the Video Translation feature to create TikTok videos.")
        
        # Download video to memory
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Get video data
            if image_url.startswith('http'):
                video_response = await client.get(image_url)
                if video_response.status_code != 200:
                    raise Exception(f"Failed to download video: HTTP {video_response.status_code}")
                video_data = video_response.content
                video_size = len(video_data)
                logger.info(f"📥 Downloaded video: {video_size} bytes")
            else:
                raise Exception("Only HTTP(S) video URLs are supported")
            
            # Step 1: Initialize video upload
            init_url = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/"
            init_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            init_payload = {
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": video_size,
                    "chunk_size": video_size,  # Upload in one chunk
                    "total_chunk_count": 1
                }
            }
            
            logger.info("🔄 Step 1: Initializing TikTok upload...")
            init_response = await client.post(init_url, headers=init_headers, json=init_payload)
            
            if init_response.status_code != 200:
                error_text = init_response.text
                logger.error(f"❌ TikTok init failed: {init_response.status_code} - {error_text}")
                raise Exception(f"TikTok upload init failed: {error_text}")
            
            init_data = init_response.json()
            logger.info(f"✅ Upload initialized: {init_data}")
            
            upload_id = init_data["data"]["upload_id"]
            upload_url = init_data["data"]["upload_url"]
            
            # Step 2: Upload video
            logger.info(f"⬆️ Step 2: Uploading video ({video_size} bytes)...")
            upload_headers = {
                "Content-Range": f"bytes 0-{video_size-1}/{video_size}",
                "Content-Type": "video/mp4"
            }
            
            upload_response = await client.put(upload_url, headers=upload_headers, content=video_data)
            
            if upload_response.status_code not in [200, 201, 204]:
                error_text = upload_response.text
                logger.error(f"❌ TikTok video upload failed: {upload_response.status_code} - {error_text}")
                raise Exception(f"TikTok video upload failed: {error_text}")
            
            logger.info("✅ Video uploaded successfully")
            
            # Step 3: Publish video
            logger.info("📤 Step 3: Publishing video...")
            publish_url = "https://open.tiktokapis.com/v2/post/publish/video/init/"
            publish_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            publish_payload = {
                "post_info": {
                    "title": content[:150],  # TikTok has 150 char limit
                    "privacy_level": "SELF_ONLY",  # Sandbox mode restriction
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                    "video_cover_timestamp_ms": 1000
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_upload_id": upload_id
                }
            }
            
            publish_response = await client.post(publish_url, headers=publish_headers, json=publish_payload)
            
            if publish_response.status_code != 200:
                error_text = publish_response.text
                logger.error(f"❌ TikTok publish failed: {publish_response.status_code} - {error_text}")
                raise Exception(f"TikTok publish failed: {error_text}")
            
            publish_data = publish_response.json()
            logger.info(f"✅ Video published: {publish_data}")
            
            publish_id = publish_data["data"]["publish_id"]
            
            logger.info(f"✅ Published to TikTok: {publish_id}")
            logger.info("⚠️ Note: Video is private (SELF_ONLY) due to Sandbox mode")
            
            return {
                "success": True,
                "post_id": publish_id,
                "post_url": f"https://www.tiktok.com/@{open_id}"
            }
            
    except Exception as e:
        logger.error(f"❌ TikTok publishing error: {str(e)}")
        raise
