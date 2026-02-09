"""
Admin API for user management and statistics
"""
from fastapi import APIRouter, Depends, HTTPException
import logging
from middleware.auth import get_current_user
from database.supabase_client import get_supabase

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)

# List of admin user IDs (TODO: move to database)
ADMIN_USER_IDS = [
    # Add your admin user IDs here
]


def is_admin(user: dict) -> bool:
    """Check if user is admin"""
    # For now, check email domain or specific user IDs
    email = user.get("email", "")
    user_id = user.get("user_id", "")
    
    # Allow specific user IDs or email domains
    if user_id in ADMIN_USER_IDS:
        return True
    
    # Allow @joyomarketing.com or any email for now (TODO: restrict)
    # For development, allow all authenticated users
    return True  # CHANGE THIS IN PRODUCTION!


@router.get("/users-stats")
async def get_users_stats(user = Depends(get_current_user)):
    """
    Get all users with their credits usage statistics
    (Admin only)
    """
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        supabase = get_supabase()
        
        logger.info("🔍 Fetching users stats...")
        
        # Try RPC first
        try:
            result = supabase.rpc('get_users_credits_stats').execute()
            if result.data and len(result.data) > 0:
                logger.info(f"✅ RPC returned {len(result.data)} users")
                return {
                    "success": True,
                    "users": result.data
                }
        except Exception as rpc_error:
            logger.warning(f"⚠️ RPC failed: {rpc_error}, falling back to manual query")
        
        # Fallback: manual query
        logger.info("🔄 Using manual query fallback...")
        
        # Get all user_credits
        credits_result = supabase.table("user_credits").select("*").execute()
        logger.info(f"💰 Found {len(credits_result.data or [])} user_credits records")
        
        # Get usage breakdown by service
        usage_result = supabase.table("credits_usage")\
            .select("user_id, service_type, credits_spent, created_at")\
            .execute()
        logger.info(f"📊 Found {len(usage_result.data or [])} usage records")
        
        # Get user details from auth (try different approaches)
        users_data = []
        
        # If no credits yet, return empty list
        if not credits_result.data:
            logger.info("ℹ️ No user_credits records found")
            return {
                "success": True,
                "users": []
            }
        
        for credit_record in credits_result.data:
            user_id = credit_record["user_id"]
            
            # Try to get user email from auth
            try:
                # Supabase admin can access auth.users
                auth_user = supabase.auth.admin.get_user(user_id)
                email = auth_user.user.email if auth_user.user else "unknown@example.com"
                full_name = auth_user.user.user_metadata.get("full_name", "Unknown") if auth_user.user else "Unknown"
            except:
                email = "unknown@example.com"
                full_name = "Unknown User"
            
            # Aggregate usage by service
            credits_by_service = {}
            total_requests = 0
            last_activity = None
            
            for usage in (usage_result.data or []):
                if usage["user_id"] == user_id:
                    service = usage["service_type"]
                    credits_by_service[service] = credits_by_service.get(service, 0) + float(usage["credits_spent"])
                    total_requests += 1
                    
                    if not last_activity or usage["created_at"] > last_activity:
                        last_activity = usage["created_at"]
            
            users_data.append({
                "user_id": user_id,
                "email": email,
                "full_name": full_name,
                "total_credits_used": float(credit_record["credits_used"]),
                "credits_by_service": credits_by_service,
                "total_requests": total_requests,
                "last_activity": last_activity
            })
        
        logger.info(f"✅ Returning {len(users_data)} users")
        
        return {
            "success": True,
            "users": users_data
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get users stats: {e}")
        logger.exception("Full error:")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/details")
async def get_user_details(user_id: str, admin_user = Depends(get_current_user)):
    """
    Get detailed usage for specific user
    (Admin only)
    """
    if not is_admin(admin_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        supabase = get_supabase()
        
        # Get user credits
        credits = supabase.table("user_credits")\
            .select("*")\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        # Get recent usage
        usage = supabase.table("credits_usage")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .limit(100)\
            .execute()
        
        return {
            "success": True,
            "credits": credits.data,
            "usage_history": usage.data or []
        }
        
    except Exception as e:
        logger.error(f"Failed to get user details: {e}")
        raise HTTPException(status_code=500, detail=str(e))
