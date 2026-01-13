"""
Supabase client initialization and helper functions
"""
import os
from supabase import create_client, Client
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Supabase client instance
_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client instance"""
    global _supabase_client
    
    if _supabase_client is None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            logger.error("❌ SUPABASE_URL or SUPABASE_KEY not found in environment!")
            raise ValueError("Supabase credentials not configured")
        
        logger.info(f"✅ Initializing Supabase client: {supabase_url}")
        _supabase_client = create_client(supabase_url, supabase_key)
    
    return _supabase_client

def verify_auth_token(token: str) -> Optional[dict]:
    """
    Verify JWT token from Supabase Auth
    Returns user data if valid, None if invalid
    """
    try:
        supabase = get_supabase_client()
        user = supabase.auth.get_user(token)
        return user.user.model_dump() if user else None
    except Exception as e:
        logger.warning(f"⚠️ Token verification failed: {str(e)}")
        return None

async def get_user_accounts(user_id: str) -> list:
    """Get all accounts for a user"""
    supabase = get_supabase_client()
    response = supabase.table("accounts").select("*").eq("user_id", user_id).execute()
    return response.data

async def get_account_by_id(account_id: str, user_id: str) -> Optional[dict]:
    """Get account by ID (with ownership check)"""
    supabase = get_supabase_client()
    response = supabase.table("accounts").select("*").eq("id", account_id).eq("user_id", user_id).single().execute()
    return response.data if response.data else None
