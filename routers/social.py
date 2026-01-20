"""
Social Media Connections Router - Instagram & Facebook OAuth Integration
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

FACEBOOK_OAUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth"
FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v19.0"

# ============= Instagram OAuth Flow =============

@router.get("/instagram/connect")
async def instagram_connect(
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1: Get Instagram OAuth authorization URL
    """
    if not FACEBOOK_APP_ID:
        raise HTTPException(status_code=500, detail="Instagram API not configured")
    
    # Get active account for the user
    supabase = get_supabase()
    user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
    active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
    
    if not active_account_id:
        raise HTTPException(status_code=400, detail="No active business account found for user.")
    
    # Facebook OAuth parameters for Instagram Business
    redirect_uri = f"{BACKEND_URL}/api/social/instagram/callback"
    # Minimal scopes for testing - only what's absolutely required
    scope = "pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement"
    
    # Build Facebook authorization URL
    auth_url = (
        f"{FACEBOOK_OAUTH_URL}"
        f"?client_id={FACEBOOK_APP_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&response_type=code"
        f"&state={active_account_id}"  # Pass account_id via state parameter
    )
    
    logger.info(f"🔗 Instagram OAuth: Generated authorization URL")
    logger.info(f"   Account ID: {active_account_id}")
    logger.info(f"   Redirect URI: {redirect_uri}")
    
    return {"auth_url": auth_url}


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
            url=f"{FRONTEND_URL}/settings?tab=social&error={error_description or error}"
        )
    
    if not code or not state:
        logger.error(f"❌ Missing code or state in callback")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Missing authorization code"
        )
    
    account_id = state
    redirect_uri = f"{BACKEND_URL}/api/social/instagram/callback"
    
    try:
        logger.info(f"🔄 Instagram OAuth: Exchanging code for token")
        logger.info(f"   Account ID: {account_id}")
        
        # Exchange code for access token (Facebook Graph API)
        token_url = f"{FACEBOOK_TOKEN_URL}?client_id={FACEBOOK_APP_ID}&redirect_uri={redirect_uri}&client_secret={FACEBOOK_APP_SECRET}&code={code}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(token_url)
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Token exchange failed: {error_text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to get access token"
                )
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                logger.error(f"❌ No access token in response")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Invalid token response"
                )
            
            logger.info(f"✅ User Access token received")
            
            # Get Facebook Pages that user manages
            pages_response = await client.get(
                f"{FACEBOOK_GRAPH_URL}/me/accounts",
                params={"access_token": access_token}
            )
            
            if pages_response.status_code != 200:
                logger.error(f"❌ Failed to get Facebook Pages: {pages_response.text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Could not access Facebook Pages"
                )
            
            pages_data = pages_response.json()
            pages = pages_data.get("data", [])
            
            if not pages:
                logger.error(f"❌ No Facebook Pages found")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=No Facebook Pages found. Please create a Facebook Page and connect it to your Instagram Business account."
                )
            
            # Try to find a page with Instagram Business Account
            instagram_account = None
            page_access_token = None
            
            for page in pages:
                page_id = page.get("id")
                page_token = page.get("access_token")
                
                # Get Instagram Business Account connected to this page
                ig_response = await client.get(
                    f"{FACEBOOK_GRAPH_URL}/{page_id}",
                    params={
                        "fields": "instagram_business_account",
                        "access_token": page_token
                    }
                )
                
                if ig_response.status_code == 200:
                    ig_data = ig_response.json()
                    ig_account = ig_data.get("instagram_business_account")
                    
                    if ig_account:
                        instagram_account = ig_account
                        page_access_token = page_token
                        logger.info(f"✅ Found Instagram Business Account: {ig_account.get('id')}")
                        break
            
            if not instagram_account:
                logger.error(f"❌ No Instagram Business Account found")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=No Instagram Business Account found. Please convert your Instagram account to a Business account and connect it to a Facebook Page."
                )
            
            instagram_user_id = instagram_account.get("id")
            
            # Get Instagram profile info
            profile_response = await client.get(
                f"{FACEBOOK_GRAPH_URL}/{instagram_user_id}",
                params={
                    "fields": "id,username,name,profile_picture_url",
                    "access_token": page_access_token
                }
            )
            
            username = ""
            if profile_response.status_code == 200:
                profile_data = profile_response.json()
                username = profile_data.get("username", "")
                logger.info(f"✅ Profile retrieved: @{username}")
            else:
                logger.warning(f"⚠️ Could not fetch profile info")
        
        # Save connection to database
        supabase = get_supabase()
        
        connection_data = {
            "account_id": account_id,
            "platform": "instagram",
            "access_token": page_access_token,  # Use Page Access Token for API calls
            "refresh_token": None,
            "token_expires_at": None,  # Page tokens don't expire if page exists
            "platform_user_id": instagram_user_id,
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
        
        # Redirect back to frontend settings page with success
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&success=instagram"
        )
        
    except Exception as e:
        logger.error(f"❌ Instagram OAuth callback error: {str(e)}")
        logger.exception("Full traceback:")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Connection failed"
        )


