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

            try:
                auth_response = supabase.auth.admin.get_user_by_id(uid)
                # supabase-py 2.x: response may be User directly or have .user attr
                u = getattr(auth_response, 'user', auth_response)
                if u:
                    email = getattr(u, 'email', None) or email
                    meta = getattr(u, 'user_metadata', None) or {}
                    full_name = meta.get("full_name", full_name) if isinstance(meta, dict) else full_name
                    logger.info(f"Auth user {uid[:8]}: email={email}, name={full_name}")
                else:
                    logger.warning(f"Auth user {uid[:8]}: response has no user data, type={type(auth_response)}")
            except Exception as e:
                logger.warning(f"get_user_by_id failed for {uid[:8]}: {e}")

            if full_name == "Unknown User":
                full_name = accounts_map.get(uid) or "Unknown User"

            credit_record = credits_map.get(uid)
            credits_remaining = float(credit_record.get("credits_remaining", 0)) if credit_record else 0.0
            total_credits = float(credit_record.get("total_credits_purchased", 0)) if credit_record else 0.0
            credits_used = float(credit_record.get("credits_used", 0)) if credit_record else 0.0
            bypass_sub = bool(credit_record.get("bypass_subscription", False)) if credit_record else False

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
                "bypass_subscription": bypass_sub,
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


class BypassRequest(BaseModel):
    bypass: bool
    credits: float = 0
    reason: str = "Admin override"


@router.post("/user/{user_id}/bypass-subscription")
async def set_subscription_bypass(user_id: str, body: BypassRequest, admin_user=Depends(get_current_user)):
    """Grant or revoke subscription bypass for a user. Optionally add credits."""
    try:
        supabase = get_supabase()
        existing = supabase.table("user_credits").select("user_id").eq("user_id", user_id).limit(1).execute()
        if existing.data:
            supabase.table("user_credits").update({
                "bypass_subscription": body.bypass,
            }).eq("user_id", user_id).execute()
        else:
            supabase.table("user_credits").insert({
                "user_id": user_id,
                "total_credits_purchased": body.credits,
                "credits_used": 0.0,
                "credits_remaining": body.credits,
                "bypass_subscription": body.bypass,
            }).execute()

        if body.credits > 0:
            from routers.billing import _add_credits
            await _add_credits(user_id, int(body.credits), "admin_grant", "admin_bypass")

        action = "granted" if body.bypass else "revoked"
        logger.info(f"Admin {admin_user.get('user_id', '?')[:8]} {action} bypass for {user_id[:8]} +{body.credits}cr — {body.reason}")
        return {"success": True, "bypass": body.bypass, "credits_added": body.credits}

    except Exception as e:
        logger.error(f"Failed to set bypass: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Drop-offs / Funnel endpoint ──────────────────────────────────────────────

@router.get("/drop-offs")
async def get_drop_offs(user=Depends(get_current_user)):
    """
    Return all registered users with their funnel stage:
      - registered only (never started onboarding)
      - started onboarding (account exists, onboarding_complete=false)
      - completed onboarding but no payment
      - completed payment (converted)
      - bypass (admin granted free access)
    """
    try:
        supabase = get_supabase()

        # Try the materialized view first (fastest)
        try:
            view_result = supabase.table("user_funnel").select("*").execute()
            if view_result.data is not None:
                return {"success": True, "drop_offs": _enrich_funnel(view_result.data)}
        except Exception as view_err:
            logger.info(f"user_funnel view not available ({view_err}), using fallback")

        # Fallback: assemble from raw tables
        accounts_res = supabase.table("accounts").select("user_id, name, metadata, created_at").execute()
        accounts_by_user: dict = {}
        for acc in (accounts_res.data or []):
            uid = acc["user_id"]
            if uid not in accounts_by_user or acc.get("created_at", "") > accounts_by_user[uid].get("created_at", ""):
                accounts_by_user[uid] = acc

        subs_res = supabase.table("subscriptions").select("user_id").execute()
        paid_users: set = {s["user_id"] for s in (subs_res.data or [])}

        credits_res = supabase.table("user_credits").select("user_id, bypass_subscription").execute()
        bypass_users: set = {c["user_id"] for c in (credits_res.data or []) if c.get("bypass_subscription")}

        activity_res = supabase.table("credits_usage").select("user_id, created_at").order("created_at", desc=True).execute()
        last_activity_map: dict = {}
        for row in (activity_res.data or []):
            uid = row["user_id"]
            if uid not in last_activity_map:
                last_activity_map[uid] = row["created_at"]

        all_user_ids = set(accounts_by_user.keys()) | paid_users | bypass_users
        rows = []
        for uid in all_user_ids:
            email, full_name, registered_at = "unknown@example.com", "", None
            try:
                auth_resp = supabase.auth.admin.get_user_by_id(uid)
                u = getattr(auth_resp, "user", auth_resp)
                if u:
                    email = getattr(u, "email", None) or email
                    meta = getattr(u, "user_metadata", {}) or {}
                    full_name = meta.get("full_name", "") if isinstance(meta, dict) else ""
                    registered_at = str(getattr(u, "created_at", ""))
            except Exception as e:
                logger.warning(f"get_user_by_id failed for {uid[:8]}: {e}")

            acc = accounts_by_user.get(uid)
            onboarding_complete = bool(acc and (acc.get("metadata") or {}).get("onboarding_complete")) if acc else False
            rows.append({
                "user_id": uid,
                "email": email,
                "full_name": full_name,
                "registered_at": registered_at,
                "company_name": acc["name"] if acc else "",
                "website_url": (acc.get("metadata") or {}).get("website_url", "") if acc else "",
                "started_onboarding": acc is not None,
                "completed_onboarding": onboarding_complete,
                "completed_payment": uid in paid_users,
                "bypass_subscription": uid in bypass_users,
                "last_activity": last_activity_map.get(uid),
            })

        return {"success": True, "drop_offs": _enrich_funnel(rows)}

    except Exception as e:
        logger.error(f"Failed to get drop-offs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _enrich_funnel(rows: list) -> list:
    enriched = []
    for row in rows:
        paid = row.get("completed_payment", False)
        bypass = row.get("bypass_subscription", False)
        onb_done = row.get("completed_onboarding", False)
        onb_started = row.get("started_onboarding", False)

        if paid or bypass:
            stage = "converted"
        elif onb_done:
            stage = "onboarding_done"
        elif onb_started:
            stage = "onboarding_started"
        else:
            stage = "registered"

        enriched.append({**row, "stage": stage})

    enriched.sort(key=lambda r: r.get("registered_at") or "", reverse=True)
    return enriched
