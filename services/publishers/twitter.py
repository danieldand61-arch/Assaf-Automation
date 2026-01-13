"""
Twitter/X publishing integration
Uses Twitter API v2
"""
import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def publish_to_twitter(connection: dict, content: str, image_url: Optional[str] = None) -> dict:
    """
    Publish tweet to Twitter/X
    
    connection: {
        "platform_account_id": "USER_ID",
        "access_token": "OAUTH_ACCESS_TOKEN"
    }
    
    Returns: {
        "post_id": "1234567890",
        "post_url": "https://twitter.com/user/status/1234567890"
    }
    """
    try:
        access_token = connection["access_token"]
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Prepare tweet data
        tweet_data = {
            "text": content
        }
        
        # If image provided, upload first and attach media_id
        if image_url:
            # Twitter requires uploading media first to get media_id
            # This is simplified - full implementation needs multi-part upload
            logger.warning("⚠️ Twitter image upload not fully implemented yet")
            # tweet_data["media"] = {"media_ids": [media_id]}
        
        # Make API request
        url = "https://api.twitter.com/2/tweets"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=tweet_data, headers=headers)
            response.raise_for_status()
            result = response.json()
        
        tweet_id = result["data"]["id"]
        
        logger.info(f"✅ Published to Twitter: {tweet_id}")
        
        return {
            "post_id": tweet_id,
            "post_url": f"https://twitter.com/i/status/{tweet_id}"
        }
        
    except Exception as e:
        logger.error(f"❌ Twitter publish error: {str(e)}")
        raise Exception(f"Twitter API error: {str(e)}")
