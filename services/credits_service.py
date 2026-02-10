"""
API Usage Tracking Service
Tracks real API consumption metrics (tokens, characters, images, etc)
"""
import logging
from datetime import datetime
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)


async def record_usage(
    user_id: str,
    service_type: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    model_name: str = None,
    metadata: dict = None
) -> bool:
    """
    Record API usage with real metrics
    
    Args:
        user_id: User ID
        service_type: 'gemini_chat', 'elevenlabs', 'image_generation', etc
        input_tokens: Input tokens (Gemini) or characters (ElevenLabs) or images count
        output_tokens: Output tokens (Gemini)
        model_name: Model/API name
        metadata: Additional data
    """
    try:
        supabase = get_supabase()
        
        total_tokens = input_tokens + output_tokens
        
        usage_data = {
            "user_id": user_id,
            "service_type": service_type,
            "model_name": model_name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "credits_spent": 0.0,  # Not using credits, just tracking metrics
            "request_metadata": metadata or {}
        }
        
        logger.info(f"📝 About to insert: {usage_data}")
        logger.info(f"   input_tokens type: {type(input_tokens)}, value: {input_tokens}")
        logger.info(f"   output_tokens type: {type(output_tokens)}, value: {output_tokens}")
        logger.info(f"   total_tokens type: {type(total_tokens)}, value: {total_tokens}")
        
        result = supabase.table("credits_usage").insert(usage_data).execute()
        
        if result.data:
            logger.info(f"✅ INSERT successful. Returned data: {result.data[0]}")
            logger.info(f"📊 Recorded usage for user {user_id[:8]}... - {service_type}: {total_tokens} units")
            return True
        else:
            logger.error(f"❌ Failed to record usage: {result}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error recording usage: {e}")
        return False


async def get_user_usage_stats(user_id: str) -> dict:
    """
    Get usage statistics by platform for user
    """
    try:
        supabase = get_supabase()
        
        result = supabase.table("credits_usage")\
            .select("service_type, model_name, input_tokens, output_tokens, total_tokens")\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            return {}
        
        # Aggregate by service type
        stats = {}
        for record in result.data:
            service = record["service_type"]
            if service not in stats:
                stats[service] = {
                    "total_requests": 0,
                    "total_input": 0,
                    "total_output": 0,
                    "total_units": 0
                }
            
            stats[service]["total_requests"] += 1
            stats[service]["total_input"] += record.get("input_tokens", 0)
            stats[service]["total_output"] += record.get("output_tokens", 0)
            stats[service]["total_units"] += record.get("total_tokens", 0)
        
        return stats
            
    except Exception as e:
        logger.error(f"❌ Error getting usage stats: {e}")
        return {}


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
