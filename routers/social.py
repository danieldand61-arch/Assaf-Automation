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
LINKEDIN_CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET")
TWITTER_CLIENT_ID = os.getenv("TWITTER_CLIENT_ID")
TWITTER_CLIENT_SECRET = os.getenv("TWITTER_CLIENT_SECRET")
TIKTOK_CLIENT_KEY = os.getenv("TIKTOK_CLIENT_KEY")
TIKTOK_CLIENT_SECRET = os.getenv("TIKTOK_CLIENT_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://assaf-automation.vercel.app")
BACKEND_URL = os.getenv("BACKEND_URL", "https://assaf-automation-production.up.railway.app")

FACEBOOK_OAUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth"
FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
FACEBOOK_GRAPH_URL = "https://graph.facebook.com/v19.0"

LINKEDIN_OAUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_API_URL = "https://api.linkedin.com/v2"

TWITTER_OAUTH_URL = "https://twitter.com/i/oauth2/authorize"
TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
TWITTER_API_URL = "https://api.twitter.com/2"

TIKTOK_OAUTH_URL = "https://www.tiktok.com/v2/auth/authorize"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_API_URL = "https://open.tiktokapis.com/v2"

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
    # Basic scopes for Development Mode (work for Admins and Test Users)
    # instagram_basic, instagram_content_publish require App Review for production
    scope = "pages_show_list,public_profile"
    
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
    logger.info(f"   📎 Full Auth URL: {auth_url}")
    
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
    logger.info(f"   📎 Full Auth URL: {auth_url}")
    
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


# ============= LinkedIn OAuth Flow =============

@router.get("/linkedin/connect")
async def linkedin_connect(
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1: Get LinkedIn OAuth authorization URL
    """
    if not LINKEDIN_CLIENT_ID:
        raise HTTPException(status_code=500, detail="LinkedIn API not configured")
    
    # Get active account for the user
    supabase = get_supabase()
    user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
    active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
    
    if not active_account_id:
        raise HTTPException(status_code=400, detail="No active business account found for user.")
    
    # LinkedIn OAuth parameters for Organization Pages
    redirect_uri = f"{BACKEND_URL}/api/social/linkedin/callback"
    # LinkedIn scopes for posting content
    # openid, profile, email - basic info
    # w_member_social - required for posting on behalf of the user
    # w_organization_social - required for posting on Company Pages (optional)
    scope = "openid profile email w_member_social"
    state = active_account_id  # Pass account_id as state
    
    # Build authorization URL
    auth_url = (
        f"{LINKEDIN_OAUTH_URL}?"
        f"response_type=code&"
        f"client_id={LINKEDIN_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"state={state}&"
        f"scope={scope}"
    )
    
    logger.info(f"🔗 LinkedIn OAuth: Generated authorization URL")
    logger.info(f"   Account ID: {active_account_id}")
    logger.info(f"   Redirect URI: {redirect_uri}")
    
    return {"auth_url": auth_url}


@router.get("/linkedin/callback")
async def linkedin_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),  # account_id
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None)
):
    """
    Step 2: Handle OAuth callback from LinkedIn
    Exchange authorization code for access token
    """
    # Check for errors
    if error:
        logger.error(f"❌ LinkedIn OAuth error: {error} - {error_description}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error={error_description or error}"
        )
    
    if not code or not state:
        logger.error(f"❌ Missing code or state in callback")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Missing authorization code"
        )
    
    account_id = state
    redirect_uri = f"{BACKEND_URL}/api/social/linkedin/callback"
    
    try:
        logger.info(f"🔄 LinkedIn OAuth: Exchanging code for token")
        logger.info(f"   Account ID: {account_id}")
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                LINKEDIN_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": LINKEDIN_CLIENT_ID,
                    "client_secret": LINKEDIN_CLIENT_SECRET,
                    "redirect_uri": redirect_uri
                }
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Token exchange failed: {error_text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to get access token"
                )
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 5184000)  # 60 days default
            
            if not access_token:
                logger.error(f"❌ No access token in response")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Invalid token response"
                )
            
            logger.info(f"✅ Access token received")
            
            # Get user profile
            profile_response = await client.get(
                f"{LINKEDIN_API_URL}/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if profile_response.status_code != 200:
                logger.error(f"❌ Failed to get profile: {profile_response.text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Could not access LinkedIn profile"
                )
            
            profile_data = profile_response.json()
            user_sub = profile_data.get("sub")  # LinkedIn user ID
            user_name = profile_data.get("name", "LinkedIn User")
            user_email = profile_data.get("email", "")
            
            logger.info(f"✅ Profile retrieved: {user_name}")
            
            # Use personal profile for now
            # TODO: Add organization pages support when r_organization_social scope is approved
            platform_username = user_name
            platform_profile_url = f"https://www.linkedin.com/in/{user_email.split('@')[0]}" if user_email else "https://www.linkedin.com/"
            platform_user_id = user_sub
            
            logger.info(f"✅ Using personal profile: {platform_username}")
            
            # Save connection to database
            supabase = get_supabase()
            
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            connection_data = {
                "account_id": account_id,
                "platform": "linkedin",
                "platform_user_id": platform_user_id,
                "platform_username": platform_username,
                "platform_profile_url": platform_profile_url,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expires_at": expires_at.isoformat(),
                "is_connected": True,
                "last_connected_at": datetime.now().isoformat()
            }
            
            # Upsert connection
            result = supabase.table("account_connections").upsert(
                connection_data,
                on_conflict="account_id,platform"
            ).execute()
            
            if not result.data:
                logger.error(f"❌ Failed to save connection")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to save connection"
                )
            
            logger.info(f"✅ LinkedIn connection saved successfully")
            
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&success=linkedin"
        )
        
    except Exception as e:
        logger.error(f"❌ LinkedIn OAuth callback error: {str(e)}")
        logger.exception("Full traceback:")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Connection failed"
        )


# ============= Twitter/X OAuth Flow =============

@router.get("/twitter/connect")
async def twitter_connect(
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1: Get Twitter/X OAuth authorization URL (OAuth 2.0 with PKCE)
    """
    if not TWITTER_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Twitter API not configured")
    
    # Get active account for the user
    supabase = get_supabase()
    user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
    active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
    
    if not active_account_id:
        raise HTTPException(status_code=400, detail="No active business account found for user.")
    
    # Twitter OAuth parameters
    redirect_uri = f"{BACKEND_URL}/api/social/twitter/callback"
    scope = "tweet.read tweet.write users.read offline.access"
    state = active_account_id
    
    # Generate code_challenge for PKCE (Twitter requires PKCE)
    import hashlib
    import base64
    import secrets
    
    code_verifier = secrets.token_urlsafe(32)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).decode().rstrip('=')
    
    # Store code_verifier temporarily (in production, use Redis or DB)
    # For now, we'll pass it via state (not recommended for production)
    state_data = f"{active_account_id}:{code_verifier}"
    
    # Build authorization URL
    auth_url = (
        f"{TWITTER_OAUTH_URL}?"
        f"response_type=code&"
        f"client_id={TWITTER_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scope}&"
        f"state={state_data}&"
        f"code_challenge={code_challenge}&"
        f"code_challenge_method=S256"
    )
    
    logger.info(f"🔗 Twitter OAuth: Generated authorization URL")
    logger.info(f"   Account ID: {active_account_id}")
    logger.info(f"   Redirect URI: {redirect_uri}")
    
    return {"auth_url": auth_url}


