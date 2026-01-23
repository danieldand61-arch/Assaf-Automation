"""
Instagram publisher - publishes content to Instagram Business accounts
"""
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

async def publish_to_instagram(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """
    Publish content to Instagram Business account
    
    Args:
        connection: Database connection record with access_token and platform_user_id
        content: Post caption text
        image_url: URL to image to post
        
    Returns:
        Dict with post_id and post_url
    """
    try:
        access_token = connection.get("access_token")
        instagram_account_id = connection.get("platform_user_id")
        
        if not access_token or not instagram_account_id:
            raise Exception("Missing access token or account ID")
        
        logger.info(f"📸 Publishing to Instagram account: {instagram_account_id}")
        
        # Instagram Graph API - Create container
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Create media container
            container_response = await client.post(
                f"https://graph.facebook.com/v19.0/{instagram_account_id}/media",
                params={
                    "image_url": image_url,
                    "caption": content,
                    "access_token": access_token
                }
            )
            
            if container_response.status_code != 200:
                error_text = container_response.text
                logger.error(f"❌ Failed to create container: {error_text}")
                raise Exception(f"Instagram container creation failed: {error_text}")
            
            container_data = container_response.json()
            container_id = container_data.get("id")
            
            logger.info(f"✅ Media container created: {container_id}")
            
            # Step 2: Publish the container
            publish_response = await client.post(
                f"https://graph.facebook.com/v19.0/{instagram_account_id}/media_publish",
                params={
                    "creation_id": container_id,
                    "access_token": access_token
                }
            )
            
            if publish_response.status_code != 200:
                error_text = publish_response.text
                logger.error(f"❌ Failed to publish: {error_text}")
                raise Exception(f"Instagram publish failed: {error_text}")
            
            publish_data = publish_response.json()
            post_id = publish_data.get("id")
            
            logger.info(f"✅ Published to Instagram: {post_id}")
            
            return {
                "success": True,
                "post_id": post_id,
                "post_url": f"https://www.instagram.com/p/{post_id}/"
            }
            
    except Exception as e:
        logger.error(f"❌ Instagram publishing error: {str(e)}")
        raise
