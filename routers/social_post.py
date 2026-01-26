"""
Social Media Post Router - Post text/images to connected platforms
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional, List
import httpx
import os
import logging
from middleware.auth import get_current_user
from database.supabase_client import get_supabase
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/social", tags=["social-post"])

FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v19.0"
LINKEDIN_API_URL = "https://api.linkedin.com/v2"
TWITTER_API_URL = "https://api.twitter.com/2"


async def post_to_facebook(connection: dict, text: str, image_data: Optional[bytes]) -> dict:
    """Post to Facebook Page"""
    try:
        access_token = connection["access_token"]
        page_id = connection["platform_user_id"]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {
                "message": text,
                "access_token": access_token
            }
            
            if image_data:
                # Upload photo
                response = await client.post(
                    f"{FACEBOOK_GRAPH_URL}/{page_id}/photos",
                    params=params,
                    files={"source": image_data}
                )
            else:
                # Post text only
                response = await client.post(
                    f"{FACEBOOK_GRAPH_URL}/{page_id}/feed",
                    params=params
                )
            
            if response.status_code != 200:
                raise Exception(f"Facebook API error: {response.text}")
            
            data = response.json()
            return {"success": True, "post_id": data.get("id") or data.get("post_id")}
            
    except Exception as e:
        logger.error(f"Facebook post error: {str(e)}")
        raise


async def post_to_instagram(connection: dict, text: str, image_data: Optional[bytes]) -> dict:
    """Post to Instagram Business Account"""
    try:
        if not image_data:
            raise Exception("Instagram requires an image")
        
        access_token = connection["access_token"]
        instagram_account_id = connection["platform_user_id"]
        
        # First upload image to a temporary location (or use a URL)
        # For now, this is simplified - in production you'd upload to your server first
        raise Exception("Instagram posting requires image URL. Upload image to your server first.")
        
        # The flow would be:
        # 1. Upload image to your server
        # 2. Get public URL
        # 3. Create media container with URL
        # 4. Publish container
        
    except Exception as e:
        logger.error(f"Instagram post error: {str(e)}")
        raise


async def post_to_linkedin(connection: dict, text: str, image_data: Optional[bytes]) -> dict:
    """Post to LinkedIn with text and optional image"""
    try:
        access_token = connection["access_token"]
        user_id = connection["platform_user_id"]
        author_urn = f"urn:li:person:{user_id}"
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            image_urn = None
            
            # Step 1 & 2: Upload image if provided
            if image_data:
                try:
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
                        logger.error(f"❌ LinkedIn: Failed to register upload: {register_response.text}")
                        raise Exception(f"Failed to register image upload: {register_response.text}")
                    
                    register_data = register_response.json()
                    upload_url = register_data["value"]["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
                    asset_urn = register_data["value"]["asset"]
                    
                    logger.info(f"✅ LinkedIn: Upload registered, asset URN: {asset_urn}")
                    
                    # Step 2: Upload image to the URL
                    upload_response = await client.put(
                        upload_url,
                        headers={
                            "Authorization": f"Bearer {access_token}"
                        },
                        content=image_data
                    )
                    
                    if upload_response.status_code not in [200, 201]:
                        logger.error(f"❌ LinkedIn: Failed to upload image: {upload_response.text}")
                        raise Exception(f"Failed to upload image: {upload_response.text}")
                    
                    logger.info(f"✅ LinkedIn: Image uploaded successfully")
                    image_urn = asset_urn
                    
                except Exception as img_error:
                    logger.error(f"⚠️ LinkedIn: Image upload failed, posting text only: {str(img_error)}")
                    # Continue with text-only post if image upload fails
                    image_urn = None
            
            # Step 3: Create post with or without image
            if image_urn:
                # Post with image
                post_body = {
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": text
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
                # Text-only post
                post_body = {
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": text
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
                raise Exception(f"LinkedIn API error: {response.text}")
            
            data = response.json()
            post_id = data.get("id", "")
            logger.info(f"✅ LinkedIn: Post created successfully: {post_id}")
            
            return {"success": True, "post_id": post_id}
            
    except Exception as e:
        logger.error(f"LinkedIn post error: {str(e)}")
        raise


async def post_to_twitter(connection: dict, text: str, image_data: Optional[bytes]) -> dict:
    """Post to Twitter/X"""
    try:
        access_token = connection["access_token"]
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            media_id = None
            
            # Upload image if provided
            if image_data:
                media_response = await client.post(
                    "https://upload.twitter.com/1.1/media/upload.json",
                    headers={"Authorization": f"Bearer {access_token}"},
                    files={"media": image_data}
                )
                
                if media_response.status_code == 200:
                    media_id = media_response.json().get("media_id_string")
            
            # Create tweet
            tweet_data = {"text": text}
            if media_id:
                tweet_data["media"] = {"media_ids": [media_id]}
            
            response = await client.post(
                f"{TWITTER_API_URL}/tweets",
                headers=headers,
                json=tweet_data
            )
            
            if response.status_code not in [200, 201]:
                raise Exception(f"Twitter API error: {response.text}")
            
            data = response.json()
            tweet_id = data.get("data", {}).get("id")
            return {"success": True, "post_id": tweet_id}
            
    except Exception as e:
        logger.error(f"Twitter post error: {str(e)}")
        raise


@router.post("/post")
async def post_to_social_media(
    text: str = Form(...),
    platforms: str = Form(...),  # JSON array as string
    image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Post content to selected social media platforms
    """
    try:
        logger.info(f"📤 Posting to social media")
        logger.info(f"   User: {current_user['user_id']}")
        logger.info(f"   Text: {text[:50]}...")
        
        # Parse platforms
        platforms_list = json.loads(platforms)
        logger.info(f"   Platforms: {platforms_list}")
        
        # Get active account
        supabase = get_supabase()
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active account found")
        
        # Read image if provided
        image_data = None
        if image:
            image_data = await image.read()
            logger.info(f"   Image size: {len(image_data) / 1024:.2f}KB")
        
        # Post to each platform
        results = {}
        
        for platform in platforms_list:
            try:
                # Get connection for this platform
                connection = supabase.table("account_connections")\
                    .select("*")\
                    .eq("account_id", active_account_id)\
                    .eq("platform", platform)\
                    .eq("is_connected", True)\
                    .single()\
                    .execute()
                
                if not connection.data:
                    results[platform] = {"success": False, "error": "Not connected"}
                    continue
                
                # Post to platform
                if platform == "facebook":
                    result = await post_to_facebook(connection.data, text, image_data)
                elif platform == "instagram":
                    result = await post_to_instagram(connection.data, text, image_data)
                elif platform == "linkedin":
                    result = await post_to_linkedin(connection.data, text, image_data)
                elif platform == "twitter":
                    result = await post_to_twitter(connection.data, text, image_data)
                else:
                    results[platform] = {"success": False, "error": "Unsupported platform"}
                    continue
                
                results[platform] = result
                logger.info(f"   ✅ Posted to {platform}")
                
            except Exception as e:
                logger.error(f"   ❌ Failed to post to {platform}: {str(e)}")
                results[platform] = {"success": False, "error": str(e)}
        
        # Check if all succeeded
        all_success = all(r.get("success", False) for r in results.values())
        
        return {
            "success": all_success,
            "results": results,
            "message": "Posted successfully" if all_success else "Some posts failed"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Post error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))