@router.get("/twitter/callback")
async def twitter_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None)
):
    """
    Step 2: Handle OAuth callback from Twitter/X
    Exchange authorization code for access token
    """
    if error:
        logger.error(f"❌ Twitter OAuth error: {error} - {error_description}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error={error_description or error}"
        )
    
    if not code or not state:
        logger.error(f"❌ Missing code or state in callback")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Missing authorization code"
        )
    
    # Extract account_id and code_verifier from state
    try:
        account_id, code_verifier = state.split(':', 1)
    except ValueError:
        logger.error(f"❌ Invalid state format")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Invalid state"
        )
    
    redirect_uri = f"{BACKEND_URL}/api/social/twitter/callback"
    
    try:
        logger.info(f"🔄 Twitter OAuth: Exchanging code for token")
        logger.info(f"   Account ID: {account_id}")
        
        # Exchange code for access token
        import base64
        auth_string = f"{TWITTER_CLIENT_ID}:{TWITTER_CLIENT_SECRET}"
        auth_b64 = base64.b64encode(auth_string.encode()).decode()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                TWITTER_TOKEN_URL,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {auth_b64}"
                },
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code_verifier": code_verifier
                }
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Token exchange failed: {error_text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to get access token"
                )
            
            token_data = response.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 7200)
            
            if not access_token:
                logger.error(f"❌ No access token in response")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Invalid token response"
                )
            
            logger.info(f"✅ Access token received")
            
            # Get user profile
            profile_response = await client.get(
                f"{TWITTER_API_URL}/users/me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if profile_response.status_code != 200:
                logger.error(f"❌ Failed to get profile: {profile_response.text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Could not access Twitter profile"
                )
            
            profile_data = profile_response.json()
            user_data = profile_data.get("data", {})
            user_id = user_data.get("id")
            username = user_data.get("username")
            name = user_data.get("name")
            
            logger.info(f"✅ Profile retrieved: @{username}")
            
            # Save connection to database
            supabase = get_supabase()
            
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            connection_data = {
                "account_id": account_id,
                "platform": "twitter",
                "platform_user_id": user_id,
                "platform_username": f"@{username}",
                "platform_profile_url": f"https://twitter.com/{username}",
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expires_at": expires_at.isoformat(),
                "is_connected": True,
                "last_connected_at": datetime.now().isoformat()
            }
            
            # Upsert connection
            result = supabase.table("account_connections").upsert(
                connection_data,
                on_conflict="account_id,platform"
            ).execute()
            
            if not result.data:
                logger.error(f"❌ Failed to save connection")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to save connection"
                )
            
            logger.info(f"✅ Twitter connection saved successfully")
            
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&success=twitter"
        )
        
    except Exception as e:
        logger.error(f"❌ Twitter OAuth callback error: {str(e)}")
        logger.exception("Full traceback:")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Connection failed"
        )


