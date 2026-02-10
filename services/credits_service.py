"""
Credits tracking service
Calculates and records API usage costs
"""
import logging
from datetime import datetime
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# Pricing per service (in USD)
PRICING = {
    "gemini_chat": 0.002,  # per 1K tokens
    "google_ads": 0.01,    # per generation
    "image_generation": 0.02,  # per image
    "social_post": 0.005,  # per post
    "video_translation": 0.008,  # per video
}


def calculate_gemini_cost(input_tokens: int, output_tokens: int) -> float:
    """
    Calculate cost for Gemini API call
    """
    total_tokens = input_tokens + output_tokens
    cost = (total_tokens / 1000) * PRICING["gemini_chat"]
    return round(cost, 6)


def calculate_service_cost(service_type: str, quantity: int = 1) -> float:
    """
    Calculate cost for non-chat services
    """
    if service_type not in PRICING:
        logger.warning(f"Unknown service type: {service_type}")
        return 0.0
    
    cost = PRICING[service_type] * quantity
    return round(cost, 6)


async def record_usage(
    user_id: str,
    service_type: str,
    credits_spent: float,
    metadata: dict = None
) -> bool:
    """
    Record API usage in credits_usage table
    Trigger will automatically update user_credits
    """
    try:
        supabase = get_supabase()
        
        usage_data = {
            "user_id": user_id,
            "service_type": service_type,
            "credits_spent": credits_spent,
            "metadata": metadata or {},
            "created_at": datetime.utcnow().isoformat()
        }
        
        result = supabase.table("credits_usage").insert(usage_data).execute()
        
        if result.data:
            logger.info(f"💰 Recorded {credits_spent:.6f} credits for user {user_id[:8]}... ({service_type})")
            return True
        else:
            logger.error(f"❌ Failed to record usage: {result}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error recording usage: {e}")
        return False


async def get_user_credits(user_id: str) -> dict:
    """
    Get current credits balance for user
    """
    try:
        supabase = get_supabase()
        
        result = supabase.table("user_credits")\
            .select("*")\
            .eq("user_id", user_id)\
            .single()\
            .execute()
        
        if result.data:
            return {
                "total_credits": float(result.data.get("total_credits", 0)),
                "credits_used": float(result.data.get("credits_used", 0)),
                "credits_remaining": float(result.data.get("credits_remaining", 0))
            }
        else:
            # User has no credits record yet, return zeros
            return {
                "total_credits": 0,
                "credits_used": 0,
                "credits_remaining": 0
            }
            
    except Exception as e:
        logger.error(f"❌ Error getting user credits: {e}")
        return {
            "total_credits": 0,
            "credits_used": 0,
            "credits_remaining": 0
        }


async def ensure_user_credits_exist(user_id: str, initial_credits: float = 0.0):
    """
    Ensure user has a credits record (create if doesn't exist)
    """
    try:
        supabase = get_supabase()
        
        # Check if record exists
        existing = supabase.table("user_credits")\
            .select("user_id")\
            .eq("user_id", user_id)\
            .execute()
        
        if not existing.data or len(existing.data) == 0:
            # Create new record
            supabase.table("user_credits").insert({
                "user_id": user_id,
                "total_credits": initial_credits,
                "credits_used": 0.0,
                "credits_remaining": initial_credits
            }).execute()
            logger.info(f"✅ Created credits record for user {user_id[:8]}...")
            
    except Exception as e:
        logger.error(f"❌ Error ensuring credits record: {e}")
