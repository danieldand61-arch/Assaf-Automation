"""
Ad Analytics Sync — fetches data from Google Ads & Meta, normalizes, caches to Supabase
"""
import asyncio
import logging
from datetime import date, timedelta, datetime, timezone
from typing import Optional

from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

STALE_MINUTES = 30
MAX_RETRIES = 3
RETRY_DELAY = 2

# Known columns in ad_campaigns — extra fields from API are stored in 'extra_data' jsonb
_CAMPAIGN_COLS = {
    "platform_campaign_id", "campaign_name", "status", "objective",
    "daily_budget", "lifetime_budget", "impressions", "clicks", "ctr",
    "spend", "avg_cpc", "reach", "frequency", "conversions", "roas",
    "cost_per_conversion", "account_id", "platform",
    "date_from", "date_to",
}

def _filter_campaign(row: dict) -> dict:
    """Keep only known DB columns, drop the rest."""
    return {k: v for k, v in row.items() if k in _CAMPAIGN_COLS}


async def _with_retry(coro_fn, *args, retries=MAX_RETRIES):
    for attempt in range(1, retries + 1):
        try:
            return await coro_fn(*args)
        except Exception as e:
            if attempt == retries:
                raise
            logger.warning(f"⚠️ Retry {attempt}/{retries} after error: {e}")
            await asyncio.sleep(RETRY_DELAY * attempt)


def _safe_log(sb, data: dict):
    """Write to ad_sync_log, silently fail if table doesn't exist."""
    try:
        sb.table("ad_sync_log").upsert(data, on_conflict="account_id,platform").execute()
    except Exception as e:
        logger.warning(f"⚠️ ad_sync_log write failed (table may not exist): {e}")

def _is_stale(account_id: str, platform: str) -> bool:
    try:
        sb = get_supabase()
        rows = sb.table("ad_sync_log").select("completed_at,status").eq("account_id", account_id).eq("platform", platform).limit(1).execute()
        if not rows.data:
            return True
        row = rows.data[0]
        if row.get("status") == "error":
            return True
        completed = row.get("completed_at")
        if not completed:
            return True
        last = datetime.fromisoformat(completed.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - last).total_seconds() > STALE_MINUTES * 60
    except Exception:
        return True


async def sync_google_ads(account_id: str, user_id: str, date_from: date, date_to: date) -> dict:
    sb = get_supabase()

    try:
        rows = sb.table("google_ads_connections").select("*").eq("user_id", user_id).eq("status", "active").limit(1).execute()
        conn_data = rows.data[0] if rows.data else None
    except Exception:
        conn_data = None
    if not conn_data:
        logger.info("ℹ️ Google Ads sync: no connection found")
        return {"status": "no_connection", "message": "No Google Ads account connected"}

    if not _is_stale(account_id, "google_ads"):
        logger.info("ℹ️ Google Ads sync: data is fresh, skipping")
        return {"status": "cached", "message": "Data is fresh"}

    logger.info(f"🔄 Google Ads sync starting for account {account_id}")
    _safe_log(sb, {"account_id": account_id, "platform": "google_ads", "status": "syncing", "started_at": datetime.now(timezone.utc).isoformat(), "error_message": None})

    try:
        from services.google_ads_analytics import GoogleAdsAnalytics
        ga = GoogleAdsAnalytics(conn_data["refresh_token"], conn_data["customer_id"])

        campaigns = ga.get_campaigns_full(date_from, date_to)
        ad_groups = ga.get_ad_groups_full(date_from, date_to)
        keywords = ga.get_keywords(date_from, date_to)
        device_stats = ga.get_device_stats(date_from, date_to)
        geo_stats = ga.get_geo_stats(date_from, date_to)

        sb.table("ad_campaigns").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()
        sb.table("ad_groups").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()
        sb.table("ad_keywords").delete().eq("account_id", account_id).execute()
        sb.table("ad_device_stats").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()
        sb.table("ad_geo_stats").delete().eq("account_id", account_id).eq("platform", "google_ads").execute()

        for c in campaigns:
            sb.table("ad_campaigns").insert(_filter_campaign({**c, "account_id": account_id, "platform": "google_ads", "date_from": str(date_from), "date_to": str(date_to)})).execute()
        for ag in ad_groups:
            sb.table("ad_groups").insert({**ag, "account_id": account_id, "platform": "google_ads", "date_from": str(date_from), "date_to": str(date_to)}).execute()
        for kw in keywords:
            sb.table("ad_keywords").insert({**kw, "account_id": account_id, "date_from": str(date_from), "date_to": str(date_to)}).execute()
        for ds in device_stats:
            sb.table("ad_device_stats").insert({**ds, "account_id": account_id, "platform": "google_ads", "date_from": str(date_from), "date_to": str(date_to)}).execute()
        for gs in geo_stats:
            sb.table("ad_geo_stats").insert({**gs, "account_id": account_id, "platform": "google_ads", "date_from": str(date_from), "date_to": str(date_to)}).execute()

        _safe_log(sb, {"account_id": account_id, "platform": "google_ads", "status": "completed", "campaigns_synced": len(campaigns), "completed_at": datetime.now(timezone.utc).isoformat(), "error_message": None})

        logger.info(f"✅ Google Ads sync: {len(campaigns)} campaigns, {len(keywords)} keywords")
        return {"status": "synced", "campaigns": len(campaigns), "ad_groups": len(ad_groups), "keywords": len(keywords)}

    except Exception as e:
        logger.error(f"❌ Google Ads sync error: {e}", exc_info=True)
        _safe_log(sb, {"account_id": account_id, "platform": "google_ads", "status": "error", "error_message": str(e)[:500], "completed_at": datetime.now(timezone.utc).isoformat()})
        return {"status": "error", "message": str(e)}


