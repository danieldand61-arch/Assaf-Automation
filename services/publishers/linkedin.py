"""
LinkedIn publishing integration
Uses LinkedIn API v2
"""
import httpx
import logging
from typing import Optional
import base64

logger = logging.getLogger(__name__)

async def publish_to_linkedin(connection: dict, content: str, image_url: Optional[str] = None) -> dict:
    """
    Publish post to LinkedIn Profile or Company Page
    
    connection: {
        "platform_account_id": "urn:li:person:ABC123" or "urn:li:organization:123456",
        "access_token": "ACCESS_TOKEN"
    }
    
    Returns: {
        "post_id": "urn:li:share:123456789",
        "post_url": "https://linkedin.com/feed/update/urn:li:share:123456789"
    }
    """
    try:
        author_urn = connection["platform_account_id"]
        access_token = connection["access_token"]
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
        }
        
        # Prepare post data
        post_data = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {
                        "text": content
                    },
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }
        
        # If image provided, upload and attach
        if image_url:
            # LinkedIn requires uploading the image first
            # This is a simplified version - full implementation needs multi-step upload
            post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
            post_data["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [
                {
                    "status": "READY",
                    "originalUrl": image_url
                }
            ]
        
        # Make API request
        url = "https://api.linkedin.com/v2/ugcPosts"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=post_data, headers=headers)
            response.raise_for_status()
            result = response.json()
        
        post_id = result.get("id")
        
        logger.info(f"✅ Published to LinkedIn: {post_id}")
        
        return {
            "post_id": post_id,
            "post_url": f"https://www.linkedin.com/feed/update/{post_id}"
        }
        
    except Exception as e:
        logger.error(f"❌ LinkedIn publish error: {str(e)}")
        raise Exception(f"LinkedIn API error: {str(e)}")
