"""
Ad Analytics API — sync, retrieve, and query cross-platform ad data
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date, timedelta
import logging

from middleware.auth import get_current_user
from database.supabase_client import get_supabase

router = APIRouter(prefix="/api/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


def _get_active_account_id(user_id: str) -> str:
    sb = get_supabase()
    try:
        settings = sb.table("user_settings").select("active_account_id").eq("user_id", user_id).limit(1).execute()
        if settings.data and settings.data[0].get("active_account_id"):
            return settings.data[0]["active_account_id"]
    except Exception:
        pass
    try:
        acc = sb.table("accounts").select("id").eq("user_id", user_id).eq("is_active", True).limit(1).execute()
        if acc.data:
            return acc.data[0]["id"]
    except Exception:
        pass
    raise HTTPException(status_code=400, detail="No active account")


@router.post("/sync")
async def sync_all(
    days: int = Query(30, ge=1, le=365),
    force: bool = Query(False),
    user=Depends(get_current_user),
):
    """Trigger sync for both Google Ads and Meta. Called on page open."""
    user_id = user["user_id"]
    account_id = _get_active_account_id(user_id)
    date_to = date.today()
    date_from = date_to - timedelta(days=days)

    # Force sync: clear sync log so stale check passes
    if force:
        sb = get_supabase()
        sb.table("ad_sync_log").delete().eq("account_id", account_id).execute()
        logger.info(f"🔄 Force sync: cleared sync log for {account_id}")

    from services.ad_sync import sync_google_ads, sync_meta_ads
    import asyncio

    g_result, m_result = await asyncio.gather(
        sync_google_ads(account_id, user_id, date_from, date_to),
        sync_meta_ads(account_id, user_id, date_from, date_to),
        return_exceptions=True,
    )

    if isinstance(g_result, Exception):
        g_result = {"status": "error", "message": str(g_result)}
    if isinstance(m_result, Exception):
        m_result = {"status": "error", "message": str(m_result)}

    return {"google_ads": g_result, "meta": m_result}


@router.get("/campaigns")
async def get_campaigns(
    platform: str = Query(None, description="google_ads or meta, omit for both"),
    user=Depends(get_current_user),
):
    """Get cached campaign data."""
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()
    q = sb.table("ad_campaigns").select("*").eq("account_id", account_id).order("spend", desc=True)
    if platform:
        q = q.eq("platform", platform)
    result = q.execute()
    return {"campaigns": result.data or []}


@router.get("/ad-groups")
async def get_ad_groups(
    campaign_id: str = Query(None),
    platform: str = Query(None),
    user=Depends(get_current_user),
):
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()
    q = sb.table("ad_groups").select("*").eq("account_id", account_id).order("spend", desc=True)
    if platform:
        q = q.eq("platform", platform)
    if campaign_id:
        q = q.eq("platform_campaign_id", campaign_id)
    result = q.execute()
    return {"ad_groups": result.data or []}


@router.get("/keywords")
async def get_keywords(
    campaign_id: str = Query(None),
    user=Depends(get_current_user),
):
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()
    q = sb.table("ad_keywords").select("*").eq("account_id", account_id).order("clicks", desc=True)
    if campaign_id:
        q = q.eq("platform_campaign_id", campaign_id)
    result = q.execute()
    return {"keywords": result.data or []}


@router.get("/devices")
async def get_device_stats(user=Depends(get_current_user)):
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()
    result = sb.table("ad_device_stats").select("*").eq("account_id", account_id).execute()
    return {"devices": result.data or []}


@router.get("/geo")
async def get_geo_stats(user=Depends(get_current_user)):
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()
    result = sb.table("ad_geo_stats").select("*").eq("account_id", account_id).execute()
    return {"geo": result.data or []}


@router.get("/placements")
async def get_placement_stats(user=Depends(get_current_user)):
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()
    result = sb.table("ad_placement_stats").select("*").eq("account_id", account_id).execute()
    return {"placements": result.data or []}


@router.get("/sync-status")
async def get_sync_status(user=Depends(get_current_user)):
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()
    result = sb.table("ad_sync_log").select("*").eq("account_id", account_id).execute()
    return {"syncs": result.data or []}


@router.get("/overview")
async def get_overview(user=Depends(get_current_user)):
    """Unified cross-platform overview — totals, top campaigns, breakdowns."""
    account_id = _get_active_account_id(user["user_id"])
    sb = get_supabase()

    camps = sb.table("ad_campaigns").select("*").eq("account_id", account_id).execute().data or []

    totals = {"google_ads": {}, "meta": {}, "combined": {}}
    for platform in ["google_ads", "meta"]:
        pc = [c for c in camps if c["platform"] == platform]
        totals[platform] = {
            "campaigns": len(pc),
            "impressions": sum(c.get("impressions", 0) for c in pc),
            "clicks": sum(c.get("clicks", 0) for c in pc),
            "spend": round(sum(c.get("spend", 0) for c in pc), 2),
            "conversions": round(sum(c.get("conversions", 0) for c in pc), 2),
            "reach": sum(c.get("reach", 0) for c in pc),
        }
        imps = totals[platform]["impressions"]
        clicks = totals[platform]["clicks"]
        totals[platform]["ctr"] = round((clicks / imps * 100) if imps else 0, 2)
        convs = totals[platform]["conversions"]
        spend = totals[platform]["spend"]
        totals[platform]["cpa"] = round((spend / convs) if convs else 0, 2)

    totals["combined"] = {
        k: totals["google_ads"].get(k, 0) + totals["meta"].get(k, 0)
        for k in ["campaigns", "impressions", "clicks", "spend", "conversions", "reach"]
    }
    c_imps = totals["combined"]["impressions"]
    c_clicks = totals["combined"]["clicks"]
    c_convs = totals["combined"]["conversions"]
    c_spend = totals["combined"]["spend"]
    totals["combined"]["ctr"] = round((c_clicks / c_imps * 100) if c_imps else 0, 2)
    totals["combined"]["cpa"] = round((c_spend / c_convs) if c_convs else 0, 2)

    # Top 5 campaigns by spend
    top_campaigns = sorted(camps, key=lambda c: c.get("spend", 0), reverse=True)[:5]

    # Sync status
    syncs = sb.table("ad_sync_log").select("*").eq("account_id", account_id).execute().data or []

    return {
        "totals": totals,
        "top_campaigns": top_campaigns,
        "sync_status": syncs,
    }
