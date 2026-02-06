"""
Function Executor - Executes functions called by Gemini AI
Maps function names to actual API calls
"""
import logging
from typing import Dict, Any, Optional
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)


class FunctionExecutor:
    """Executes functions called by AI"""
    
    def __init__(self, user_id: str, account_id: Optional[str] = None):
        self.user_id = user_id
        self.account_id = account_id
        self.supabase = get_supabase()
    
    async def execute(self, function_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a function by name with given arguments
        Returns dict with result or error
        """
        logger.info(f"🔧 Executing function: {function_name}")
        logger.info(f"   Arguments: {args}")
        
        try:
            # Map function names to methods
            function_map = {
                # Google Ads
                "get_google_ads_campaigns": self._get_google_ads_campaigns,
                "get_google_ads_connection_status": self._get_google_ads_connection_status,
                "create_google_ads_rsa": self._create_google_ads_rsa,
                "generate_google_ads_content": self._generate_google_ads_content,
                
                # Content Generation
                "generate_social_media_posts": self._generate_social_media_posts,
                
                # Scheduling
                "get_scheduled_posts": self._get_scheduled_posts,
                
                # Social Connections
                "get_social_connections_status": self._get_social_connections_status,
                
                # Analysis
                "analyze_campaign_performance": self._analyze_campaign_performance,
            }
            
            if function_name not in function_map:
                return {
                    "success": False,
                    "error": f"Unknown function: {function_name}"
                }
            
            # Execute function
            result = await function_map[function_name](args)
            logger.info(f"✅ Function {function_name} executed successfully")
            
            return {
                "success": True,
                "data": result
            }
            
        except Exception as e:
            logger.error(f"❌ Function execution error: {str(e)}")
            logger.exception("Full traceback:")
            return {
                "success": False,
                "error": str(e)
            }
    
    # ==========================================
    # GOOGLE ADS FUNCTIONS
    # ==========================================
    
    async def _get_google_ads_connection_status(self, args: Dict) -> Dict:
        """Check if Google Ads is connected"""
        try:
            result = self.supabase.table("google_ads_connections")\
                .select("*")\
                .eq("user_id", self.user_id)\
                .execute()
            
            if result.data and len(result.data) > 0:
                conn = result.data[0]
                return {
                    "connected": True,
                    "customer_id": conn["customer_id"],
                    "connected_at": conn.get("created_at")
                }
            else:
                return {
                    "connected": False,
                    "message": "Google Ads not connected. Please go to Settings > Connections to connect your account."
                }
        except Exception as e:
            logger.error(f"Error checking Google Ads status: {e}")
            return {
                "connected": False,
                "error": str(e)
            }
    
    async def _get_google_ads_campaigns(self, args: Dict) -> Dict:
        """Get Google Ads campaigns with metrics"""
        from services.google_ads_client import GoogleAdsService
        
        try:
            # Get connection
            conn = self.supabase.table("google_ads_connections")\
                .select("*")\
                .eq("user_id", self.user_id)\
                .single()\
                .execute()
            
            if not conn.data:
                return {
                    "error": "Google Ads account not connected. Please connect in Settings > Connections."
                }
            
            # Initialize service
            service = GoogleAdsService(
                refresh_token=conn.data["refresh_token"],
                customer_id=conn.data["customer_id"]
            )
            
            # Get campaigns (not async)
            date_range = args.get("date_range", "LAST_30_DAYS")
            campaigns = service.get_campaigns(date_range=date_range)
            
            return {
                "campaigns": campaigns,
                "date_range": date_range,
                "total_campaigns": len(campaigns)
            }
        except Exception as e:
            logger.error(f"Error getting campaigns: {e}")
            return {
                "error": f"Failed to get campaigns: {str(e)}"
            }
    
    async def _create_google_ads_rsa(self, args: Dict) -> Dict:
        """Create Responsive Search Ad"""
        from services.google_ads_client import GoogleAdsService
        
        try:
            # Get connection
            conn = self.supabase.table("google_ads_connections")\
                .select("*")\
                .eq("user_id", self.user_id)\
                .single()\
                .execute()
            
            if not conn.data:
                return {
                    "error": "Google Ads account not connected. Please connect in Settings > Connections."
                }
            
            # Initialize service
            service = GoogleAdsService(
                refresh_token=conn.data["refresh_token"],
                customer_id=conn.data["customer_id"]
            )
            
            # Create RSA (not async)
            result = service.create_rsa(
                ad_group_id=args["ad_group_id"],
                headlines=args["headlines"],
                descriptions=args["descriptions"],
                final_url=args["final_url"]
            )
            
            return result
        except Exception as e:
            logger.error(f"Error creating RSA: {e}")
            return {
                "error": f"Failed to create RSA: {str(e)}"
            }
    
    async def _generate_google_ads_content(self, args: Dict) -> Dict:
        """Generate Google Ads RSA content using AI"""
        from services.scraper import scrape_website
        from services.google_ads_generator import generate_google_ads
        from database.supabase_client import get_supabase
        
        try:
            # Get website URL from args or from account metadata
            website_url = args.get("website_url")
            
            # If no URL provided, try to get from account profile
            if not website_url and self.account_id:
                try:
                    supabase = get_supabase()
                    account = supabase.table("accounts")\
                        .select("metadata")\
                        .eq("id", self.account_id)\
                        .single()\
                        .execute()
                    
                    if account.data:
                        metadata = account.data.get('metadata', {})
                        website_url = metadata.get('website_url')
                        if website_url:
                            logger.info(f"🔗 Using website URL from account profile: {website_url}")
                except Exception as e:
                    logger.warning(f"Could not load account website URL: {e}")
            
            # Scrape website if URL available
            website_data = None
            if website_url:
                try:
                    website_data = await scrape_website(website_url)
                except Exception as e:
                    logger.warning(f"Failed to scrape website: {e}")
                    website_data = {"error": str(e)}
            
            # Generate ads
            ads_package = await generate_google_ads(
                website_data=website_data,
                keywords=args.get("keywords", ""),
                target_location=args.get("target_location", ""),
                language=args.get("language", "en"),
                user_id=self.user_id,
                account_id=self.account_id
            )
            
            return {
                "success": True,
                "headlines": ads_package["headlines"],
                "descriptions": ads_package["descriptions"],
                "callouts": ads_package.get("callouts", []),
                "sitelinks": ads_package.get("sitelinks", []),
                "website_data": {
                    "title": website_data.get("title") if website_data else None,
                    "description": website_data.get("description") if website_data else None
                }
            }
        except Exception as e:
            logger.error(f"Error generating Google Ads content: {e}")
            logger.exception("Full error:")
            return {
                "success": False,
                "error": f"Failed to generate ads: {str(e)}"
            }
    
    # ==========================================
    # CONTENT GENERATION FUNCTIONS
    # ==========================================
    
    async def _generate_social_media_posts(self, args: Dict) -> Dict:
        """Generate social media posts"""
        from services.scraper import scrape_website
        from services.content_generator import generate_posts
        from services.image_generator import generate_images
        
        # Scrape website
        website_data = await scrape_website(args["website_url"])
        
        # Generate posts
        variations = await generate_posts(
            website_data=website_data,
            keywords=args["keywords"],
            platforms=args["platforms"],
            style=args.get("style", "professional"),
            target_audience=args.get("target_audience", "general audience"),
            language=args.get("language", "en"),
            include_emojis=args.get("include_emojis", True),
            user_id=self.user_id,
            account_id=self.account_id
        )
        
        # Generate images
        images = await generate_images(
            website_data=website_data,
            variations=variations,
            platforms=args["platforms"],
            image_size="1080x1080",
            include_logo=False
        )
        
        return {
            "variations": [v.dict() for v in variations],
            "images": [i.dict() for i in images],
            "platforms": args["platforms"],
            "total_variations": len(variations)
        }
    
    # ==========================================
    # SCHEDULING FUNCTIONS
    # ==========================================
    
    async def _get_scheduled_posts(self, args: Dict) -> Dict:
        """Get scheduled posts"""
        query = self.supabase.table("scheduled_posts")\
            .select("*")\
            .eq("user_id", self.user_id)\
            .order("scheduled_time", desc=False)
        
        # Filter by status
        status = args.get("status", "all")
        if status != "all":
            query = query.eq("status", status)
        
        # Filter by platform
        platform = args.get("platform", "all")
        if platform != "all":
            query = query.contains("platforms", [platform])
        
        result = query.execute()
        
        return {
            "posts": result.data or [],
            "total": len(result.data or []),
            "filters": {
                "status": status,
                "platform": platform
            }
        }
    
    # ==========================================
    # SOCIAL CONNECTIONS FUNCTIONS
    # ==========================================
    
    async def _get_social_connections_status(self, args: Dict) -> Dict:
        """Get social media connections status"""
        
        if not self.account_id:
            # Get active account
            user_settings = self.supabase.table("user_settings")\
                .select("active_account_id")\
                .eq("user_id", self.user_id)\
                .single()\
                .execute()
            
            if user_settings.data:
                self.account_id = user_settings.data.get("active_account_id")
        
        if not self.account_id:
            return {
                "error": "No active account selected"
            }
        
        # Get all connections
        result = self.supabase.table("account_connections")\
            .select("*")\
            .eq("account_id", self.account_id)\
            .execute()
        
        connections = {}
        for conn in (result.data or []):
            connections[conn["platform"]] = {
                "connected": conn["is_connected"],
                "username": conn.get("platform_username"),
                "connected_at": conn.get("last_connected_at")
            }
        
        return {
            "connections": connections,
            "total_connected": sum(1 for c in connections.values() if c["connected"])
        }
    
    # ==========================================
    # ANALYSIS FUNCTIONS
    # ==========================================
    
    async def _analyze_campaign_performance(self, args: Dict) -> Dict:
        """Analyze Google Ads campaign performance"""
        from services.google_ads_client import GoogleAdsService
        
        try:
            # Get connection
            conn = self.supabase.table("google_ads_connections")\
                .select("*")\
                .eq("user_id", self.user_id)\
                .single()\
                .execute()
            
            if not conn.data:
                return {
                    "error": "Google Ads account not connected. Please connect in Settings > Connections."
                }
            
            # Get campaigns (not async)
            service = GoogleAdsService(
                refresh_token=conn.data["refresh_token"],
                customer_id=conn.data["customer_id"]
            )
            
            date_range = args.get("date_range", "LAST_30_DAYS")
            campaigns = service.get_campaigns(date_range=date_range)
            
            # Basic analysis
            total_spend = sum(c.get("cost", 0) for c in campaigns)
            total_clicks = sum(c.get("clicks", 0) for c in campaigns)
            total_impressions = sum(c.get("impressions", 0) for c in campaigns)
            
            avg_ctr = (total_clicks / total_impressions * 100) if total_impressions > 0 else 0
            avg_cpc = (total_spend / total_clicks) if total_clicks > 0 else 0
            
            # Find best/worst performers
            campaigns_sorted = sorted(campaigns, key=lambda x: x.get("clicks", 0), reverse=True)
            
            return {
                "summary": {
                    "total_campaigns": len(campaigns),
                    "total_spend": round(total_spend, 2),
                    "total_clicks": total_clicks,
                    "total_impressions": total_impressions,
                    "avg_ctr": round(avg_ctr, 2),
                    "avg_cpc": round(avg_cpc, 2)
                },
                "top_campaigns": campaigns_sorted[:3],
                "date_range": date_range,
                "recommendations": self._generate_recommendations(campaigns)
            }
        except Exception as e:
            logger.error(f"Error analyzing campaigns: {e}")
            return {
                "error": f"Failed to analyze campaigns: {str(e)}"
            }
    
    def _generate_recommendations(self, campaigns: list) -> list:
        """Generate optimization recommendations"""
        recommendations = []
        
        for campaign in campaigns:
            ctr = campaign.get("ctr", 0)
            status = campaign.get("status", "")
            
            # Low CTR warning
            if ctr < 1.0 and status == "ENABLED":
                recommendations.append({
                    "campaign": campaign.get("name"),
                    "type": "low_ctr",
                    "message": f"Campaign '{campaign.get('name')}' has low CTR ({ctr:.2f}%). Consider improving ad copy or targeting."
                })
            
            # Paused campaigns with good performance
            if status == "PAUSED" and ctr > 2.0:
                recommendations.append({
                    "campaign": campaign.get("name"),
                    "type": "reactivate",
                    "message": f"Campaign '{campaign.get('name')}' is paused but had good CTR ({ctr:.2f}%). Consider reactivating."
                })
        
        return recommendations[:5]  # Top 5 recommendations
