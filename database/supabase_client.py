"""
Supabase client initialization
"""
import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)

# Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Initialize Supabase client
supabase: Client = None

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("✅ Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Supabase client: {str(e)}")
        supabase = None
else:
    logger.warning("⚠️ Supabase credentials not found. Running without database.")
    supabase = None


def get_supabase() -> Client:
    """
    Get Supabase client instance
    """
    if supabase is None:
        raise Exception("Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_KEY.")
    return supabase
