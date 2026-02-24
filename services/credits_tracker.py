"""
Credits tracking system for AI usage
Tracks all AI requests and calculates costs
"""
import logging
from typing import Optional, Dict
from database.supabase_client import get_supabase
from datetime import datetime

logger = logging.getLogger(__name__)

# Credits per 1M tokens (×2 markup, 1 cr = $0.001).
# Gemini 3 Flash: $0.50/1M in → ×2 = 1000 cr/1M; $3.00/1M out → ×2 = 6000 cr/1M
# New records should use credits_service.calculate_credits instead.
MODEL_PRICING = {
    "gemini-3-flash-preview": {"input": 1000.0, "output": 6000.0},
    "gemini-2.5-flash-image": {"image": 80.0},
    "gemini-2.0-flash-exp":   {"input": 1000.0, "output": 6000.0},
    "gemini-1.5-flash":       {"input": 1000.0, "output": 6000.0},
    "gemini-1.5-pro":         {"input": 2500.0, "output": 20000.0},
}

class CreditsTracker:
    """Track AI usage and calculate costs"""
    
    def __init__(self, user_id: str, account_id: Optional[str] = None):
        self.user_id = user_id
        self.account_id = account_id
        self.supabase = get_supabase()
    
    async def track_usage(
        self,
        service_type: str,
        model_name: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        action: Optional[str] = None,
        metadata: Optional[Dict] = None,
        error_message: Optional[str] = None
    ) -> Dict:
        """
        Track AI usage and calculate cost
        
        Args:
            service_type: 'chat', 'google_ads', 'social_posts', 'image_generation'
            model_name: Name of AI model used
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            action: Specific action performed
            metadata: Additional metadata
            error_message: Error if request failed
        
        Returns:
            Dict with credits spent and usage ID
        """
        try:
            # Calculate cost
            total_tokens = input_tokens + output_tokens
            credits_spent = self._calculate_cost(model_name, input_tokens, output_tokens)
            
            # Get cost per token for logging
            pricing = MODEL_PRICING.get(model_name, {})
            avg_cost_per_token = credits_spent / total_tokens if total_tokens > 0 else 0
            
            # Log usage
            usage_record = {
                "user_id": self.user_id,
                "account_id": self.account_id,
                "service_type": service_type,
                "action": action,
                "model_name": model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cost_per_token": avg_cost_per_token,
                "credits_spent": credits_spent,
                "request_metadata": metadata or {},
                "error_message": error_message
            }
            
            result = self.supabase.table("credits_usage").insert(usage_record).execute()
            
            logger.info(
                f"💰 Credits tracked: user={self.user_id[:8]}, "
                f"service={service_type}, model={model_name}, "
                f"tokens={total_tokens}, cost={credits_spent:.4f} credits"
            )
            
            return {
                "success": True,
                "credits_spent": credits_spent,
                "usage_id": result.data[0]["id"] if result.data else None,
                "total_tokens": total_tokens
            }
            
        except Exception as e:
            logger.error(f"Failed to track credits usage: {e}")
            logger.exception("Full error:")
            return {
                "success": False,
                "error": str(e),
                "credits_spent": 0
            }
    
    def _calculate_cost(self, model_name: str, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost in credits based on model and tokens"""
        pricing = MODEL_PRICING.get(model_name)
        
        if not pricing:
            logger.warning(f"No pricing found for model: {model_name}, using default")
            pricing = {"input": 1000.0, "output": 6000.0}
        
        # Fixed-cost models (image generation, etc.)
        if "image" in pricing:
            return pricing["image"]
        
        # Calculate token-based cost
        input_cost = (input_tokens / 1_000_000) * pricing.get("input", 0)
        output_cost = (output_tokens / 1_000_000) * pricing.get("output", 0)
        
        total_cost = input_cost + output_cost
        
        return round(total_cost, 6)
    
    async def get_user_balance(self) -> Dict:
        """Get user's current credits balance, auto-creating record if missing"""
        try:
            result = self.supabase.table("user_credits")\
                .select("*")\
                .eq("user_id", self.user_id)\
                .limit(1)\
                .execute()
            
            if result.data:
                row = result.data[0]
                return {
                    "total_purchased": float(row.get("total_credits_purchased", 0)),
                    "used": float(row.get("credits_used", 0)),
                    "remaining": float(row.get("credits_remaining", 0))
                }
            
            from services.credits_service import ensure_user_credits_exist
            await ensure_user_credits_exist(self.user_id, initial_credits=500.0)
            return {"total_purchased": 500.0, "used": 0, "remaining": 500.0}
                
        except Exception as e:
            logger.error(f"Failed to get user balance: {e}")
            return {
                "error": str(e),
                "total_purchased": 0,
                "used": 0,
                "remaining": 0
            }
    
    async def get_usage_stats(self, days: int = 30) -> Dict:
        """Get usage statistics for the user"""
        try:
            from datetime import timedelta
            since = (datetime.utcnow() - timedelta(days=days)).isoformat()

            # Get usage for last N days
            result = self.supabase.table("credits_usage")\
                .select("service_type, credits_spent, created_at")\
                .eq("user_id", self.user_id)\
                .gte("created_at", since)\
                .execute()
            
            if not result.data:
                return {
                    "total_spent": 0,
                    "by_service": {},
                    "total_requests": 0
                }
            
            # Aggregate by service type
            by_service = {}
            total_spent = 0
            
            for record in result.data:
                service = record["service_type"]
                cost = float(record["credits_spent"])
                
                if service not in by_service:
                    by_service[service] = {"count": 0, "cost": 0}
                
                by_service[service]["count"] += 1
                by_service[service]["cost"] += cost
                total_spent += cost
            
            return {
                "total_spent": round(total_spent, 4),
                "by_service": by_service,
                "total_requests": len(result.data),
                "period_days": days
            }
            
        except Exception as e:
            logger.error(f"Failed to get usage stats: {e}")
            return {
                "error": str(e),
                "total_spent": 0,
                "by_service": {},
                "total_requests": 0
            }


# Helper function for easy tracking
async def track_ai_usage(
    user_id: str,
    service_type: str,
    model_name: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    account_id: Optional[str] = None,
    action: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> Dict:
    """
    Quick helper to track AI usage
    
    Example:
        await track_ai_usage(
            user_id="123",
            service_type="chat",
            model_name="gemini-3-flash-preview",
            input_tokens=1500,
            output_tokens=500,
            action="chat_message"
        )
    """
    tracker = CreditsTracker(user_id, account_id)
    return await tracker.track_usage(
        service_type=service_type,
        model_name=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        action=action,
        metadata=metadata
    )