# ============= TikTok OAuth Flow =============

@router.get("/tiktok/connect")
async def tiktok_connect(
    current_user: dict = Depends(get_current_user)
):
    """
    Step 1: Get TikTok OAuth authorization URL
    """
    if not TIKTOK_CLIENT_KEY:
        raise HTTPException(status_code=500, detail="TikTok API not configured")
    
    # Get active account for the user
    supabase = get_supabase()
    user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
    active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
    
    if not active_account_id:
        raise HTTPException(status_code=400, detail="No active business account found for user.")
    
    # TikTok OAuth parameters
    redirect_uri = f"{BACKEND_URL}/api/social/tiktok/callback"
    scope = "user.info.basic,video.publish,video.upload"
    state = active_account_id
    
    # Build authorization URL
    auth_url = (
        f"{TIKTOK_OAUTH_URL}?"
        f"client_key={TIKTOK_CLIENT_KEY}&"
        f"scope={scope}&"
        f"response_type=code&"
        f"redirect_uri={redirect_uri}&"
        f"state={state}"
    )
    
    logger.info(f"🔗 TikTok OAuth: Generated authorization URL")
    logger.info(f"   Account ID: {active_account_id}")
    logger.info(f"   Redirect URI: {redirect_uri}")
    
    return {"auth_url": auth_url}


@router.get("/tiktok/callback")
async def tiktok_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None)
):
    """
    Step 2: Handle OAuth callback from TikTok
    Exchange authorization code for access token
    """
    if error:
        logger.error(f"❌ TikTok OAuth error: {error} - {error_description}")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error={error_description or error}"
        )
    
    if not code or not state:
        logger.error(f"❌ Missing code or state in callback")
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&error=Missing authorization code"
        )
    
    account_id = state
    redirect_uri = f"{BACKEND_URL}/api/social/tiktok/callback"
    
    try:
        logger.info(f"🔄 TikTok OAuth: Exchanging code for token")
        logger.info(f"   Account ID: {account_id}")
        
        # Exchange code for access token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                TIKTOK_TOKEN_URL,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": TIKTOK_CLIENT_KEY,
                    "client_secret": TIKTOK_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri
                }
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Token exchange failed: {error_text}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to get access token"
                )
            
            token_data = response.json()
            logger.info(f"📦 TikTok token response: {token_data}")
            
            # TikTok returns tokens directly in root, not in "data" field
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")
            expires_in = token_data.get("expires_in", 86400)
            open_id = token_data.get("open_id")
            
            if not access_token:
                logger.error(f"❌ No access token in response")
                logger.error(f"   Full response: {token_data}")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Invalid token response"
                )
            
            logger.info(f"✅ Access token received")
            
            # Get user profile
            profile_response = await client.post(
                f"{TIKTOK_API_URL}/user/info/",
                headers={
                    "Content-Type": "application/json"
                },
                json={
                    "access_token": access_token
                }
            )
            
            username = ""
            profile_url = ""
            
            if profile_response.status_code == 200:
                profile_data = profile_response.json()
                user_data = profile_data.get("data", {}).get("user", {})
                username = user_data.get("display_name", "")
                profile_url = user_data.get("profile_deep_link", "")
                logger.info(f"✅ Profile retrieved: {username}")
            else:
                logger.warning(f"⚠️ Could not fetch profile info")
                username = f"TikTok User {open_id[:8]}"
            
            # Save connection to database
            supabase = get_supabase()
            
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            connection_data = {
                "account_id": account_id,
                "platform": "tiktok",
                "platform_user_id": open_id,
                "platform_username": username,
                "platform_profile_url": profile_url,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expires_at": expires_at.isoformat(),
                "is_connected": True,
                "last_connected_at": datetime.now().isoformat()
            }
            
            # Upsert connection
            result = supabase.table("account_connections").upsert(
                connection_data,
                on_conflict="account_id,platform"
            ).execute()
            
            if not result.data:
                logger.error(f"❌ Failed to save connection")
                return RedirectResponse(
                    url=f"{FRONTEND_URL}/settings?tab=social&error=Failed to save connection"
                )
            
            logger.info(f"✅ TikTok connection saved successfully")
            
        return RedirectResponse(
            url=f"{FRONTEND_URL}/settings?tab=social&success=tiktok"
        )
        
    except Exception as e:
        logger.error(f"❌ TikTok OAuth callback error: {str(e)}")
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


