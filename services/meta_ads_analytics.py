"""
Meta Business (Facebook/Instagram) Ads Analytics
Fetches campaign, ad set, ad, and performance data via Marketing API
"""
import os
import httpx
import logging
from typing import Dict, List, Optional
from datetime import date

logger = logging.getLogger(__name__)

META_GRAPH_URL = "https://graph.facebook.com/v21.0"


class MetaAdsAnalytics:
    def __init__(self, access_token: str, ad_account_id: str):
        """
        Args:
            access_token: User or system-user access token with ads_read permission
            ad_account_id: Meta Ad Account ID (format: act_XXXXX)
        """
        self.token = access_token
        self.ad_account_id = ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"

    def _params(self, extra: dict = None) -> dict:
        p = {"access_token": self.token}
        if extra:
            p.update(extra)
        return p

    async def _get(self, path: str, params: dict = None) -> dict:
        url = f"{META_GRAPH_URL}/{path}"
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.get(url, params=self._params(params))
            if resp.status_code != 200:
                body = resp.text[:500]
                logger.error(f"Meta API error {resp.status_code}: {body}")
                err_msg = "Unknown error"
                try:
                    err_data = resp.json()
                    err_msg = err_data.get("error", {}).get("message", body)
                except Exception:
                    err_msg = body
                raise Exception(f"Meta API {resp.status_code}: {err_msg}")
            return resp.json()

    async def _get_all(self, path: str, params: dict = None) -> List[dict]:
        """Handle pagination."""
        results = []
        data = await self._get(path, params)
        results.extend(data.get("data", []))
        while data.get("paging", {}).get("next"):
            async with httpx.AsyncClient(timeout=30) as c:
                resp = await c.get(data["paging"]["next"])
                if resp.status_code != 200:
                    break
                data = resp.json()
                results.extend(data.get("data", []))
        return results

    def _time_range(self, date_from: date, date_to: date) -> str:
        return f"{{'since':'{date_from}','until':'{date_to}'}}"

    # ── Campaigns ──────────────────────────────────────────────
    async def get_campaigns(self, date_from: date, date_to: date) -> List[Dict]:
        logger.info(f"📡 Meta API: fetching campaigns for {self.ad_account_id}, date range {date_from} to {date_to}")
        params = {
            "fields": "id,name,status,objective,daily_budget,lifetime_budget,"
                      "insights.time_range(" + self._time_range(date_from, date_to) + ")"
                      "{impressions,clicks,ctr,spend,cpc,reach,frequency,"
                      "conversions,cost_per_action_type,actions,purchase_roas}",
            "limit": "500",
        }
        raw = await self._get_all(f"{self.ad_account_id}/campaigns", params)
        logger.info(f"📡 Meta API raw response: {len(raw)} campaigns found. IDs: {[c.get('id','?') for c in raw[:5]]}")
        campaigns = []
        for c in raw:
            ins = (c.get("insights", {}).get("data") or [{}])[0] if "insights" in c else {}
            conversions = 0
            for act in (ins.get("actions") or []):
                if act.get("action_type") in ("offsite_conversion.fb_pixel_purchase", "lead", "complete_registration", "purchase"):
                    conversions += float(act.get("value", 0))
            roas_list = ins.get("purchase_roas") or []
            roas = float(roas_list[0].get("value", 0)) if roas_list else 0
            cpa = 0
            for cpa_item in (ins.get("cost_per_action_type") or []):
                if cpa_item.get("action_type") in ("offsite_conversion.fb_pixel_purchase", "lead"):
                    cpa = float(cpa_item.get("value", 0))
                    break

            campaigns.append({
                "platform_campaign_id": c["id"],
                "campaign_name": c.get("name", ""),
                "status": c.get("status", "UNKNOWN"),
                "objective": c.get("objective", ""),
                "daily_budget": float(c.get("daily_budget", 0)) / 100 if c.get("daily_budget") else 0,
                "lifetime_budget": float(c.get("lifetime_budget", 0)) / 100 if c.get("lifetime_budget") else 0,
                "impressions": int(ins.get("impressions", 0)),
                "clicks": int(ins.get("clicks", 0)),
                "ctr": float(ins.get("ctr", 0)),
                "spend": float(ins.get("spend", 0)),
                "avg_cpc": float(ins.get("cpc", 0)),
                "reach": int(ins.get("reach", 0)),
                "frequency": float(ins.get("frequency", 0)),
                "conversions": conversions,
                "roas": roas,
                "cost_per_conversion": cpa,
            })
        # If no campaigns with insights, try without date filter to see if any exist
        if not campaigns:
            try:
                check_params = {"fields": "id,name,status", "limit": "10"}
                all_camps = await self._get_all(f"{self.ad_account_id}/campaigns", check_params)
                logger.info(f"ℹ️ Meta: {len(all_camps)} total campaigns exist (without date filter): {[(c.get('name','?'), c.get('status','?')) for c in all_camps[:5]]}")
            except Exception as e:
                logger.warning(f"⚠️ Could not check all campaigns: {e}")

        logger.info(f"✅ Meta: fetched {len(campaigns)} campaigns with data in date range")
        return campaigns

    # ── Ad Sets ────────────────────────────────────────────────
    async def get_ad_sets(self, date_from: date, date_to: date) -> List[Dict]:
        params = {
            "fields": "id,name,status,campaign_id,targeting,"
                      "insights.time_range(" + self._time_range(date_from, date_to) + ")"
                      "{impressions,clicks,ctr,spend,conversions}",
            "limit": "500",
        }
        raw = await self._get_all(f"{self.ad_account_id}/adsets", params)
        ad_sets = []
        for a in raw:
            ins = (a.get("insights", {}).get("data") or [{}])[0] if "insights" in a else {}
            targeting = a.get("targeting", {})
            ad_sets.append({
                "platform_adgroup_id": a["id"],
                "adgroup_name": a.get("name", ""),
                "status": a.get("status", "UNKNOWN"),
                "platform_campaign_id": a.get("campaign_id", ""),
                "targeting_locations": str(targeting.get("geo_locations", "")),
                "targeting_age_range": f"{targeting.get('age_min', '')}-{targeting.get('age_max', '')}",
                "targeting_gender": str(targeting.get("genders", "")),
                "targeting_interests": str([i.get("name", "") for i in (targeting.get("flexible_spec") or [{}])[0].get("interests", [])]) if targeting.get("flexible_spec") else "",
                "impressions": int(ins.get("impressions", 0)),
                "clicks": int(ins.get("clicks", 0)),
                "ctr": float(ins.get("ctr", 0)),
                "spend": float(ins.get("spend", 0)),
                "conversions": sum(float(x.get("value", 0)) for x in (ins.get("conversions") or [])) if ins.get("conversions") else 0,
            })
        logger.info(f"✅ Meta: fetched {len(ad_sets)} ad sets")
        return ad_sets

    # ── Placement Breakdown ────────────────────────────────────
    async def get_placement_stats(self, date_from: date, date_to: date) -> List[Dict]:
        params = {
            "fields": "campaign_id,impressions,clicks,spend,reach,conversions",
            "breakdowns": "publisher_platform,platform_position",
            "time_range": f"{{'since':'{date_from}','until':'{date_to}'}}",
            "level": "campaign",
            "limit": "500",
        }
        raw = await self._get_all(f"{self.ad_account_id}/insights", params)
        return [{
            "platform_campaign_id": r.get("campaign_id", ""),
            "placement": f"{r.get('publisher_platform', '')} — {r.get('platform_position', '')}",
            "impressions": int(r.get("impressions", 0)),
            "clicks": int(r.get("clicks", 0)),
            "spend": float(r.get("spend", 0)),
            "reach": int(r.get("reach", 0)),
            "conversions": sum(float(x.get("value", 0)) for x in (r.get("conversions") or [])) if r.get("conversions") else 0,
        } for r in raw]
