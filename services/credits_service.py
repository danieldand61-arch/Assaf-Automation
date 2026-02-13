"""
Unified Credits System
1 credit = $0.01 USD.  All API costs are converted to credits with a ~3x markup.

Pricing table (what the USER pays in credits):
  - Gemini text (per 1M tokens):  input 1.0 cr,  output 4.0 cr
  - Image generation:             15 cr per image
  - AI Chat message:              0.1 cr minimum (+ token cost)
  - Google Ads generation:        0.5 cr minimum (+ token cost)
  - Video dubbing (ElevenLabs):   100 cr per minute
  - Video generation (Kling 5s):  40 cr
  - Video generation (Kling 10s): 80 cr
  - Design analysis:              0.3 cr
"""
import logging
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# ─── Unified pricing (credits, not USD) ───────────────────────────────
# Gemini token pricing (credits per 1M tokens, ~3x real cost)
GEMINI_INPUT_PER_1M  = 1.0    # real cost ~$0.075 → charge $0.01 * 1.0
GEMINI_OUTPUT_PER_1M = 4.0    # real cost ~$0.30  → charge $0.01 * 4.0

# Fixed costs per action
FIXED_CREDITS = {
    "image_generation":     15.0,   # per image (~$0.04 cost → $0.15 charge)
    "video_dubbing_actual": None,   # calculated per minute: 100 cr/min
    "video_generation_5s":  40.0,   # Kling 5s video
    "video_generation_10s": 80.0,   # Kling 10s video
}

# Minimum credits per service (even if tokens are tiny)
MIN_CREDITS = {
    "social_posts":     0.2,
    "gemini_chat":      0.1,
    "chat":             0.1,
    "google_ads":       0.5,
    "image_generation": 15.0,
    "design_analysis":  0.3,
}


def calculate_credits(
    service_type: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    duration_minutes: float = 0,
    video_duration_sec: int = 0,
) -> float:
    """Calculate credits for any service type."""
    # Fixed-cost services
    if service_type in FIXED_CREDITS and FIXED_CREDITS[service_type] is not None:
        return FIXED_CREDITS[service_type]

    # Video dubbing — per minute
    if service_type in ("video_dubbing_actual", "video_dubbing"):
        return round(max(duration_minutes, 0.5) * 100.0, 2)

    # Video generation — by duration
    if service_type == "video_generation":
        if video_duration_sec >= 10:
            return 80.0
        return 40.0

    # Token-based services (Gemini)
    token_credits = round(
        (input_tokens / 1_000_000) * GEMINI_INPUT_PER_1M +
        (output_tokens / 1_000_000) * GEMINI_OUTPUT_PER_1M,
        4
    )
    minimum = MIN_CREDITS.get(service_type, 0.1)
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
