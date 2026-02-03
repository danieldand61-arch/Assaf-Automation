"""
Google Ads API Router - Campaign and Ad Management
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import logging
from middleware.auth import get_current_user
from database.supabase_client import get_supabase
from services.google_ads_client import GoogleAdsService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/google-ads", tags=["google-ads"])


class GoogleAdsConnectionRequest(BaseModel):
    refresh_token: str
    customer_id: str  # Without dashes, e.g. "1234567890"


class CreateRSARequest(BaseModel):
    ad_group_id: int
    headlines: List[str]  # 3-15 headlines
    descriptions: List[str]  # 2-4 descriptions
    final_url: str
    path1: Optional[str] = None
    path2: Optional[str] = None


class AddSitelinksRequest(BaseModel):
    campaign_id: int
    sitelinks: List[dict]  # [{"text": "", "description1": "", "description2": "", "final_url": ""}]


@router.post("/connect")
async def connect_google_ads(
    request: GoogleAdsConnectionRequest,
    user = Depends(get_current_user)
):
    """
    Connect user's Google Ads account
    Store refresh token securely
    """
    try:
        logger.info(f"🔗 Connecting Google Ads account for user {user['id']}")
        
        # Test connection by fetching campaigns
        ads_service = GoogleAdsService(
            refresh_token=request.refresh_token,
            customer_id=request.customer_id
        )
        
        campaigns = ads_service.get_campaigns()
        
        # Store connection in database
        supabase = get_supabase()
        
        # Check if connection exists
        existing = supabase.table('google_ads_connections').select('*').eq('user_id', user['id']).execute()
        
        connection_data = {
            'user_id': user['id'],
            'customer_id': request.customer_id,
            'refresh_token': request.refresh_token,  # TODO: Encrypt this
            'status': 'active'
        }
        
        if existing.data:
            # Update existing
            result = supabase.table('google_ads_connections').update(connection_data).eq('user_id', user['id']).execute()
        else:
            # Insert new
            result = supabase.table('google_ads_connections').insert(connection_data).execute()
        
        logger.info(f"✅ Google Ads connected: {len(campaigns)} campaigns found")
        
        return {
            "success": True,
            "customer_id": request.customer_id,
            "campaigns_count": len(campaigns),
            "message": "Google Ads account connected successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to connect Google Ads: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to connect Google Ads: {str(e)}")


@router.get("/campaigns")
async def get_campaigns(user = Depends(get_current_user)):
    """
    Get all campaigns for connected Google Ads account
    """
    try:
        logger.info(f"📊 Fetching campaigns for user {user['id']}")
        
        # Get connection from database
        supabase = get_supabase()
        connection = supabase.table('google_ads_connections').select('*').eq('user_id', user['id']).eq('status', 'active').execute()
        
        if not connection.data:
            raise HTTPException(status_code=404, detail="Google Ads account not connected")
        
        conn_data = connection.data[0]
        
        # Get campaigns
        ads_service = GoogleAdsService(
            refresh_token=conn_data['refresh_token'],
            customer_id=conn_data['customer_id']
        )
        
        campaigns = ads_service.get_campaigns()
        
        logger.info(f"✅ Retrieved {len(campaigns)} campaigns")
        
        return {
            "success": True,
            "campaigns": campaigns
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get campaigns: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get campaigns: {str(e)}")


@router.get("/campaigns/{campaign_id}/ad-groups")
async def get_ad_groups(
    campaign_id: int,
    user = Depends(get_current_user)
):
    """
    Get ad groups for a specific campaign
    """
    try:
        logger.info(f"📊 Fetching ad groups for campaign {campaign_id}")
        
        # Get connection
        supabase = get_supabase()
        connection = supabase.table('google_ads_connections').select('*').eq('user_id', user['id']).eq('status', 'active').execute()
        
        if not connection.data:
            raise HTTPException(status_code=404, detail="Google Ads account not connected")
        
        conn_data = connection.data[0]
        
        # Get ad groups
        ads_service = GoogleAdsService(
            refresh_token=conn_data['refresh_token'],
            customer_id=conn_data['customer_id']
        )
        
        ad_groups = ads_service.get_ad_groups(campaign_id)
        
        logger.info(f"✅ Retrieved {len(ad_groups)} ad groups")
        
        return {
            "success": True,
            "ad_groups": ad_groups
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get ad groups: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get ad groups: {str(e)}")


@router.post("/create-rsa")
async def create_responsive_search_ad(
    request: CreateRSARequest,
    user = Depends(get_current_user)
):
    """
    Create a Responsive Search Ad (RSA) in Google Ads
    """
    try:
        logger.info(f"📝 Creating RSA for user {user['id']}")
        logger.info(f"   Ad Group ID: {request.ad_group_id}")
        logger.info(f"   Headlines: {len(request.headlines)}")
        logger.info(f"   Descriptions: {len(request.descriptions)}")
        
        # Get connection
        supabase = get_supabase()
        connection = supabase.table('google_ads_connections').select('*').eq('user_id', user['id']).eq('status', 'active').execute()
        
        if not connection.data:
            raise HTTPException(status_code=404, detail="Google Ads account not connected. Please connect first.")
        
        conn_data = connection.data[0]
        
        # Create RSA
        ads_service = GoogleAdsService(
            refresh_token=conn_data['refresh_token'],
            customer_id=conn_data['customer_id']
        )
        
        result = ads_service.create_responsive_search_ad(
            ad_group_id=request.ad_group_id,
            headlines=request.headlines,
            descriptions=request.descriptions,
            final_url=request.final_url,
            path1=request.path1,
            path2=request.path2
        )
        
        logger.info(f"✅ RSA created successfully")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create RSA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create RSA: {str(e)}")


@router.post("/add-sitelinks")
async def add_sitelink_extensions(
    request: AddSitelinksRequest,
    user = Depends(get_current_user)
):
    """
    Add sitelink extensions to a campaign
    """
    try:
        logger.info(f"📎 Adding sitelinks to campaign {request.campaign_id}")
        
        # Get connection
        supabase = get_supabase()
        connection = supabase.table('google_ads_connections').select('*').eq('user_id', user['id']).eq('status', 'active').execute()
        
        if not connection.data:
            raise HTTPException(status_code=404, detail="Google Ads account not connected")
        
        conn_data = connection.data[0]
        
        # Add sitelinks
        ads_service = GoogleAdsService(
            refresh_token=conn_data['refresh_token'],
            customer_id=conn_data['customer_id']
        )
        
        result = ads_service.add_sitelink_extensions(
            campaign_id=request.campaign_id,
            sitelinks=request.sitelinks
        )
        
        logger.info(f"✅ Sitelinks added successfully")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to add sitelinks: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add sitelinks: {str(e)}")


@router.get("/status")
async def get_connection_status(user = Depends(get_current_user)):
    """
    Check if Google Ads account is connected
    """
    try:
        supabase = get_supabase()
        connection = supabase.table('google_ads_connections').select('*').eq('user_id', user['id']).eq('status', 'active').execute()
        
        if connection.data:
            return {
                "connected": True,
                "customer_id": connection.data[0]['customer_id']
            }
        else:
            return {
                "connected": False
            }
            
    except Exception as e:
        logger.error(f"❌ Error checking connection status: {str(e)}")
        return {
            "connected": False,
            "error": str(e)
        }


@router.delete("/disconnect")
async def disconnect_google_ads(user = Depends(get_current_user)):
    """
    Disconnect Google Ads account
    """
    try:
        logger.info(f"🔌 Disconnecting Google Ads for user {user['id']}")
        
        supabase = get_supabase()
        result = supabase.table('google_ads_connections').update({'status': 'inactive'}).eq('user_id', user['id']).execute()
        
        logger.info(f"✅ Google Ads disconnected")
        
        return {
            "success": True,
            "message": "Google Ads account disconnected"
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to disconnect: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}")
