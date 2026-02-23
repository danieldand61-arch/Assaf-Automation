"""
Unified Credits System — ×2 markup, 1 credit = $0.001 sale price.

Real API prices (2026):
  Gemini 3 Flash: $0.50/1M input, $3.00/1M output
  Gemini image:   ~$0.039/image
  ElevenLabs dub: $0.24/min
  Kling AI video: $0.049/sec (no audio), $0.098/sec (with audio)

Formula: credits = real_cost × 2 / $0.001 = real_cost × 2000

  Service                 | Real cost  | ×2 markup  | Credits
  1K input tokens         | $0.0005    | $0.001     | 1 cr
  1K output tokens        | $0.003     | $0.006     | 6 cr
  Chat (~3K in + 1K out)  | $0.0045    | $0.009     | 10 cr (min)
  Social Post gen         | $0.012     | $0.024     | 25 cr (min)
  Text edit / regen       | $0.005     | $0.010     | 10 cr (min)
  Google Ads gen          | $0.019     | $0.038     | 40 cr (min)
  1 Image (Gemini 2.5)    | $0.039     | $0.078     | 80 cr
  Design analysis         | $0.005     | $0.010     | 10 cr (min)
  Video dubbing / min     | $0.24      | $0.48      | 500 cr/min
  Kling 5s video          | $0.25      | $0.50      | 500 cr
  Kling 10s video         | $0.49      | $0.98      | 1000 cr

Packages: 10K cr = $10, 50K cr = $45, 200K cr = $160
"""
import logging
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# ─── Proportional pricing (×2 markup, 1 cr = $0.001) ──────────────────
# Gemini 3 Flash: $0.50/1M input = $0.0005/1K → ×2 = $0.001/1K = 1 cr/1K
# Gemini 3 Flash: $3.00/1M output = $0.003/1K → ×2 = $0.006/1K = 6 cr/1K
CREDITS_PER_1K_INPUT  = 1.0
CREDITS_PER_1K_OUTPUT = 6.0

# Fixed credits per operation
FIXED_CREDITS = {
    "image_generation": 80.0,     # $0.039 real → ×2000 = 78 → round 80
}

# Per-minute rate for video dubbing (ElevenLabs)
VIDEO_DUBBING_PER_MIN = 500.0     # $0.24/min real → ×2000 = 480 → round 500

# Kling AI video generation
VIDEO_GEN_CREDITS = {
    "5s_no_audio":  500,   # $0.25 → ×2000 = 500
    "10s_no_audio": 1000,  # $0.49 → ×2000 = 980 → round 1000
    "5s_audio":     1000,  # $0.49 → ×2000 = 980 → round 1000
    "10s_audio":    2000,  # $0.98 → ×2000 = 1960 → round 2000
}

# Minimum credits per service type (floor)
MIN_CREDITS = {
    "social_posts":     25.0,
    "gemini_chat":      10.0,
    "chat":             10.0,
    "google_ads":       40.0,
    "image_generation": 80.0,
    "design_analysis":  10.0,
    "text_edit":        10.0,
    "text_regen":       10.0,
}


def calculate_credits(
    service_type: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    duration_minutes: float = 0,
    video_duration_sec: int = 0,
) -> float:
    """Calculate credits using ×2 markup. 1 credit = $0.001 sale price."""
    # Fixed-cost services
    if service_type in FIXED_CREDITS:
        return FIXED_CREDITS[service_type]

    # Video dubbing — per minute (min 0.5 min)
    if service_type in ("video_dubbing_actual", "video_dubbing"):
        return round(max(duration_minutes, 0.5) * VIDEO_DUBBING_PER_MIN, 2)

    # Video generation (Kling AI)
    if service_type == "video_generation":
        if video_duration_sec <= 5:
            return float(VIDEO_GEN_CREDITS["5s_no_audio"])
        return float(VIDEO_GEN_CREDITS["10s_no_audio"])

    # Token-based services (Gemini 3 Flash)
    token_credits = round(
        (input_tokens / 1000) * CREDITS_PER_1K_INPUT +
        (output_tokens / 1000) * CREDITS_PER_1K_OUTPUT,
        2
    )
    minimum = MIN_CREDITS.get(service_type, 10.0)
    return round(max(token_credits, minimum), 2)


async def check_balance(user_id: str, min_credits: float = 10.0) -> dict:
    """Check if user has enough credits. Returns {ok, remaining, needed}."""
    try:
        supabase = get_supabase()
        res = supabase.table("user_credits").select("credits_remaining").eq("user_id", user_id).limit(1).execute()
        remaining = float(res.data[0]["credits_remaining"]) if res.data else 0.0
        return {"ok": remaining >= min_credits, "remaining": remaining, "needed": min_credits}
    except Exception as e:
        logger.warning(f"⚠️ Balance check failed (allowing): {e}")
        return {"ok": True, "remaining": 0, "needed": min_credits}


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
