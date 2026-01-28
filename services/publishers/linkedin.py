"""
LinkedIn publisher - publishes content to LinkedIn profiles/pages
"""
import httpx
import logging
import base64
from typing import Dict, Any

logger = logging.getLogger(__name__)

async def publish_to_linkedin(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """
    Publish content to LinkedIn
    
    Args:
        connection: Database connection record with access_token and platform_user_id
        content: Post text
        image_url: URL to image to post (can be base64 data URL)
        
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
            
            author_urn = f"urn:li:person:{user_id}"
            image_urn = None
            
            # Upload image if provided
            if image_url:
                try:
                    # Convert base64 to bytes if needed
                    image_data = None
                    if image_url.startswith('data:'):
                        # Extract base64 data
                        base64_data = image_url.split(',')[1] if ',' in image_url else image_url
                        image_data = base64.b64decode(base64_data)
                        logger.info(f"🖼️ LinkedIn: Converted base64 image ({len(image_data)} bytes)")
                    else:
                        # Download image from URL
                        img_response = await client.get(image_url)
                        if img_response.status_code == 200:
                            image_data = img_response.content
                            logger.info(f"🖼️ LinkedIn: Downloaded image ({len(image_data)} bytes)")
                    
                    if image_data:
                        logger.info(f"🖼️ LinkedIn: Uploading image...")
                        
                        # Step 1: Register upload
                        register_payload = {
                            "registerUploadRequest": {
                                "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                                "owner": author_urn,
                                "serviceRelationships": [
                                    {
                                        "relationshipType": "OWNER",
                                        "identifier": "urn:li:userGeneratedContent"
                                    }
                                ]
                            }
                        }
                        
                        register_response = await client.post(
                            "https://api.linkedin.com/v2/assets?action=registerUpload",
                            headers=headers,
                            json=register_payload
                        )
                        
                        if register_response.status_code not in [200, 201]:
                            raise Exception(f"Failed to register image upload: {register_response.text}")
                        
                        register_data = register_response.json()
                        upload_url = register_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
                        asset_urn = register_data["value"]["asset"]
                        
                        logger.info(f"✅ LinkedIn: Upload registered, asset URN: {asset_urn}")
                        
                        # Step 2: Upload image
                        upload_response = await client.put(
                            upload_url,
                            headers={
                                "Authorization": f"Bearer {access_token}"
                            },
                            content=image_data
                        )
                        
                        if upload_response.status_code not in [200, 201]:
                            raise Exception(f"Failed to upload image: {upload_response.text}")
                        
                        logger.info(f"✅ LinkedIn: Image uploaded successfully")
                        image_urn = asset_urn
                        
                except Exception as img_error:
                    logger.error(f"⚠️ LinkedIn: Image upload failed, posting text only: {str(img_error)}")
                    image_urn = None
            
            # Step 3: Create post with or without image
            if image_urn:
                post_body = {
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": content
                            },
                            "shareMediaCategory": "IMAGE",
                            "media": [
                                {
                                    "status": "READY",
                                    "description": {
                                        "text": "Image"
                                    },
                                    "media": image_urn,
                                    "title": {
                                        "text": "Post Image"
                                    }
                                }
                            ]
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                logger.info(f"📝 LinkedIn: Creating post with image")
            else:
                post_body = {
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
                logger.info(f"📝 LinkedIn: Creating text-only post")
            
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