async def sync_meta_ads(account_id: str, user_id: str, date_from: date, date_to: date) -> dict:
    sb = get_supabase()

    try:
        rows = sb.table("account_connections").select("*").eq("account_id", account_id).eq("platform", "meta_ads").eq("is_connected", True).limit(1).execute()
        conn_data = rows.data[0] if rows.data else None
    except Exception:
        conn_data = None
    if not conn_data:
        logger.info("ℹ️ Meta Ads sync: no connection found")
        return {"status": "no_connection", "message": "No Meta Ads account connected"}

    ad_account_id = conn_data.get("metadata", {}).get("ad_account_id") if conn_data.get("metadata") else None
    if not ad_account_id:
        ad_account_id = conn_data.get("platform_user_id")
    if not ad_account_id:
        logger.warning("⚠️ Meta Ads sync: no ad_account_id found in connection")
        return {"status": "no_ad_account", "message": "No Meta Ad Account ID configured."}

    logger.info(f"🔄 Meta Ads sync: found connection, ad_account={ad_account_id}")

    if not _is_stale(account_id, "meta"):
        logger.info("ℹ️ Meta Ads sync: data is fresh, skipping")
        return {"status": "cached", "message": "Data is fresh"}

    logger.info(f"🔄 Meta Ads sync starting for account {account_id}, ad_account={ad_account_id}")
    _safe_log(sb, {"account_id": account_id, "platform": "meta", "status": "syncing", "started_at": datetime.now(timezone.utc).isoformat(), "error_message": None})

    try:
        from services.meta_ads_analytics import MetaAdsAnalytics
        meta = MetaAdsAnalytics(conn_data["access_token"], ad_account_id)

        logger.info("📡 Fetching Meta campaigns...")
        campaigns = await _with_retry(meta.get_campaigns, date_from, date_to)
        logger.info(f"📡 Fetching Meta ad sets... (got {len(campaigns)} campaigns)")
        ad_sets = await _with_retry(meta.get_ad_sets, date_from, date_to)
        logger.info(f"📡 Fetching Meta placements... (got {len(ad_sets)} ad sets)")
        placements = await _with_retry(meta.get_placement_stats, date_from, date_to)
        logger.info(f"📡 Got {len(placements)} placement records")

        sb.table("ad_campaigns").delete().eq("account_id", account_id).eq("platform", "meta").execute()
        sb.table("ad_groups").delete().eq("account_id", account_id).eq("platform", "meta").execute()
        sb.table("ad_placement_stats").delete().eq("account_id", account_id).execute()

        for c in campaigns:
            sb.table("ad_campaigns").insert(_filter_campaign({**c, "account_id": account_id, "platform": "meta", "date_from": str(date_from), "date_to": str(date_to)})).execute()
        for a in ad_sets:
            sb.table("ad_groups").insert({**a, "account_id": account_id, "platform": "meta", "date_from": str(date_from), "date_to": str(date_to)}).execute()
        for p in placements:
            sb.table("ad_placement_stats").insert({**p, "account_id": account_id, "date_from": str(date_from), "date_to": str(date_to)}).execute()

        _safe_log(sb, {"account_id": account_id, "platform": "meta", "status": "completed", "campaigns_synced": len(campaigns), "completed_at": datetime.now(timezone.utc).isoformat(), "error_message": None})

        logger.info(f"✅ Meta Ads sync complete: {len(campaigns)} campaigns, {len(ad_sets)} ad sets, {len(placements)} placements")
        return {"status": "synced", "campaigns": len(campaigns), "ad_sets": len(ad_sets), "placements": len(placements)}

    except Exception as e:
        logger.error(f"❌ Meta Ads sync error: {e}", exc_info=True)
        _safe_log(sb, {"account_id": account_id, "platform": "meta", "status": "error", "error_message": str(e)[:500], "completed_at": datetime.now(timezone.utc).isoformat()})
        return {"status": "error", "message": str(e)}
