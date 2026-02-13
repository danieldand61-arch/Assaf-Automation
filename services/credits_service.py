"""
Unified Credits System — proportional pricing, ×2 markup.

Base unit: 1 credit = cost of 1K Gemini Flash input tokens × 2.
Real cost of 1K Gemini input tokens = $0.000075.
1 credit ≈ $0.00015 to us.

  Service                 | Real cost       | ÷ base | ×2  | Credits
  Chat message (~3K tok)  | ~$0.00045       |  6     | 12  | → 1 cr (min)
  Social Post gen         | ~$0.001         | 13     | 26  | → 2 cr (min)
  Text edit / regen       | ~$0.0005        |  7     | 14  | → 1 cr (min)
  Google Ads gen          | ~$0.002         | 27     | 54  | → 2 cr (min)
  1 Image (Gemini)        | ~$0.04          | 533    | 1066| → 7 cr
  Video dubbing / min     | ~$0.24          | 3200   | 6400| → 100 cr/min
  Design analysis         | ~$0.001         | 13     | 26  | → 1 cr
"""
import logging
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# ─── Proportional pricing (×2 markup) ─────────────────────────────────
# Real: $0.075/1M input = $0.000075/1K.  ×2 → 0.15 cr/1K
# Real: $0.30/1M output = $0.0003/1K.    ×2 → 0.6 cr/1K
CREDITS_PER_1K_INPUT  = 0.15
CREDITS_PER_1K_OUTPUT = 0.6

# Fixed credits per operation (×2 markup)
FIXED_CREDITS = {
    "image_generation": 7.0,      # ~$0.04 real → 533× base → ×2 ÷ 150 ≈ 7
}

# Per-minute rate for video dubbing
VIDEO_DUBBING_PER_MIN = 100.0     # ~$0.24/min real → 3200× base → ×2 ÷ 64 ≈ 100

# Minimum credits per service type
MIN_CREDITS = {
    "social_posts":     2.0,
    "gemini_chat":      1.0,
    "chat":             1.0,
    "google_ads":       2.0,
    "image_generation": 7.0,
    "design_analysis":  1.0,
}


def calculate_credits(
    service_type: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    duration_minutes: float = 0,
    video_duration_sec: int = 0,
) -> float:
    """Calculate credits for any service type using proportional pricing."""
    # Fixed-cost services
    if service_type in FIXED_CREDITS:
        return FIXED_CREDITS[service_type]

    # Video dubbing — per minute (min 0.5 min)
    if service_type in ("video_dubbing_actual", "video_dubbing"):
        return round(max(duration_minutes, 0.5) * VIDEO_DUBBING_PER_MIN, 2)

    # Video generation — not available yet, placeholder ×2
    if service_type == "video_generation":
        return 35.0 if video_duration_sec < 10 else 70.0

    # Token-based services (Gemini)
    token_credits = round(
        (input_tokens / 1000) * CREDITS_PER_1K_INPUT +
        (output_tokens / 1000) * CREDITS_PER_1K_OUTPUT,
        4
    )
    minimum = MIN_CREDITS.get(service_type, 1.0)
    return round(max(token_credits, minimum), 4)


async def record_usage(
    user_id: str,
    service_type: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = None,
    model_name: str = None,
    metadata: dict = None,
    duration_minutes: float = 0,
    video_duration_sec: int = 0,
) -> bool:
    """Record API usage and deduct credits."""
    try:
        supabase = get_supabase()

        if total_tokens is None:
            total_tokens = input_tokens + output_tokens

        credits_spent = calculate_credits(
            service_type=service_type,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            duration_minutes=duration_minutes,
            video_duration_sec=video_duration_sec,
        )

        usage_data = {
            "user_id": user_id,
            "service_type": service_type,
            "model_name": model_name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "credits_spent": credits_spent,
            "request_metadata": metadata or {},
        }

        result = supabase.table("credits_usage").insert(usage_data).execute()

        if result.data:
            logger.info(
                f"💰 {service_type}: {credits_spent} credits "
                f"(in={input_tokens}, out={output_tokens}) user={user_id[:8]}"
            )
            return True

        logger.error(f"Failed to record usage: {result}")
        return False

    except Exception as e:
        logger.error(f"Error recording usage: {e}")
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
