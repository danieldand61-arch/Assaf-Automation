"""
Credits tracking and statistics API
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import logging
from middleware.auth import get_current_user
from services.credits_tracker import CreditsTracker

router = APIRouter(prefix="/api/credits", tags=["credits"])
logger = logging.getLogger(__name__)


@router.get("/balance")
async def get_balance(user = Depends(get_current_user)):
    """
    Get user's current credits balance
    """
    try:
        tracker = CreditsTracker(user["user_id"])
        balance = await tracker.get_user_balance()
        
        return {
            "success": True,
            "balance": balance
        }
    except Exception as e:
        logger.error(f"Failed to get balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usage")
async def get_usage(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    user = Depends(get_current_user)
):
    """
    Get usage statistics for the last N days
    """
    try:
        tracker = CreditsTracker(user["user_id"])
        stats = await tracker.get_usage_stats(days=days)
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Failed to get usage stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_history(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    service_type: Optional[str] = Query(None, description="Filter by service type"),
    user = Depends(get_current_user)
):
    """
    Get detailed usage history
    """
    try:
        from database.supabase_client import get_supabase
        supabase = get_supabase()
        
        # Build query
        query = supabase.table("credits_usage")\
            .select("*")\
            .eq("user_id", user["user_id"])\
            .order("created_at", desc=True)\
            .limit(limit)\
            .range(offset, offset + limit - 1)
        
        # Add service type filter if provided
        if service_type:
            query = query.eq("service_type", service_type)
        
        result = query.execute()
        
        return {
            "success": True,
            "history": result.data or [],
            "total": len(result.data) if result.data else 0
        }
    except Exception as e:
        logger.error(f"Failed to get history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_summary(user = Depends(get_current_user)):
    """
    Get complete credits summary (balance + usage stats)
    """
    try:
        tracker = CreditsTracker(user["user_id"])
        
        # Get balance and stats in parallel
        balance = await tracker.get_user_balance()
        stats_30d = await tracker.get_usage_stats(days=30)
        stats_7d = await tracker.get_usage_stats(days=7)
        
        return {
            "success": True,
            "balance": balance,
            "usage_30_days": stats_30d,
            "usage_7_days": stats_7d
        }
    except Exception as e:
        logger.error(f"Failed to get summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