@router.get("/meta-ads/connect")
async def meta_ads_connect(current_user: dict = Depends(get_current_user)):
    """Start Meta Marketing API OAuth (ads_read scope)."""
    if not FACEBOOK_APP_ID:
        raise HTTPException(status_code=500, detail="Facebook API not configured")

    supabase = get_supabase()
    user_settings = supabase.table("user_settings").select("active_account_id").eq("user_id", current_user["user_id"]).single().execute()
    active_account_id = user_settings.data["active_account_id"] if user_settings.data else None
    if not active_account_id:
        raise HTTPException(status_code=400, detail="No active business account")

    redirect_uri = f"{BACKEND_URL}/api/social/meta-ads/callback"
    scope = "ads_read,ads_management,business_management,public_profile"
    auth_url = (
        f"{FACEBOOK_OAUTH_URL}"
        f"?client_id={FACEBOOK_APP_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&scope={scope}"
        f"&response_type=code"
        f"&state={active_account_id}"
    )
    logger.info(f"🔗 Meta Ads OAuth: Generated authorization URL for account {active_account_id}")
    return {"auth_url": auth_url}


@router.get("/meta-ads/callback")
async def meta_ads_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
):
    """Handle Meta Ads OAuth callback — save token & discover ad accounts."""
    if error:
        logger.error(f"❌ Meta Ads OAuth error: {error} - {error_description}")
        return RedirectResponse(url=f"{FRONTEND_URL}/settings?tab=integrations&error={error_description or error}")

    if not code or not state:
        return RedirectResponse(url=f"{FRONTEND_URL}/settings?tab=integrations&error=Missing authorization code")

    account_id = state
    redirect_uri = f"{BACKEND_URL}/api/social/meta-ads/callback"

    try:
        async with httpx.AsyncClient() as client:
            token_url = f"{FACEBOOK_TOKEN_URL}?client_id={FACEBOOK_APP_ID}&redirect_uri={redirect_uri}&client_secret={FACEBOOK_APP_SECRET}&code={code}"
            resp = await client.get(token_url)
            if resp.status_code != 200:
                logger.error(f"❌ Meta Ads token exchange failed: {resp.text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/settings?tab=integrations&error=Token exchange failed")

            token_data = resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                return RedirectResponse(url=f"{FRONTEND_URL}/settings?tab=integrations&error=No access token")

            # Discover ad accounts
            ad_accounts_resp = await client.get(
                f"{FACEBOOK_GRAPH_URL}/me/adaccounts",
                params={"access_token": access_token, "fields": "id,name,account_status,currency,business_name"}
            )
            ad_accounts = ad_accounts_resp.json().get("data", []) if ad_accounts_resp.status_code == 200 else []
            logger.info(f"✅ Meta Ads: discovered {len(ad_accounts)} ad accounts")

            # Pick first active ad account (account_status == 1 is ACTIVE)
            active_aa = next((a for a in ad_accounts if a.get("account_status") == 1), ad_accounts[0] if ad_accounts else None)

            supabase = get_supabase()
            supabase.table("account_connections").upsert({
                "account_id": account_id,
                "platform": "meta_ads",
                "access_token": access_token,
                "platform_user_id": active_aa["id"] if active_aa else "",
                "platform_username": active_aa.get("name", "") if active_aa else "",
                "is_connected": True,
                "last_connected_at": datetime.utcnow().isoformat(),
                "metadata": {
                    "ad_account_id": active_aa["id"] if active_aa else "",
                    "ad_accounts": ad_accounts[:10],
                    "currency": active_aa.get("currency", "USD") if active_aa else "USD",
                },
            }, on_conflict="account_id,platform").execute()

            logger.info(f"✅ Meta Ads connected for account {account_id}, ad_account={active_aa['id'] if active_aa else 'none'}")
            return RedirectResponse(url=f"{FRONTEND_URL}/settings?tab=integrations&success=meta_ads")

    except Exception as e:
        logger.error(f"❌ Meta Ads OAuth error: {e}", exc_info=True)
        return RedirectResponse(url=f"{FRONTEND_URL}/settings?tab=integrations&error={str(e)[:100]}")


@router.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "instagram_configured": bool(FACEBOOK_APP_ID and FACEBOOK_APP_SECRET),
        "facebook_app_id": FACEBOOK_APP_ID[:10] + "..." if FACEBOOK_APP_ID else None
    }
