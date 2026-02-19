"""
Google Ads Analytics — fetches campaign, keyword, device, geo data
Extends existing GoogleAdsService with detailed metrics
"""
import os
import logging
from typing import Dict, List, Optional
from datetime import date, timedelta

logger = logging.getLogger(__name__)

# Try importing Google Ads client; gracefully handle missing dependency
try:
    from google.ads.googleads.client import GoogleAdsClient
    from google.ads.googleads.errors import GoogleAdsException
    HAS_GOOGLE_ADS = True
except ImportError:
    HAS_GOOGLE_ADS = False
    logger.warning("google-ads package not installed — Google Ads analytics disabled")


class GoogleAdsAnalytics:
    def __init__(self, refresh_token: str, customer_id: str):
        if not HAS_GOOGLE_ADS:
            raise RuntimeError("google-ads package not installed")
        creds = {
            "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
            "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
            "refresh_token": refresh_token,
            "use_proto_plus": True,
        }
        self.client = GoogleAdsClient.load_from_dict(creds)
        self.customer_id = customer_id
        self._svc = self.client.get_service("GoogleAdsService")

    def _query(self, query: str) -> list:
        try:
            return list(self._svc.search(customer_id=self.customer_id, query=query))
        except GoogleAdsException as e:
            logger.error(f"Google Ads query error: {e}")
            raise

    def _date_clause(self, date_from: date, date_to: date) -> str:
        return f"segments.date BETWEEN '{date_from}' AND '{date_to}'"

    # ── Campaigns ──────────────────────────────────────────────
    def get_campaigns_full(self, date_from: date, date_to: date) -> List[Dict]:
        q = f"""
            SELECT
                campaign.id, campaign.name, campaign.status,
                campaign.advertising_channel_type,
                campaign_budget.amount_micros,
                metrics.impressions, metrics.clicks, metrics.ctr,
                metrics.cost_micros, metrics.average_cpc,
                metrics.conversions, metrics.conversions_from_interactions_rate,
                metrics.cost_per_conversion,
                metrics.search_impression_share,
                metrics.search_budget_lost_impression_share,
                metrics.search_rank_lost_impression_share
            FROM campaign
            WHERE campaign.status != 'REMOVED'
              AND {self._date_clause(date_from, date_to)}
        """
        rows = self._query(q)
        return [{
            "platform_campaign_id": str(r.campaign.id),
            "campaign_name": r.campaign.name,
            "status": r.campaign.status.name,
            "campaign_type": r.campaign.advertising_channel_type.name,
            "daily_budget": (r.campaign_budget.amount_micros / 1e6) if r.campaign_budget.amount_micros else 0,
            "impressions": r.metrics.impressions,
            "clicks": r.metrics.clicks,
            "ctr": round(r.metrics.ctr * 100, 2),
            "spend": round(r.metrics.cost_micros / 1e6, 4),
            "avg_cpc": round(r.metrics.average_cpc / 1e6, 4) if r.metrics.average_cpc else 0,
            "conversions": round(r.metrics.conversions, 2),
            "conversion_rate": round(r.metrics.conversions_from_interactions_rate * 100, 2),
            "cost_per_conversion": round(r.metrics.cost_per_conversion / 1e6, 4) if r.metrics.cost_per_conversion else 0,
            "search_impression_share": round((r.metrics.search_impression_share or 0) * 100, 2),
            "lost_impression_share_budget": round((r.metrics.search_budget_lost_impression_share or 0) * 100, 2),
            "lost_impression_share_rank": round((r.metrics.search_rank_lost_impression_share or 0) * 100, 2),
        } for r in rows]

    # ── Ad Groups ──────────────────────────────────────────────
    def get_ad_groups_full(self, date_from: date, date_to: date) -> List[Dict]:
        q = f"""
            SELECT
                ad_group.id, ad_group.name, ad_group.status,
                campaign.id,
                metrics.impressions, metrics.clicks, metrics.ctr,
                metrics.cost_micros, metrics.conversions
            FROM ad_group
            WHERE ad_group.status != 'REMOVED'
              AND {self._date_clause(date_from, date_to)}
        """
        return [{
            "platform_adgroup_id": str(r.ad_group.id),
            "adgroup_name": r.ad_group.name,
            "status": r.ad_group.status.name,
            "platform_campaign_id": str(r.campaign.id),
            "impressions": r.metrics.impressions,
            "clicks": r.metrics.clicks,
            "ctr": round(r.metrics.ctr * 100, 2),
            "spend": round(r.metrics.cost_micros / 1e6, 4),
            "conversions": round(r.metrics.conversions, 2),
        } for r in self._query(q)]

    # ── Keywords ───────────────────────────────────────────────
    def get_keywords(self, date_from: date, date_to: date) -> List[Dict]:
        q = f"""
            SELECT
                ad_group_criterion.keyword.text,
                ad_group_criterion.keyword.match_type,
                ad_group_criterion.quality_info.quality_score,
                campaign.id, ad_group.id,
                metrics.impressions, metrics.clicks, metrics.ctr,
                metrics.average_cpc, metrics.conversions
            FROM keyword_view
            WHERE {self._date_clause(date_from, date_to)}
        """
        return [{
            "keyword_text": r.ad_group_criterion.keyword.text,
            "match_type": r.ad_group_criterion.keyword.match_type.name,
            "quality_score": r.ad_group_criterion.quality_info.quality_score or 0,
            "platform_campaign_id": str(r.campaign.id),
            "platform_adgroup_id": str(r.ad_group.id),
            "impressions": r.metrics.impressions,
            "clicks": r.metrics.clicks,
            "ctr": round(r.metrics.ctr * 100, 2),
            "avg_cpc": round(r.metrics.average_cpc / 1e6, 4) if r.metrics.average_cpc else 0,
            "conversions": round(r.metrics.conversions, 2),
        } for r in self._query(q)]

    # ── Device Segmentation ────────────────────────────────────
    def get_device_stats(self, date_from: date, date_to: date) -> List[Dict]:
        q = f"""
            SELECT
                campaign.id, segments.device,
                metrics.impressions, metrics.clicks,
                metrics.cost_micros, metrics.conversions
            FROM campaign
            WHERE campaign.status != 'REMOVED'
              AND {self._date_clause(date_from, date_to)}
        """
        return [{
            "platform_campaign_id": str(r.campaign.id),
            "device": r.segments.device.name,
            "impressions": r.metrics.impressions,
            "clicks": r.metrics.clicks,
            "spend": round(r.metrics.cost_micros / 1e6, 4),
            "conversions": round(r.metrics.conversions, 2),
        } for r in self._query(q)]

    # ── Geographic Performance ─────────────────────────────────
    def get_geo_stats(self, date_from: date, date_to: date) -> List[Dict]:
        q = f"""
            SELECT
                campaign.id,
                geographic_view.country_criterion_id,
                geographic_view.location_type,
                metrics.impressions, metrics.clicks,
                metrics.cost_micros, metrics.conversions
            FROM geographic_view
            WHERE {self._date_clause(date_from, date_to)}
        """
        return [{
            "platform_campaign_id": str(r.campaign.id),
            "country": str(r.geographic_view.country_criterion_id),
            "impressions": r.metrics.impressions,
            "clicks": r.metrics.clicks,
            "spend": round(r.metrics.cost_micros / 1e6, 4),
            "conversions": round(r.metrics.conversions, 2),
        } for r in self._query(q)]
