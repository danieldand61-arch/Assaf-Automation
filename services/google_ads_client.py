"""
Google Ads API Client - OAuth2 Integration
"""
import os
import logging
from typing import Dict, List, Optional
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

logger = logging.getLogger(__name__)


class GoogleAdsService:
    """
    Google Ads API Service for managing campaigns and ads
    """
    
    def __init__(self, refresh_token: str, customer_id: str):
        """
        Initialize Google Ads client
        
        Args:
            refresh_token: OAuth2 refresh token
            customer_id: Google Ads customer ID (without dashes)
        """
        self.customer_id = customer_id
        
        # Build credentials dict
        credentials = {
            "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
            "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
            "refresh_token": refresh_token,
            "use_proto_plus": True,
        }
        
        self.client = GoogleAdsClient.load_from_dict(credentials)
        logger.info(f"✅ Google Ads client initialized for customer {customer_id}")
    
    
    def get_campaigns(self, date_range: str = "LAST_30_DAYS") -> List[Dict]:
        """
        Get all campaigns with performance metrics
        
        Args:
            date_range: Date range for metrics (TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS, etc.)
        
        Returns:
            List of campaigns with id, name, status, and metrics
        """
        try:
            ga_service = self.client.get_service("GoogleAdsService")
            
            query = f"""
                SELECT 
                    campaign.id,
                    campaign.name,
                    campaign.status,
                    campaign.advertising_channel_type,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.cost_micros,
                    metrics.conversions,
                    metrics.ctr,
                    metrics.average_cpc
                FROM campaign 
                WHERE campaign.status != 'REMOVED'
                  AND segments.date DURING {date_range}
                ORDER BY campaign.name
            """
            
            response = ga_service.search(customer_id=self.customer_id, query=query)
            
            campaigns = []
            for row in response:
                campaigns.append({
                    "id": row.campaign.id,
                    "name": row.campaign.name,
                    "status": row.campaign.status.name,
                    "type": row.campaign.advertising_channel_type.name,
                    "impressions": row.metrics.impressions,
                    "clicks": row.metrics.clicks,
                    "cost": row.metrics.cost_micros / 1_000_000,  # Convert micros to currency
                    "conversions": row.metrics.conversions,
                    "ctr": row.metrics.ctr * 100,  # Convert to percentage
                    "avg_cpc": row.metrics.average_cpc / 1_000_000 if row.metrics.average_cpc else 0
                })
            
            logger.info(f"✅ Retrieved {len(campaigns)} campaigns for {date_range}")
            return campaigns
            
        except GoogleAdsException as ex:
            logger.error(f"❌ Google Ads API error: {ex}")
            raise
    
    
    def get_ad_groups(self, campaign_id: int) -> List[Dict]:
        """
        Get ad groups for a campaign
        
        Args:
            campaign_id: Campaign ID
            
        Returns:
            List of ad groups with id, name, status
        """
        try:
            ga_service = self.client.get_service("GoogleAdsService")
            
            query = f"""
                SELECT 
                    ad_group.id,
                    ad_group.name,
                    ad_group.status,
                    campaign.id,
                    campaign.name
                FROM ad_group 
                WHERE campaign.id = {campaign_id}
                  AND ad_group.status != 'REMOVED'
                ORDER BY ad_group.name
            """
            
            response = ga_service.search(customer_id=self.customer_id, query=query)
            
            ad_groups = []
            for row in response:
                ad_groups.append({
                    "id": row.ad_group.id,
                    "name": row.ad_group.name,
                    "status": row.ad_group.status.name,
                    "campaign_id": row.campaign.id,
                    "campaign_name": row.campaign.name
                })
            
            logger.info(f"✅ Retrieved {len(ad_groups)} ad groups for campaign {campaign_id}")
            return ad_groups
            
        except GoogleAdsException as ex:
            logger.error(f"❌ Google Ads API error: {ex}")
            raise
    
    
    def create_rsa(
        self,
        ad_group_id: int,
        headlines: List[str],
        descriptions: List[str],
        final_url: str,
        path1: Optional[str] = None,
        path2: Optional[str] = None
    ) -> Dict:
        """Alias for create_responsive_search_ad"""
        return self.create_responsive_search_ad(
            ad_group_id, headlines, descriptions, final_url, path1, path2
        )
    
    def create_responsive_search_ad(
        self,
        ad_group_id: int,
        headlines: List[str],
        descriptions: List[str],
        final_url: str,
        path1: Optional[str] = None,
        path2: Optional[str] = None
    ) -> Dict:
        """
        Create a Responsive Search Ad (RSA)
        
        Args:
            ad_group_id: Ad group ID to add the ad to
            headlines: List of 3-15 headlines (max 30 chars each)
            descriptions: List of 2-4 descriptions (max 90 chars each)
            final_url: Landing page URL
            path1: Display path 1 (optional, max 15 chars)
            path2: Display path 2 (optional, max 15 chars)
            
        Returns:
            Dict with ad resource name and status
        """
        try:
            # Validate inputs
            if len(headlines) < 3 or len(headlines) > 15:
                raise ValueError("RSA requires 3-15 headlines")
            if len(descriptions) < 2 or len(descriptions) > 4:
                raise ValueError("RSA requires 2-4 descriptions")
            
            for i, h in enumerate(headlines):
                if len(h) > 30:
                    raise ValueError(f"Headline {i+1} exceeds 30 characters: {len(h)}")
            
            for i, d in enumerate(descriptions):
                if len(d) > 90:
                    raise ValueError(f"Description {i+1} exceeds 90 characters: {len(d)}")
            
            logger.info(f"📝 Creating RSA with {len(headlines)} headlines, {len(descriptions)} descriptions")
            
            # Get services
            ad_group_ad_service = self.client.get_service("AdGroupAdService")
            ad_group_service = self.client.get_service("AdGroupService")
            
            # Create ad group ad operation
            ad_group_ad_operation = self.client.get_type("AdGroupAdOperation")
            ad_group_ad = ad_group_ad_operation.create
            
            # Set ad group
            ad_group_ad.ad_group = ad_group_service.ad_group_path(
                self.customer_id, ad_group_id
            )
            
            # Set ad status
            ad_group_ad.status = self.client.enums.AdGroupAdStatusEnum.PAUSED  # Start paused for safety
            
            # Create responsive search ad
            ad_group_ad.ad.responsive_search_ad.path1 = path1 or ""
            ad_group_ad.ad.responsive_search_ad.path2 = path2 or ""
            
            # Add headlines
            for headline_text in headlines:
                headline = self.client.get_type("AdTextAsset")
                headline.text = headline_text
                ad_group_ad.ad.responsive_search_ad.headlines.append(headline)
            
            # Add descriptions
            for description_text in descriptions:
                description = self.client.get_type("AdTextAsset")
                description.text = description_text
                ad_group_ad.ad.responsive_search_ad.descriptions.append(description)
            
            # Set final URL
            ad_group_ad.ad.final_urls.append(final_url)
            
            # Create the ad
            response = ad_group_ad_service.mutate_ad_group_ads(
                customer_id=self.customer_id,
                operations=[ad_group_ad_operation]
            )
            
            resource_name = response.results[0].resource_name
            
            logger.info(f"✅ RSA created successfully: {resource_name}")
            logger.info(f"   Status: PAUSED (activate manually or via API)")
            
            return {
                "success": True,
                "resource_name": resource_name,
                "status": "PAUSED",
                "message": "RSA created successfully and is PAUSED. Review and activate when ready.",
                "headlines_count": len(headlines),
                "descriptions_count": len(descriptions)
            }
            
        except GoogleAdsException as ex:
            logger.error(f"❌ Failed to create RSA")
            logger.error(f"   Request ID: {ex.request_id}")
            for error in ex.failure.errors:
                logger.error(f"   Error: {error.error_code.error_code_name}")
                logger.error(f"   Message: {error.message}")
            raise
        
        except Exception as ex:
            logger.error(f"❌ Unexpected error creating RSA: {str(ex)}")
            raise
    
    
    def add_sitelink_extensions(
        self,
        campaign_id: int,
        sitelinks: List[Dict]
    ) -> Dict:
        """
        Add sitelink extensions to a campaign
        
        Args:
            campaign_id: Campaign ID
            sitelinks: List of sitelinks with text, description1, description2, final_url
            
        Returns:
            Dict with success status
        """
        try:
            logger.info(f"📎 Adding {len(sitelinks)} sitelink extensions to campaign {campaign_id}")
            
            extension_feed_item_service = self.client.get_service("ExtensionFeedItemService")
            campaign_extension_setting_service = self.client.get_service("CampaignExtensionSettingService")
            
            operations = []
            
            for sitelink_data in sitelinks:
                operation = self.client.get_type("ExtensionFeedItemOperation")
                extension_feed_item = operation.create
                
                extension_feed_item.extension_type = self.client.enums.ExtensionTypeEnum.SITELINK
                
                # Create sitelink
                sitelink = extension_feed_item.sitelink_feed_item
                sitelink.link_text = sitelink_data.get("text", "")[:25]  # Max 25 chars
                sitelink.line1 = sitelink_data.get("description1", "")[:35]  # Max 35 chars
                sitelink.line2 = sitelink_data.get("description2", "")[:35]  # Max 35 chars
                sitelink.final_urls.append(sitelink_data.get("final_url", ""))
                
                operations.append(operation)
            
            response = extension_feed_item_service.mutate_extension_feed_items(
                customer_id=self.customer_id,
                operations=operations
            )
            
            logger.info(f"✅ {len(response.results)} sitelink extensions created")
            
            return {
                "success": True,
                "sitelinks_added": len(response.results),
                "message": "Sitelink extensions added successfully"
            }
            
        except GoogleAdsException as ex:
            logger.error(f"❌ Failed to add sitelink extensions: {ex}")
            raise
