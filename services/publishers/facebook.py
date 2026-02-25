"""
Facebook publisher - publishes content to Facebook Pages
"""
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

async def publish_to_facebook(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """
    Publish content to Facebook Page
    
    Args:
        connection: Database connection record with access_token and platform_user_id (page_id)
        content: Post text
        image_url: URL to image to post
        
    Returns:
        Dict with post_id and post_url
    """
    try:
        access_token = connection.get("access_token")
        page_id = connection.get("platform_user_id")
        
        if not access_token or not page_id:
            raise Exception("Missing access token or page ID")
        
        logger.info(f"📘 Publishing to Facebook page: {page_id}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if image_url:
                endpoint = f"https://graph.facebook.com/v19.0/{page_id}/photos"
                response = await client.post(
                    endpoint,
                    data={"message": content, "url": image_url, "access_token": access_token}
                )
            else:
                endpoint = f"https://graph.facebook.com/v19.0/{page_id}/feed"
                response = await client.post(
                    endpoint,
                    data={"message": content, "access_token": access_token}
                )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Facebook publish failed: {error_text}")
                raise Exception(f"Facebook publish failed: {error_text}")
            
            data = response.json()
            post_id = data.get("id") or data.get("post_id")
            
            logger.info(f"✅ Published to Facebook: {post_id}")
            
            return {
                "success": True,
                "post_id": post_id,
                "post_url": f"https://www.facebook.com/{post_id}"
            }
            
    except Exception as e:
        logger.error(f"❌ Facebook publishing error: {str(e)}")
        raise