# ============= Facebook Pages OAuth Flow =============

@router.get("/facebook/connect")
async def facebook_connect(
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1: Get Facebook OAuth authorization URL for Facebook Pages
    """
    if not FACEBOOK_APP_ID:
        raise HTTPException(status_code=500, detail="Facebook API not configured")
    
    # Get active account for the user
    supabase = get_supabase()
    user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
    active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
    
    if not active_account_id:
        raise HTTPException(status_code=400, detail="No active business account found for user.")
    
    # Facebook OAuth parameters for Facebook Pages (basic permissions only)
    redirect_uri = f"{BACKEND_URL}/api/social/facebook/callback"
    scope = "pages_show_list,pages_read_engagement,public_profile"
    
    # Build Facebook authorization URL
    auth_url = (
        f"{FACEBOOK_OAUTH_URL}"
        f"?client_id={FACEBOOK_APP_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&response_type=code"
        f"&state={active_account_id}"
    )
    
    logger.info(f"🔗 Facebook OAuth: Generated authorization URL")
    logger.info(f"   Account ID: {active_account_id}")
    logger.info(f"   Redirect URI: {redirect_uri}")
    
    return {"auth_url": auth_url}


@router.get("/facebook/callback")
async def facebook_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_reason: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None)
):
    """
    Step 2: Handle OAuth callback from Facebook
    Exchange authorization code for access token and get Facebook Pages
    """
    if error:
        logger.error(f"❌ Facebook OAuth error: {error} - {error_description}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error={error_description or error}"
        )
    
    if not code or not state:
        logger.error(f"❌ Missing code or state in callback")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Missing authorization code"
        )
    
    account_id = state
    redirect_uri = f"{BACKEND_URL}/api/social/facebook/callback"
    
    try:
        logger.info(f"🔄 Facebook OAuth: Exchanging code for token")
        logger.info(f"   Account ID: {account_id}")
        
        # Exchange code for access token (Facebook Graph API)
        token_url = f"{FACEBOOK_TOKEN_URL}?client_id={FACEBOOK_APP_ID}&redirect_uri={redirect_uri}&client_secret={FACEBOOK_APP_SECRET}&code={code}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(token_url)
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Token exchange failed: {error_text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to get access token"
                )
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            
            if not access_token:
                logger.error(f"❌ No access token in response")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Invalid token response"
                )
            
            logger.info(f"✅ User Access token received")
            
            # Get Facebook Pages that user manages
            pages_response = await client.get(
                f"{FACEBOOK_GRAPH_URL}/me/accounts",
                params={"access_token": access_token}
            )
            
            if pages_response.status_code != 200:
                logger.error(f"❌ Failed to get Facebook Pages: {pages_response.text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Could not access Facebook Pages"
                )
            
            pages_data = pages_response.json()
            pages = pages_data.get("data", [])
            
            if not pages:
                logger.error(f"❌ No Facebook Pages found")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=No Facebook Pages found. Please create a Facebook Page first."
                )
            
            # Use the first page (or we can later add page selection)
            page = pages[0]
            page_id = page.get("id")
            page_name = page.get("name")
            page_access_token = page.get("access_token")
            
            logger.info(f"✅ Found Facebook Page: {page_name}")
            
            # Get page profile picture
            page_picture_url = None
            try:
                picture_response = await client.get(
                    f"{FACEBOOK_GRAPH_URL}/{page_id}/picture",
                    params={"redirect": "false", "access_token": page_access_token}
                )
                if picture_response.status_code == 200:
                    picture_data = picture_response.json()
                    page_picture_url = picture_data.get("data", {}).get("url")
            except:
                pass
        
        # Save connection to database
        supabase = get_supabase()
        
        connection_data = {
            "account_id": account_id,
            "platform": "facebook",
            "access_token": page_access_token,
            "refresh_token": None,
            "token_expires_at": None,
            "platform_user_id": page_id,
            "platform_username": page_name,
            "platform_profile_url": page_picture_url,
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
        logger.info(f"   Platform: Facebook ({page_name})")
        
        # Redirect back to frontend settings page with success
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&success=facebook"
        )
        
    except Exception as e:
        logger.error(f"❌ Facebook OAuth callback error: {str(e)}")
        logger.exception("Full traceback:")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Connection failed"
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
