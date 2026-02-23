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

ADMIN_USER_IDS = [
    # Add your admin user IDs here
]


def is_admin(user: dict) -> bool:
    email = user.get("email", "")
    user_id = user.get("user_id", "")
    if user_id in ADMIN_USER_IDS:
        return True
    # For development, allow all authenticated users
    return True  # CHANGE THIS IN PRODUCTION!


class AddCreditsRequest(BaseModel):
    amount: float
    reason: str = "Manual top-up by admin"


@router.get("/users-stats")
async def get_users_stats(user=Depends(get_current_user)):
    """Get all users with their credits usage statistics (Admin only)"""
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        supabase = get_supabase()

        try:
            result = supabase.rpc('get_users_credits_stats').execute()
            if result.data and len(result.data) > 0:
                return {"success": True, "users": result.data}
        except Exception:
            pass

        accounts_result = supabase.table("accounts").select("user_id").execute()
        credits_result = supabase.table("user_credits").select("*").execute()
        credits_map = {c["user_id"]: c for c in (credits_result.data or [])}

        usage_result = supabase.table("credits_usage") \
            .select("user_id, service_type, credits_spent, input_tokens, output_tokens, total_tokens, created_at") \
            .execute()

        unique_user_ids = list(set(acc["user_id"] for acc in (accounts_result.data or [])))
        users_data = []

        for uid in unique_user_ids:
            email = "unknown@example.com"
            full_name = "Unknown User"

            try:
                auth_response = supabase.auth.admin.get_user_by_id(uid)
                if auth_response and hasattr(auth_response, 'user') and auth_response.user:
                    email = auth_response.user.email or email
                    full_name = (auth_response.user.user_metadata or {}).get("full_name", full_name)
            except Exception:
                try:
                    user_query = supabase.rpc('get_user_by_id', {'user_id': uid}).execute()
                    if user_query.data:
                        email = user_query.data.get('email', email)
                        raw_meta = user_query.data.get('raw_user_meta_data', {})
                        full_name = (raw_meta or {}).get('full_name', full_name)
                except Exception:
                    try:
                        account = supabase.table("accounts").select("name").eq("user_id", uid).single().execute()
                        if account.data and account.data.get("name"):
                            full_name = account.data["name"]
                    except Exception:
                        pass

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
    if not is_admin(admin_user):
        raise HTTPException(status_code=403, detail="Admin access required")
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
    if not is_admin(admin_user):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        supabase = get_supabase()
        credits = supabase.table("user_credits").select("*").eq("user_id", user_id).single().execute()
        usage = supabase.table("credits_usage").select("*").eq("user_id", user_id) \
            .order("created_at", desc=True).limit(100).execute()

        return {"success": True, "credits": credits.data, "usage_history": usage.data or []}

    except Exception as e:
        logger.error(f"Failed to get user details: {e}")
        raise HTTPException(status_code=500, detail=str(e))
