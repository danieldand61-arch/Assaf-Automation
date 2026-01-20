"""
Social Media Connections Router - Instagram OAuth Integration
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from fastapi.responses import RedirectResponse
from typing import Optional
import httpx
import os
import logging
from datetime import datetime, timedelta
from middleware.auth import get_current_user, get_account_id
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/social", tags=["social-connections"])

# ============= Configuration =============
FACEBOOK_APP_ID = os.getenv("FACEBOOK_APP_ID")
FACEBOOK_APP_SECRET = os.getenv("FACEBOOK_APP_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://assaf-automation.vercel.app")
BACKEND_URL = os.getenv("BACKEND_URL", "https://assaf-automation-production.up.railway.app")

INSTAGRAM_OAUTH_URL = "https://api.instagram.com/oauth/authorize"
INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token"
FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v18.0"

# ============= Instagram OAuth Flow =============

@router.get("/instagram/connect")
async def instagram_connect(
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1: Redirect user to Instagram OAuth authorization
    """
    if not FACEBOOK_APP_ID:
        raise HTTPException(status_code=500, detail="Instagram API not configured")
    
    # Get active account for the user
    supabase = get_supabase()
    user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
    active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
    
    if not active_account_id:
        raise HTTPException(status_code=400, detail="No active business account found for user.")
    
    # Instagram OAuth parameters
    redirect_uri = f"{BACKEND_URL}/api/social/instagram/callback"
    scope = "instagram_basic,instagram_content_publish"
    
    # Build authorization URL
    auth_url = (
        f"{INSTAGRAM_OAUTH_URL}"
        f"?client_id={FACEBOOK_APP_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&response_type=code"
        f"&state={active_account_id}"  # Pass account_id via state parameter
    )
    
    logger.info(f"🔗 Instagram OAuth: Redirecting user to authorization")
    logger.info(f"   Account ID: {active_account_id}")
    logger.info(f"   Redirect URI: {redirect_uri}")
    
    return RedirectResponse(url=auth_url)


@router.get("/instagram/callback")
async def instagram_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),  # account_id
    error: Optional[str] = Query(None),
    error_reason: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None)
):
    """
    Step 2: Handle OAuth callback from Instagram
    Exchange authorization code for access token
    """
    # Check for errors
    if error:
        logger.error(f"❌ Instagram OAuth error: {error} - {error_description}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/connections?error={error_description or error}"
        )
    
    if not code or not state:
        logger.error(f"❌ Missing code or state in callback")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/connections?error=Missing authorization code"
        )
    
    account_id = state
    redirect_uri = f"{BACKEND_URL}/api/social/instagram/callback"
    
    try:
        logger.info(f"🔄 Instagram OAuth: Exchanging code for token")
        logger.info(f"   Account ID: {account_id}")
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                INSTAGRAM_TOKEN_URL,
                data={
                    "client_id": FACEBOOK_APP_ID,
                    "client_secret": FACEBOOK_APP_SECRET,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": code
                }
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Token exchange failed: {error_text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/connections?error=Failed to get access token"
                )
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            user_id_ig = token_data.get("user_id")
            
            if not access_token:
                logger.error(f"❌ No access token in response")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/connections?error=Invalid token response"
                )
            
            logger.info(f"✅ Access token received for user: {user_id_ig}")
            
            # Get user profile info from Instagram Graph API
            profile_response = await client.get(
                f"{FACEBOOK_GRAPH_URL}/{user_id_ig}",
                params={
                    "fields": "id,username,account_type",
                    "access_token": access_token
                }
            )
            
            if profile_response.status_code == 200:
                profile_data = profile_response.json()
                username = profile_data.get("username", "")
                account_type = profile_data.get("account_type", "")
                
                logger.info(f"✅ Profile retrieved: @{username} ({account_type})")
            else:
                username = ""
                logger.warning(f"⚠️ Could not fetch profile info")
        
        # Save connection to database
        supabase = get_supabase()
        
        connection_data = {
            "account_id": account_id,
            "platform": "instagram",
            "access_token": access_token,
            "refresh_token": None,  # Instagram Graph API doesn't use refresh tokens
            "token_expires_at": None,  # Long-lived tokens don't expire
            "platform_user_id": user_id_ig,
            "platform_username": username,
            "platform_profile_url": f"https://www.instagram.com/{username}" if username else None,
            "is_connected": True,
            "last_connected_at": datetime.utcnow().isoformat(),
            "connection_error": None,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Upsert connection (update if exists, insert if not)
        result = supabase.table("account_connections").upsert(
            connection_data,
            on_conflict="account_id,platform"
        ).execute()
        
        logger.info(f"✅ Connection saved to database")
        logger.info(f"   Account: {account_id}")
        logger.info(f"   Platform: Instagram (@{username})")
        
        # Redirect back to frontend connections page
        return RedirectResponse(
            url=f"{FRONTEND_URL}/connections?success=instagram"
        )
        
    except Exception as e:
        logger.error(f"❌ Instagram OAuth callback error: {str(e)}")
        logger.exception("Full traceback:")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/connections?error=Connection failed"
        )


@router.get("/connections")
async def get_connections(
    current_user: dict = Depends(get_current_user)
):
    """
    Get all social media connections for current account
    """
    try:
        supabase = get_supabase()
        
        # Get active account for the user
        user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
        active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active business account found for user.")
        
        result = supabase.table("account_connections").select("*").eq(
            "account_id", active_account_id
        ).execute()
        
        connections = result.data if result.data else []
        
        # Don't send access tokens to frontend
        for conn in connections:
            conn.pop("access_token", None)
            conn.pop("refresh_token", None)
        
        return {
            "success": True,
            "connections": connections
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get connections: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/connections/{platform}")
async def disconnect_platform(
    platform: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Disconnect a social media platform
    """
    try:
        supabase = get_supabase()
        
        # Get active account for the user
        user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
        active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
        
        if not active_account_id:
            raise HTTPException(status_code=400, detail="No active business account found for user.")
        
        result = supabase.table("account_connections").delete().match({
            "account_id": active_account_id,
            "platform": platform
        }).execute()
        
        logger.info(f"✅ Disconnected {platform} from account {active_account_id}")
        
        return {
            "success": True,
            "message": f"{platform.capitalize()} disconnected successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to disconnect {platform}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "instagram_configured": bool(FACEBOOK_APP_ID and FACEBOOK_APP_SECRET),
        "facebook_app_id": FACEBOOK_APP_ID[:10] + "..." if FACEBOOK_APP_ID else None
    }
