"""
Unified Credits System — 1 credit = $0.001 sale price.
All base costs are at ×1 (real API cost). MARGIN_MULTIPLIER scales everything.

Real API prices (2026-03):
  Gemini 3 Flash:           $0.50/1M input, $3.00/1M output
  Gemini 3.1 Flash Image:  $60/1M image output tokens → $0.067-$0.101/image (1K-2K)
  ElevenLabs dub:           $0.24/min
  Kling AI video:           $0.049/sec (no audio), $0.098/sec (with audio)

Formula: credits = real_cost × MARGIN_MULTIPLIER / $0.001

Packages: 10K cr = $10, 50K cr = $45, 200K cr = $160
"""
import logging
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# ─── MARGIN MULTIPLIER ───────────────────────────────────────────────
# 1.0 = break-even (we earn nothing)
# 1.5 = 50% margin
# 2.0 = 100% margin (standard SaaS)
MARGIN_MULTIPLIER = 2.0

# ─── Base costs at ×1 (real API price in credits, 1 cr = $0.001) ─────
# Gemini 3 Flash: $0.50/1M input = $0.0005/1K = 0.5 cr/1K
# Gemini 3 Flash: $3.00/1M output = $0.003/1K = 3 cr/1K
_BASE_PER_1K_INPUT  = 0.5
_BASE_PER_1K_OUTPUT = 3.0
CREDITS_PER_1K_INPUT  = _BASE_PER_1K_INPUT * MARGIN_MULTIPLIER
CREDITS_PER_1K_OUTPUT = _BASE_PER_1K_OUTPUT * MARGIN_MULTIPLIER

# Fixed credits per operation (base = real cost in credits)
_BASE_FIXED = {
    "image_generation": 101.0,    # Gemini 3.1 Flash Image worst-case 2K: $0.101 = 101 cr
}
FIXED_CREDITS = {k: round(v * MARGIN_MULTIPLIER) for k, v in _BASE_FIXED.items()}

# Per-minute rate for video dubbing (ElevenLabs): $0.24/min = 240 cr base
_BASE_DUBBING_PER_MIN = 240.0
VIDEO_DUBBING_PER_MIN = round(_BASE_DUBBING_PER_MIN * MARGIN_MULTIPLIER)

# Kling AI video generation (base = real cost in credits)
_BASE_VIDEO_GEN = {
    "5s_no_audio":  250,   # $0.25
    "10s_no_audio": 490,   # $0.49
    "5s_audio":     490,   # $0.49
    "10s_audio":    980,   # $0.98
}
VIDEO_GEN_CREDITS = {k: round(v * MARGIN_MULTIPLIER) for k, v in _BASE_VIDEO_GEN.items()}

# Minimum credits per service type (base values, then multiplied)
_BASE_MIN = {
    "social_posts":     12.0,   # ~$0.012
    "gemini_chat":       5.0,   # ~$0.005
    "chat":              5.0,
    "google_ads":       19.0,   # ~$0.019
    "image_generation": 101.0,
    "design_analysis":   5.0,
    "text_edit":         5.0,
    "text_regen":        5.0,
}
MIN_CREDITS = {k: round(v * MARGIN_MULTIPLIER) for k, v in _BASE_MIN.items()}


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


async def ensure_user_credits_exist(user_id: str, initial_credits: float = 3000.0):
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
                "total_credits_purchased": initial_credits,
                "credits_used": 0.0,
                "credits_remaining": initial_credits
            }).execute()
            logger.info(f"✅ Created credits record for user {user_id[:8]}...")
            
    except Exception as e:
        logger.error(f"❌ Error ensuring credits record: {e}")
