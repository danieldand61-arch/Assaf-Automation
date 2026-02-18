"""
Twitter/X publisher - publishes content to Twitter
"""
import httpx
import logging
from typing import Dict, Any
import base64

logger = logging.getLogger(__name__)

async def publish_to_twitter(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """
    Publish content to Twitter/X
    
    Args:
        connection: Database connection record with access_token and platform_user_id
        content: Tweet text
        image_url: URL to image to post
        
    Returns:
        Dict with post_id and post_url
    """
    try:
        access_token = connection.get("access_token")
        username = connection.get("platform_username", "").replace("@", "")
        
        if not access_token:
            raise Exception("Missing access token")
        
        logger.info(f"🐦 Publishing to Twitter: @{username}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            media_id = None
            
            # Upload image if provided
            if image_url:
                image_data = None
                if image_url.startswith("data:"):
                    # Handle base64 data URLs from AI image generation
                    try:
                        header, b64data = image_url.split(",", 1)
                        image_data = base64.b64decode(b64data)
                        logger.info(f"📷 Decoded base64 image: {len(image_data)} bytes")
                    except Exception as e:
                        logger.error(f"❌ Failed to decode base64 image: {e}")
                elif image_url.startswith("http"):
                    img_response = await client.get(image_url)
                    if img_response.status_code == 200:
                        image_data = img_response.content
                        logger.info(f"📷 Downloaded image: {len(image_data)} bytes")
                
                if image_data:
                    media_response = await client.post(
                        "https://upload.twitter.com/1.1/media/upload.json",
                        headers={"Authorization": f"Bearer {access_token}"},
                        files={"media": image_data}
                    )
                    
                    if media_response.status_code == 200:
                        media_id = media_response.json().get("media_id_string")
                        logger.info(f"✅ Image uploaded: {media_id}")
                    else:
                        logger.warning(f"⚠️ Image upload failed: {media_response.status_code} - {media_response.text[:200]}")
            
            # Truncate to Twitter 280 char limit
            if len(content) > 280:
                content = content[:277] + "..."
            
            tweet_data = {"text": content}
            
            if media_id:
                tweet_data["media"] = {"media_ids": [media_id]}
            
            response = await client.post(
                "https://api.twitter.com/2/tweets",
                headers=headers,
                json=tweet_data
            )
            
            if response.status_code not in [200, 201]:
                error_text = response.text
                logger.error(f"❌ Twitter publish failed: {error_text}")
                raise Exception(f"Twitter publish failed: {error_text}")
            
            data = response.json()
            tweet_data_result = data.get("data", {})
            tweet_id = tweet_data_result.get("id")
            
            logger.info(f"✅ Published to Twitter: {tweet_id}")
            
            return {
                "success": True,
                "post_id": tweet_id,
                "post_url": f"https://twitter.com/{username}/status/{tweet_id}"
            }
            
    except Exception as e:
        logger.error(f"❌ Twitter publishing error: {str(e)}")
        raise
