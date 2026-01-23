"""
LinkedIn publisher - publishes content to LinkedIn profiles/pages
"""
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

async def publish_to_linkedin(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """
    Publish content to LinkedIn
    
    Args:
        connection: Database connection record with access_token and platform_user_id
        content: Post text
        image_url: URL to image to post
        
    Returns:
        Dict with post_id and post_url
    """
    try:
        access_token = connection.get("access_token")
        user_id = connection.get("platform_user_id")
        
        if not access_token or not user_id:
            raise Exception("Missing access token or user ID")
        
        logger.info(f"💼 Publishing to LinkedIn: {user_id}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            # Create post body
            post_body = {
                "author": f"urn:li:person:{user_id}",
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
            
            # Add image if provided
            if image_url:
                post_body["specificContent"]["com.linkedin.ugc.ShareContent"]["shareMediaCategory"] = "IMAGE"
                post_body["specificContent"]["com.linkedin.ugc.ShareContent"]["media"] = [{
                    "status": "READY",
                    "description": {
                        "text": content
                    },
                    "media": image_url,
                    "title": {
                        "text": "Post"
                    }
                }]
            
            # Note: LinkedIn API v2 UGC endpoint requires w_member_social scope
            # This is a simplified version that might need adjustment based on actual API approval
            response = await client.post(
                "https://api.linkedin.com/v2/ugcPosts",
                headers=headers,
                json=post_body
            )
            
            if response.status_code not in [200, 201]:
                error_text = response.text
                logger.error(f"❌ LinkedIn publish failed: {error_text}")
                raise Exception(f"LinkedIn publish failed: {error_text}")
            
            data = response.json()
            post_id = data.get("id", "")
            
            logger.info(f"✅ Published to LinkedIn: {post_id}")
            
            return {
                "success": True,
                "post_id": post_id,
                "post_url": f"https://www.linkedin.com/feed/update/{post_id}"
            }
            
    except Exception as e:
        logger.error(f"❌ LinkedIn publishing error: {str(e)}")
        raise
