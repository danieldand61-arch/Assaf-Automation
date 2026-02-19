"""
Ad Analytics Sync — fetches data from Google Ads & Meta, normalizes, caches to Supabase
"""
import logging
from datetime import date, timedelta, datetime, timezone
from typing import Optional

from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

STALE_MINUTES = 30  # re-sync if older than this


def _is_stale(account_id: str, platform: str) -> bool:
    """Check if cached data is older than STALE_MINUTES."""
    try:
        sb = get_supabase()
        rows = sb.table("ad_sync_log").select("completed_at").eq("account_id", account_id).eq("platform", platform).limit(1).execute()
        if not rows.data:
            return True
        completed = rows.data[0].get("completed_at")
        if not completed:
            return True
        last = datetime.fromisoformat(completed.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - last).total_seconds() > STALE_MINUTES * 60
    except Exception:
        return True


async def sync_google_ads(account_id: str, user_id: str, date_from: date, date_to: date) -> dict:
    """Sync Google Ads data for an account. Returns summary."""
    sb = get_supabase()

    # Get Google Ads connection
    try:
        rows = sb.table("google_ads_connections").select("*").eq("user_id", user_id).eq("status", "active").limit(1).execute()
        conn_data = rows.data[0] if rows.data else None
    except Exception:
        conn_data = None
    if not conn_data:
        return {"status": "no_connection", "message": "No Google Ads account connected"}

    if not _is_stale(account_id, "google_ads"):
        return {"status": "cached", "message": "Data is fresh"}

    # Update sync log
    sb.table("ad_sync_log").upsert({
        "account_id": account_id, "platform": "google_ads",
        "status": "syncing", "started_at": datetime.now(timezone.utc).isoformat(),
        "error_message": None,
    }, on_conflict="account_id,platform").execute()

    try:
        from services.google_ads_analytics import GoogleAdsAnalytics
        ga = GoogleAdsAnalytics(conn_data["refresh_token"], conn_data["customer_id"])

        # Fetch all data
        campaigns = ga.get_campaigns_full(date_from, date_to)
        ad_groups = ga.get_ad_groups_full(date_from, date_to)
        keywords = ga.get_keywords(date_from, date_to)
        device_stats = ga.get_device_stats(date_from, date_to)
        geo_stats = ga.get_geo_stats(date_from, date_to)

        # Clear old data for this range
        sb.table("ad_campaigns").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()
        sb.table("ad_groups").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()
        sb.table("ad_keywords").delete().eq("account_id", account_id).execute()
        sb.table("ad_device_stats").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()
        sb.table("ad_geo_stats").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()

        # Insert campaigns
        for c in campaigns:
            sb.table("ad_campaigns").insert({
                **c, "account_id": account_id, "platform": "google_ads",
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        # Insert ad groups
        for ag in ad_groups:
            sb.table("ad_groups").insert({
                **ag, "account_id": account_id, "platform": "google_ads",
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        # Insert keywords
        for kw in keywords:
            sb.table("ad_keywords").insert({
                **kw, "account_id": account_id,
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        # Insert device stats
        for ds in device_stats:
            sb.table("ad_device_stats").insert({
                **ds, "account_id": account_id, "platform": "google_ads",
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        # Insert geo stats
        for gs in geo_stats:
            sb.table("ad_geo_stats").insert({
                **gs, "account_id": account_id, "platform": "google_ads",
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        sb.table("ad_sync_log").upsert({
            "account_id": account_id, "platform": "google_ads",
            "status": "completed", "campaigns_synced": len(campaigns),
            "completed_at": datetime.now(timezone.utc).isoformat(), "error_message": None,
        }, on_conflict="account_id,platform").execute()

        logger.info(f"✅ Google Ads sync: {len(campaigns)} campaigns, {len(keywords)} keywords")
        return {"status": "synced", "campaigns": len(campaigns), "ad_groups": len(ad_groups), "keywords": len(keywords)}

    except Exception as e:
        logger.error(f"❌ Google Ads sync error: {e}", exc_info=True)
        sb.table("ad_sync_log").upsert({
            "account_id": account_id, "platform": "google_ads",
            "status": "error", "error_message": str(e)[:500],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="account_id,platform").execute()
        return {"status": "error", "message": str(e)}


async def sync_meta_ads(account_id: str, user_id: str, date_from: date, date_to: date) -> dict:
    """Sync Meta Ads data for an account."""
    sb = get_supabase()

    # Get Meta Ads connection (saved as platform='meta_ads')
    try:
        rows = sb.table("account_connections").select("*").eq("account_id", account_id).eq("platform", "meta_ads").eq("is_connected", True).limit(1).execute()
        conn_data = rows.data[0] if rows.data else None
    except Exception:
        conn_data = None
    if not conn_data:
        return {"status": "no_connection", "message": "No Meta Ads account connected"}

    # Meta needs an ad_account_id — stored in connection metadata or platform_user_id
    ad_account_id = conn_data.get("metadata", {}).get("ad_account_id") if conn_data.get("metadata") else None
    if not ad_account_id:
        return {"status": "no_ad_account", "message": "No Meta Ad Account ID configured. Connect your ad account in Integrations."}

    if not _is_stale(account_id, "meta"):
        return {"status": "cached", "message": "Data is fresh"}

    sb.table("ad_sync_log").upsert({
        "account_id": account_id, "platform": "meta",
        "status": "syncing", "started_at": datetime.now(timezone.utc).isoformat(),
        "error_message": None,
    }, on_conflict="account_id,platform").execute()

    try:
        from services.meta_ads_analytics import MetaAdsAnalytics
        meta = MetaAdsAnalytics(conn_data["access_token"], ad_account_id)

        campaigns = await meta.get_campaigns(date_from, date_to)
        ad_sets = await meta.get_ad_sets(date_from, date_to)
        placements = await meta.get_placement_stats(date_from, date_to)

        # Clear old
        sb.table("ad_campaigns").delete().eq("account_id", account_id).eq("platform", "meta").execute()
        sb.table("ad_groups").delete().eq("account_id", account_id).eq("platform", "meta").execute()
        sb.table("ad_placement_stats").delete().eq("account_id", account_id).execute()

        for c in campaigns:
            sb.table("ad_campaigns").insert({
                **c, "account_id": account_id, "platform": "meta",
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        for a in ad_sets:
            sb.table("ad_groups").insert({
                **a, "account_id": account_id, "platform": "meta",
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        for p in placements:
            sb.table("ad_placement_stats").insert({
                **p, "account_id": account_id,
                "date_from": str(date_from), "date_to": str(date_to),
            }).execute()

        sb.table("ad_sync_log").upsert({
            "account_id": account_id, "platform": "meta",
            "status": "completed", "campaigns_synced": len(campaigns),
            "completed_at": datetime.now(timezone.utc).isoformat(), "error_message": None,
        }, on_conflict="account_id,platform").execute()

        logger.info(f"✅ Meta Ads sync: {len(campaigns)} campaigns, {len(ad_sets)} ad sets")
        return {"status": "synced", "campaigns": len(campaigns), "ad_sets": len(ad_sets), "placements": len(placements)}

    except Exception as e:
        logger.error(f"❌ Meta Ads sync error: {e}", exc_info=True)
        sb.table("ad_sync_log").upsert({
            "account_id": account_id, "platform": "meta",
            "status": "error", "error_message": str(e)[:500],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="account_id,platform").execute()
        return {"status": "error", "message": str(e)}
