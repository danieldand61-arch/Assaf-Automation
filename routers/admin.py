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
        
        # Get all accounts (users that exist in the system)
        accounts_result = supabase.table("accounts").select("user_id").execute()
        logger.info(f"👥 Found {len(accounts_result.data or [])} accounts")
        
        # Get all user_credits
        credits_result = supabase.table("user_credits").select("*").execute()
        credits_map = {c["user_id"]: c for c in (credits_result.data or [])}
        logger.info(f"💰 Found {len(credits_map)} user_credits records")
        
        # Get usage breakdown by service
        usage_result = supabase.table("credits_usage")\
            .select("user_id, service_type, credits_spent, created_at")\
            .execute()
        logger.info(f"📊 Found {len(usage_result.data or [])} usage records")
        
        # Get unique user IDs from accounts
        unique_user_ids = list(set(acc["user_id"] for acc in (accounts_result.data or [])))
        logger.info(f"🔍 Processing {len(unique_user_ids)} unique users")
        
        users_data = []
        
        for user_id in unique_user_ids:
            # Try to get user email from auth using RPC or direct query
            email = "unknown@example.com"
            full_name = "Unknown User"
            
            try:
                # Method 1: Try admin API
                auth_response = supabase.auth.admin.get_user_by_id(user_id)
                if auth_response and hasattr(auth_response, 'user') and auth_response.user:
                    email = auth_response.user.email or "unknown@example.com"
                    full_name = auth_response.user.user_metadata.get("full_name", "Unknown User") if auth_response.user.user_metadata else "Unknown User"
                    logger.info(f"✅ Got user {email} via admin API")
            except Exception as e1:
                logger.warning(f"⚠️ Admin API failed for {user_id}: {e1}")
                
                # Method 2: Try direct SQL query to auth.users (requires service_role)
                try:
                    user_query = supabase.rpc('get_user_by_id', {'user_id': user_id}).execute()
                    if user_query.data:
                        email = user_query.data.get('email', "unknown@example.com")
                        raw_meta = user_query.data.get('raw_user_meta_data', {})
                        full_name = raw_meta.get('full_name', 'Unknown User') if raw_meta else 'Unknown User'
                        logger.info(f"✅ Got user {email} via RPC")
                except Exception as e2:
                    logger.warning(f"⚠️ RPC also failed for {user_id}: {e2}")
                    # Last resort: try to get from accounts table name
                    try:
                        account = supabase.table("accounts").select("name").eq("user_id", user_id).single().execute()
                        if account.data and account.data.get("name"):
                            full_name = account.data["name"]
                    except:
                        pass
            
            # Get credits info
            credit_record = credits_map.get(user_id)
            total_credits_used = float(credit_record["credits_used"]) if credit_record else 0.0
            
            # Aggregate usage by service (tokens/units, not credits)
            usage_by_service = {}
            total_requests = 0
            last_activity = None
            
            for usage in (usage_result.data or []):
                if usage["user_id"] == user_id:
                    service = usage["service_type"]
                    
                    if service not in usage_by_service:
                        usage_by_service[service] = {
                            "requests": 0,
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "total_tokens": 0
                        }
                    
                    usage_by_service[service]["requests"] += 1
                    usage_by_service[service]["input_tokens"] += usage.get("input_tokens", 0)
                    usage_by_service[service]["output_tokens"] += usage.get("output_tokens", 0)
                    usage_by_service[service]["total_tokens"] += usage.get("total_tokens", 0)
                    total_requests += 1
                    
                    if not last_activity or usage["created_at"] > last_activity:
                        last_activity = usage["created_at"]
            
            users_data.append({
                "user_id": user_id,
                "email": email,
                "full_name": full_name,
                "usage_by_service": usage_by_service,
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
