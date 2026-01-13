"""
Instagram publishing integration
Uses Instagram Graph API (requires Facebook Business account)
"""
import httpx
import logging
from typing import Optional
import asyncio

logger = logging.getLogger(__name__)

async def publish_to_instagram(connection: dict, content: str, image_url: Optional[str] = None) -> dict:
    """
    Publish post to Instagram Business Account
    
    Instagram requires a 2-step process:
    1. Create media container
    2. Publish the container
    
    connection: {
        "platform_account_id": "INSTAGRAM_BUSINESS_ACCOUNT_ID",
        "access_token": "USER_ACCESS_TOKEN"
    }
    
    Returns: {
        "post_id": "17895695668004550",
        "post_url": "https://instagram.com/p/..."
    }
    """
    try:
        if not image_url:
            raise Exception("Instagram requires an image URL")
        
        instagram_account_id = connection["platform_account_id"]
        access_token = connection["access_token"]
        
        # Step 1: Create media container
        create_url = f"https://graph.facebook.com/v19.0/{instagram_account_id}/media"
        create_data = {
            "image_url": image_url,
            "caption": content,
            "access_token": access_token
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Create container
            response = await client.post(create_url, data=create_data)
            response.raise_for_status()
            container_result = response.json()
            
            container_id = container_result.get("id")
            if not container_id:
                raise Exception("Failed to create media container")
            
            logger.info(f"✅ Instagram container created: {container_id}")
            
            # Wait a moment for Instagram to process the media
            await asyncio.sleep(2)
            
            # Step 2: Publish the container
            publish_url = f"https://graph.facebook.com/v19.0/{instagram_account_id}/media_publish"
            publish_data = {
                "creation_id": container_id,
                "access_token": access_token
            }
            
            response = await client.post(publish_url, data=publish_data)
            response.raise_for_status()
            publish_result = response.json()
            
            media_id = publish_result.get("id")
        
        logger.info(f"✅ Published to Instagram: {media_id}")
        
        return {
            "post_id": media_id,
            "post_url": f"https://www.instagram.com/p/{media_id}"  # This is a shortcode, may need conversion
        }
        
    except Exception as e:
        logger.error(f"❌ Instagram publish error: {str(e)}")
        raise Exception(f"Instagram API error: {str(e)}")
