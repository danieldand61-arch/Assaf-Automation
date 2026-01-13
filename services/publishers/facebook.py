"""
Facebook publishing integration
Uses Facebook Graph API
"""
import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def publish_to_facebook(connection: dict, content: str, image_url: Optional[str] = None) -> dict:
    """
    Publish post to Facebook Page
    
    connection: {
        "platform_account_id": "PAGE_ID",
        "access_token": "PAGE_ACCESS_TOKEN"
    }
    
    Returns: {
        "post_id": "123456789_987654321",
        "post_url": "https://facebook.com/..."
    }
    """
    try:
        page_id = connection["platform_account_id"]
        access_token = connection["access_token"]
        
        # Facebook Graph API endpoint
        url = f"https://graph.facebook.com/v19.0/{page_id}/feed"
        
        # Prepare post data
        data = {
            "message": content,
            "access_token": access_token
        }
        
        # If image URL provided, upload as photo
        if image_url:
            url = f"https://graph.facebook.com/v19.0/{page_id}/photos"
            data["url"] = image_url  # URL to image
            data["caption"] = content
        
        # Make API request
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data)
            response.raise_for_status()
            result = response.json()
        
        post_id = result.get("id") or result.get("post_id")
        
        logger.info(f"✅ Published to Facebook: {post_id}")
        
        return {
            "post_id": post_id,
            "post_url": f"https://www.facebook.com/{post_id}"
        }
        
    except Exception as e:
        logger.error(f"❌ Facebook publish error: {str(e)}")
        raise Exception(f"Facebook API error: {str(e)}")
