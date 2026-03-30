"""
Admin API for user management and statistics
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import logging
from middleware.auth import get_current_user
from database.supabase_client import get_supabase

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)


class AddCreditsRequest(BaseModel):
    amount: float
    reason: str = "Manual top-up by admin"


class MarginRequest(BaseModel):
    margin: float


@router.get("/margin")
async def get_margin(user=Depends(get_current_user)):
    from services.credits_service import MARGIN_MULTIPLIER
    return {"margin": MARGIN_MULTIPLIER}


@router.put("/margin")
async def set_margin(body: MarginRequest, user=Depends(get_current_user)):
    if not 1.0 <= body.margin <= 5.0:
        raise HTTPException(status_code=400, detail="Margin must be between 1.0 and 5.0")

    import services.credits_service as cs
    cs.MARGIN_MULTIPLIER = body.margin
    cs.CREDITS_PER_1K_INPUT = cs._BASE_PER_1K_INPUT * body.margin
    cs.CREDITS_PER_1K_OUTPUT = cs._BASE_PER_1K_OUTPUT * body.margin
    cs.FIXED_CREDITS = {k: round(v * body.margin) for k, v in cs._BASE_FIXED.items()}
    cs.VIDEO_DUBBING_PER_MIN = round(cs._BASE_DUBBING_PER_MIN * body.margin)
    cs.VIDEO_GEN_PER_SEC = {k: round(v * body.margin) for k, v in cs._BASE_VIDEO_GEN_PER_SEC.items()}
    cs.MIN_CREDITS = {k: round(v * body.margin) for k, v in cs._BASE_MIN.items()}
    cs.CREDITS_PER_POST = cs.MIN_CREDITS["social_posts"] + cs.FIXED_CREDITS["image_generation"]
    cs.CREDITS_PER_VIDEO = cs.VIDEO_GEN_PER_SEC["std_no_audio"] * 5

    logger.info(f"💰 Margin multiplier updated to ×{body.margin} by admin {user.get('user_id', '?')[:8]}")
    return {"success": True, "margin": body.margin}


@router.get("/users-stats")
async def get_users_stats(user=Depends(get_current_user)):
    """Get all users with their credits usage statistics (Admin only)"""

    try:
        supabase = get_supabase()

        try:
            result = supabase.rpc('get_users_credits_stats').execute()
            if result.data and len(result.data) > 0:
                return {"success": True, "users": result.data}
        except Exception:
            pass

        # Collect user IDs from accounts + user_credits
        accounts_result = supabase.table("accounts").select("user_id, name").execute()
        accounts_map = {}
        all_user_ids = set()
        for acc in (accounts_result.data or []):
            uid = acc["user_id"]
            all_user_ids.add(uid)
            accounts_map[uid] = acc.get("name", "")

        credits_result = supabase.table("user_credits").select("*").execute()
        credits_map = {c["user_id"]: c for c in (credits_result.data or [])}
        for c in (credits_result.data or []):
            all_user_ids.add(c["user_id"])

        usage_result = supabase.table("credits_usage") \
            .select("user_id, service_type, credits_spent, input_tokens, output_tokens, total_tokens, created_at") \
            .execute()

        unique_user_ids = list(all_user_ids)
        users_data = []

        for uid in unique_user_ids:
            email = "unknown@example.com"
            full_name = "Unknown User"

            # get_user_by_id works reliably — fetch email & name per user
            try:
                auth_response = supabase.auth.admin.get_user_by_id(uid)
                if auth_response and hasattr(auth_response, 'user') and auth_response.user:
                    email = auth_response.user.email or email
                    full_name = (auth_response.user.user_metadata or {}).get("full_name", full_name)
            except Exception:
                pass

            if full_name == "Unknown User":
                full_name = accounts_map.get(uid) or "Unknown User"

            credit_record = credits_map.get(uid)
            credits_remaining = float(credit_record.get("credits_remaining", 0)) if credit_record else 0.0
            total_credits = float(credit_record.get("total_credits_purchased", 0)) if credit_record else 0.0
            credits_used = float(credit_record.get("credits_used", 0)) if credit_record else 0.0

            usage_by_service = {}
            total_requests = 0
            last_activity = None

            for usage in (usage_result.data or []):
                if usage["user_id"] == uid:
                    service = usage["service_type"]
                    if service not in usage_by_service:
                        usage_by_service[service] = {"requests": 0, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0}

                    input_t = usage.get("input_tokens", 0) or 0
                    output_t = usage.get("output_tokens", 0) or 0
                    total_t = usage.get("total_tokens", 0) or 0

                    if service == "video_dubbing" and total_t > 10000:
                        video_size_mb = total_t / (1024 * 1024)
                        estimated_credits = max(1, int(video_size_mb / 3))
                        input_t, output_t, total_t = estimated_credits, 0, estimated_credits

                    usage_by_service[service]["requests"] += 1
                    usage_by_service[service]["input_tokens"] += input_t
                    usage_by_service[service]["output_tokens"] += output_t
                    usage_by_service[service]["total_tokens"] += total_t
                    total_requests += 1

                    if not last_activity or usage["created_at"] > last_activity:
                        last_activity = usage["created_at"]

            users_data.append({
                "user_id": uid,
                "email": email,
                "full_name": full_name,
                "total_credits": total_credits,
                "credits_used": credits_used,
                "credits_remaining": credits_remaining,
                "usage_by_service": usage_by_service,
                "total_requests": total_requests,
                "last_activity": last_activity,
            })

        return {"success": True, "users": users_data}

    except Exception as e:
        logger.error(f"Failed to get users stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/{user_id}/add-credits")
async def add_credits_to_user(user_id: str, body: AddCreditsRequest, admin_user=Depends(get_current_user)):
    """Add credits to a user's balance (Admin only)."""
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    try:
        supabase = get_supabase()
        existing = supabase.table("user_credits").select("*").eq("user_id", user_id).limit(1).execute()

        if existing.data:
            old = existing.data[0]
            supabase.table("user_credits").update({
                "total_credits_purchased": float(old.get("total_credits_purchased", 0)) + body.amount,
                "credits_remaining": float(old.get("credits_remaining", 0)) + body.amount,
            }).eq("user_id", user_id).execute()
        else:
            supabase.table("user_credits").insert({
                "user_id": user_id,
                "total_credits_purchased": body.amount,
                "credits_used": 0.0,
                "credits_remaining": body.amount,
            }).execute()

        logger.info(f"Admin {admin_user.get('user_id', '?')[:8]} added {body.amount} credits to {user_id[:8]} — {body.reason}")
        return {"success": True, "added": body.amount, "reason": body.reason}

    except Exception as e:
        logger.error(f"Failed to add credits: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/details")
async def get_user_details(user_id: str, admin_user=Depends(get_current_user)):
    """Get detailed usage for specific user (Admin only)"""

    try:
        supabase = get_supabase()
        credits = supabase.table("user_credits").select("*").eq("user_id", user_id).single().execute()
        usage = supabase.table("credits_usage").select("*").eq("user_id", user_id) \
            .order("created_at", desc=True).limit(100).execute()

        return {"success": True, "credits": credits.data, "usage_history": usage.data or []}

    except Exception as e:
        logger.error(f"Failed to get user details: {e}")
        raise HTTPException(status_code=500, detail=str(e))
