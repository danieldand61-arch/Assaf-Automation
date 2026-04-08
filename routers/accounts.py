"""
Business accounts management routes
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import logging
import asyncio
import re
from database.supabase_client import get_supabase
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["accounts"])
logger = logging.getLogger(__name__)


class AnalyzeUrlRequest(BaseModel):
    url: str
    free: bool = False


@router.post("/analyze-url")
async def analyze_url(request: AnalyzeUrlRequest, user=Depends(get_current_user)):
    """Scrape a website URL and return extracted Brand Kit data."""
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
    if not re.match(r'^https?://', url):
        url = f"https://{url}"

    try:
        from services.scraper import scrape_website
        logger.info(f"{'='*60}")
        logger.info(f"🔍 ANALYZE-URL START: {url}")
        logger.info(f"{'='*60}")

        bill_uid = None if request.free else user.get("user_id")
        data = await scrape_website(url, user_id=bill_uid)
        logger.info(f"── SCRAPE RESULTS ──")
        logger.info(f"  title: '{data.get('title', '')[:80]}'")
        logger.info(f"  description: '{data.get('description', '')[:120]}'")
        logger.info(f"  content length: {len(data.get('content', ''))} chars")
        logger.info(f"  logo_url: {'yes' if data.get('logo_url') else 'no'}")
        logger.info(f"  colors: {data.get('colors', [])}")
        logger.info(f"  brand_voice: {data.get('brand_voice', '')}")
        logger.info(f"  products (scraper): {data.get('products', [])[:3]}")
        logger.info(f"  industry hint: {data.get('industry', '')}")

        logger.info(f"── AI EXTRACTION (Gemini) ──")
        ai_info = await _ai_extract_business_info(data, user_id=bill_uid)
        logger.info(f"  AI business_name: {ai_info.get('business_name', '(empty)')}")
        logger.info(f"  AI industry: {ai_info.get('industry', '(empty)')}")
        logger.info(f"  AI description: {ai_info.get('description', '(empty)')[:100]}")
        logger.info(f"  AI products: {ai_info.get('products', [])[:4]}")
        logger.info(f"  AI key_features: {ai_info.get('key_features', [])[:3]}")

        brand_kit = {
            "business_name": ai_info.get("business_name") or _extract_business_name(data.get("title", ""), url),
            "description": ai_info.get("description") or data.get("description", ""),
            "industry": ai_info.get("industry") or _guess_industry(data.get("content", "") + " " + data.get("description", "")),
            "brand_voice": data.get("brand_voice", "professional"),
            "logo_url": data.get("logo_url", ""),
            "brand_colors": data.get("colors", []),
            "products": ai_info.get("products") or data.get("products", []),
            "key_features": ai_info.get("key_features") or data.get("key_features", []),
            "website_url": url,
            "content_preview": data.get("content", "")[:500],
        }

        logger.info(f"── FINAL BRAND KIT ──")
        logger.info(f"  business_name: {brand_kit['business_name']} (source: {'AI' if ai_info.get('business_name') else 'scraper fallback'})")
        logger.info(f"  industry: {brand_kit['industry']} (source: {'AI' if ai_info.get('industry') else 'keyword fallback'})")
        logger.info(f"  description: {brand_kit['description'][:100]} (source: {'AI' if ai_info.get('description') else 'scraper'})")
        logger.info(f"  products: {brand_kit['products'][:3]} (source: {'AI' if ai_info.get('products') else 'scraper'})")
        logger.info(f"  key_features: {brand_kit['key_features'][:3]} (source: {'AI' if ai_info.get('key_features') else 'scraper'})")
        logger.info(f"  brand_voice: {brand_kit['brand_voice']}")
        logger.info(f"  colors: {brand_kit['brand_colors']}")
        logger.info(f"  logo: {'yes' if brand_kit['logo_url'] else 'no'}")
        logger.info(f"{'='*60}")
        logger.info(f"✅ ANALYZE-URL COMPLETE: {url}")
        logger.info(f"{'='*60}")

        return {"brand_kit": brand_kit}
    except Exception as e:
        logger.error(f"❌ Failed to analyze URL {url}: {e}", exc_info=True)
        msg = _friendly_scrape_error(str(e), url)
        raise HTTPException(status_code=422, detail=msg)


def _friendly_scrape_error(error: str, url: str) -> str:
    err_lower = error.lower()
    if '429' in error or 'rate limit' in err_lower or 'too many' in err_lower:
        return "Too many requests to this platform. Please wait a minute and try again."
    if 'timeout' in err_lower or 'timed out' in err_lower:
        return "The website took too long to respond. Please check the URL and try again."
    if 'connect' in err_lower or 'dns' in err_lower or 'resolve' in err_lower:
        return "Could not connect to this website. Please check the URL is correct."
    if '403' in error or 'forbidden' in err_lower:
        return "This website blocked our analysis. You can fill in the details manually."
    if '404' in error or 'not found' in err_lower:
        return "Page not found. Please check the URL is correct."
    if 'too little content' in err_lower:
        return "This page doesn't have enough content to analyze. Try a different URL or fill in manually."
    if 'instagram' in err_lower or 'instagram.com' in url:
        return "Instagram is limiting requests right now. Please try again in a few minutes, or fill in your details manually."
    return "Could not analyze this website. Please check the URL or fill in the details manually."


async def _ai_extract_business_info(data: dict, user_id: str = None) -> dict:
    """Use Gemini to extract structured business info from scraped content."""
    try:
        import google.generativeai as genai
        import json as _json

        content = data.get("content", "")[:3000]
        title = data.get("title", "")
        desc = data.get("description", "")
        url = data.get("url", "")
        industry_hint = data.get("industry", "")

        logger.info(f"  AI input: title='{title[:50]}', desc='{desc[:80]}', content={len(content)} chars, industry_hint='{industry_hint}'")

        is_social = industry_hint.endswith("profile")
        social_instruction = ""
        if is_social:
            low_data = not desc or len(desc) < 30 or 'login' in desc.lower() or 'sign up' in desc.lower()
            logger.info(f"  Social profile mode: is_social=True, low_data={low_data}")
            social_instruction = f"""This is a social media profile URL: {url}
The bio/description below is from the profile. Use it to understand what this BUSINESS does — do NOT describe the social platform itself.
Extract the actual business behind this profile (their real products, services, industry).
If the bio says "Coffee shop in NYC" — the industry is "Coffee & Beverages", NOT "Social Media".
{"IMPORTANT: The scraped bio/description is very limited or missing. Use ALL available clues: the username/handle, any visual analysis text, Google search snippets, and your knowledge to infer the most likely business type. The content field may contain vision-based image analysis — use it. Make your best educated guess rather than saying 'Undetermined' or 'General Business'." if low_data else ""}\n"""

        prompt = f"""{social_instruction}Analyze this {"social media profile" if is_social else "website"} and return a JSON object with exactly these keys:
- "business_name": the company/brand name (string)
- "industry": the industry or niche (string, e.g. "Coffee & Beverages", "SaaS", "Fashion"). NEVER return "Undetermined" or "General Business" — always make your best guess.
- "description": one-sentence description of what the business does (string). NEVER say "could not determine" — infer from all available clues.
- "products": list of up to 8 main products or services they offer (array of short strings)
- "key_features": list of up to 6 key selling points or features (array of short strings)

URL: {url}
Profile/Website title: {title}
Bio/Description: {desc}
Page content (may include image analysis and Google search snippets):
{content}

Return ONLY valid JSON, no markdown fences."""

        model = genai.GenerativeModel("gemini-2.5-flash")
        resp = model.generate_content(prompt)
        text = resp.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        result = _json.loads(text)
        logger.info(f"🤖 AI extraction: name={result.get('business_name')}, products={result.get('products', [])[:3]}")
        if user_id:
            try:
                from services.credits_service import record_usage
                um = getattr(resp, 'usage_metadata', None)
                await record_usage(
                    user_id=user_id, service_type="design_analysis",
                    input_tokens=getattr(um, 'prompt_token_count', 0) if um else 0,
                    output_tokens=getattr(um, 'candidates_token_count', 0) if um else 0,
                    model_name="gemini-2.5-flash", metadata={"step": "url_analysis"},
                )
            except Exception:
                pass
        return result
    except Exception as e:
        logger.warning(f"⚠️ AI extraction failed, using fallback: {e}")
        return {}


def _extract_business_name(title: str, url: str) -> str:
    """Extract business name from title, fallback to domain if title is generic."""
    generic = {"home", "homepage", "welcome", "main", "index", "start", ""}
    name = title.split("|")[0].split("–")[0].split("-")[0].strip()
    if name.lower() in generic:
        from urllib.parse import urlparse
        domain = urlparse(url).hostname or ""
        domain = domain.replace("www.", "")
        name = domain.split(".")[0].capitalize() if domain else name
    return name

def _guess_industry(text: str) -> str:
    """Simple keyword-based industry detection."""
    text = text.lower()
    mapping = {
        "e-commerce": ["shop", "store", "buy", "cart", "product", "price", "shipping"],
        "SaaS": ["saas", "software", "platform", "api", "dashboard", "subscription", "cloud"],
        "Healthcare": ["health", "medical", "doctor", "patient", "clinic", "hospital", "wellness"],
        "Finance": ["finance", "banking", "invest", "loan", "credit", "insurance", "mortgage"],
        "Education": ["education", "learn", "course", "student", "university", "training", "school"],
        "Real Estate": ["real estate", "property", "apartment", "rent", "house", "mortgage"],
        "Restaurant & Food": ["restaurant", "food", "menu", "coffee", "recipe", "delivery", "dining", "café", "cafe", "starbucks", "drink", "beverage", "bakery"],
        "Technology": ["technology", "tech", "digital", "innovation", "ai", "machine learning"],
        "Marketing": ["marketing", "seo", "advertising", "campaign", "brand", "social media"],
        "Fitness": ["fitness", "gym", "workout", "exercise", "yoga", "training", "sport"],
    }
    best, best_score = "General Business", 0
    for industry, keywords in mapping.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best, best_score = industry, score
    return best

from collections import defaultdict

class CreateAccountRequest(BaseModel):
    name: str
    description: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    brand_voice: str = "professional"
    logo_url: Optional[str] = None
    brand_colors: List[str] = []
    metadata: Optional[dict] = None

class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    target_audience: Optional[str] = None
    brand_voice: Optional[str] = None
    logo_url: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    metadata: Optional[dict] = None
    default_language: Optional[str] = None
    default_include_emojis: Optional[bool] = None
    default_include_logo: Optional[bool] = None

@router.get("")
async def get_accounts(user = Depends(get_current_user)):
    """
    Get all accounts for current user
    """
    try:
        supabase = get_supabase()
        
        # Get accounts owned by user
        owned_accounts = supabase.table("accounts").select("*").eq("user_id", user["user_id"]).eq("is_active", True).execute()
        
        # Get accounts where user is a team member
        team_accounts = supabase.table("team_members").select("account_id, role, accounts(*)").eq("user_id", user["user_id"]).execute()
        
        accounts = owned_accounts.data
        
        # Add team accounts
        for team_member in team_accounts.data:
            if team_member.get("accounts"):
                account = team_member["accounts"]
                account["role"] = team_member["role"]  # Add user's role
                accounts.append(account)
        
        return {
            "accounts": accounts,
            "total": len(accounts)
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching accounts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{account_id}")
async def get_account(account_id: str, user = Depends(get_current_user)):
    """
    Get specific account details
    """
    try:
        supabase = get_supabase()
        
        response = supabase.table("accounts").select("*").eq("id", account_id).single().execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Verify user has access
        if response.data["user_id"] != user["user_id"]:
            # Check if user is team member
            team_check = supabase.table("team_members").select("role").eq("account_id", account_id).eq("user_id", user["user_id"]).execute()
            if not team_check.data:
                raise HTTPException(status_code=403, detail="Access denied")
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def create_account(request: CreateAccountRequest, user = Depends(get_current_user)):
    """
    Create a new business account.
    Includes retry logic for race condition where Supabase Auth returns JWT
    before auth.users row is committed to the database.
    
    postgrest-py APIError has .code, .message, .details attributes;
    str(e) returns empty string due to a bug in __init__, so we check attrs directly.
    """
    supabase = get_supabase()
    user_id = user["user_id"]

    # Ensure user exists in auth.users (refresh materialized row if needed)
    try:
        auth_user = supabase.auth.admin.get_user_by_id(user_id)
        if not auth_user or not getattr(auth_user, 'user', None):
            logger.error(f"❌ User {user_id} not found in Supabase Auth")
            raise HTTPException(
                status_code=404,
                detail="User not found. Please sign out and sign in again."
            )
        logger.info(f"✅ User {user_id} confirmed in Supabase Auth")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"⚠️ Auth admin check skipped: {e}")

    # Clean up orphaned user_settings that reference deleted accounts
    try:
        supabase.table("user_settings").upsert(
            {"user_id": user_id, "active_account_id": None},
            on_conflict="user_id"
        ).execute()
    except Exception:
        pass

    account_data = {
        "user_id": user_id,
        "name": request.name,
        "description": request.description,
        "industry": request.industry,
        "target_audience": request.target_audience,
        "brand_voice": request.brand_voice,
        "logo_url": request.logo_url,
        "brand_colors": request.brand_colors,
        "metadata": request.metadata or {}
    }

    max_retries = 15
    last_error = None
    for attempt in range(max_retries):
        try:
            response = supabase.table("accounts").insert(account_data).execute()

            logger.info(f"✅ Account created: {request.name} by {user['email']}")

            from services.credits_service import ensure_user_credits_exist
            await ensure_user_credits_exist(user_id, initial_credits=3000.0)

            return {"success": True, "account": response.data[0]}

        except Exception as e:
            last_error = e
            err_repr = repr(e).lower()
            is_fk = '23503' in err_repr or 'foreign key' in err_repr or 'is not present in table' in err_repr

            if is_fk and attempt < max_retries - 1:
                wait = min(1.0 + attempt * 0.5, 3.0)
                logger.warning(f"⏳ FK violation attempt {attempt + 1}/{max_retries}, retry in {wait}s")
                await asyncio.sleep(wait)
                continue

            logger.error(f"❌ Create account failed after {attempt + 1} attempts: {repr(e)}")
            break

    err_detail = getattr(last_error, 'message', '') or repr(last_error)
    raise HTTPException(status_code=500, detail=err_detail)


@router.patch("/{account_id}")
async def update_account(account_id: str, request: UpdateAccountRequest, user = Depends(get_current_user)):
    """
    Update account details
    """
    try:
        supabase = get_supabase()
        
        # Verify ownership
        account = supabase.table("accounts").select("user_id, metadata").eq("id", account_id).single().execute()
        if not account.data or account.data["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build update dict (only include provided fields)
        update_data = {k: v for k, v in request.dict().items() if v is not None}
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Merge metadata if provided (don't overwrite existing keys)
        if 'metadata' in update_data:
            existing_metadata = account.data.get('metadata', {}) or {}
            new_metadata = update_data['metadata'] or {}
            update_data['metadata'] = {**existing_metadata, **new_metadata}
        
        response = supabase.table("accounts").update(update_data).eq("id", account_id).execute()
        
        logger.info(f"✅ Account updated: {account_id}")
        
        return {
            "success": True,
            "account": response.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-user")
async def delete_user_account(user=Depends(get_current_user)):
    """Permanently delete user: accounts, connections, posts, credits, then auth user."""
    user_id = user["user_id"]
    logger.info(f"🗑️ Deleting user {user_id} ({user.get('email', '?')})")
    supabase = get_supabase()

    try:
        accs = supabase.table("accounts").select("id").eq("user_id", user_id).execute()
        acc_ids = [a["id"] for a in (accs.data or [])]

        for aid in acc_ids:
            supabase.table("account_connections").delete().eq("account_id", aid).execute()
            supabase.table("scheduled_posts").delete().eq("account_id", aid).execute()
            supabase.table("saved_posts").delete().eq("account_id", aid).execute()
            supabase.table("team_members").delete().eq("account_id", aid).execute()

        supabase.table("credits_usage").delete().eq("user_id", user_id).execute()
        supabase.table("user_credits").delete().eq("user_id", user_id).execute()
        supabase.table("user_settings").delete().eq("user_id", user_id).execute()
        supabase.table("accounts").delete().eq("user_id", user_id).execute()

        try:
            supabase.auth.admin.delete_user(user_id)
            logger.info(f"✅ Auth user {user_id} deleted")
        except Exception as e:
            logger.error(f"⚠️ Could not delete auth user (data already cleaned): {e}")

        logger.info(f"✅ User {user_id} fully deleted")
        return {"success": True, "message": "Account deleted permanently"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")


@router.delete("/{account_id}")
async def delete_account(account_id: str, user = Depends(get_current_user)):
    """
    Delete (deactivate) account
    """
    try:
        supabase = get_supabase()
        
        # Verify ownership
        account = supabase.table("accounts").select("user_id").eq("id", account_id).single().execute()
        if not account.data or account.data["user_id"] != user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Soft delete (set is_active = false)
        supabase.table("accounts").update({"is_active": False}).eq("id", account_id).execute()
        
        logger.info(f"🗑️ Account deleted: {account_id}")
        
        return {
            "success": True,
            "message": "Account deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{account_id}/switch")
async def switch_active_account(account_id: str, user = Depends(get_current_user)):
    """
    Switch active account for user
    """
    try:
        supabase = get_supabase()
        
        # Verify user has access to this account
        account_check = supabase.table("accounts").select("id").eq("id", account_id).eq("user_id", user["user_id"]).execute()
        
        if not account_check.data:
            # Check team membership
            team_check = supabase.table("team_members").select("account_id").eq("account_id", account_id).eq("user_id", user["user_id"]).execute()
            if not team_check.data:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Update user settings
        supabase.table("user_settings").update({
            "active_account_id": account_id
        }).eq("user_id", user["user_id"]).execute()
        
        logger.info(f"🔄 User {user['email']} switched to account {account_id}")
        
        return {
            "success": True,
            "active_account_id": account_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error switching account: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{account_id}/stats")
async def get_account_stats(account_id: str, user = Depends(get_current_user)):
    """
    Get statistics for a specific account
    """
    try:
        supabase = get_supabase()
        
        # Verify user has access to this account
        account_check = supabase.table("accounts").select("id").eq("id", account_id).eq("user_id", user["user_id"]).execute()
        
        if not account_check.data:
            # Check team membership
            team_check = supabase.table("team_members").select("account_id").eq("account_id", account_id).eq("user_id", user["user_id"]).execute()
            if not team_check.data:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Get usage statistics from credits_usage table
        usage_data = supabase.table("credits_usage").select("service_type").eq("account_id", account_id).execute()
        
        # Count by service type
        service_counts = defaultdict(int)
        for record in usage_data.data:
            service_counts[record['service_type']] += 1
        
        # Map service types to stats
        posts_created = service_counts.get('social_post', 0)
        images_generated = service_counts.get('image_generation', 0)
        videos_translated = service_counts.get('video_dubbing_actual', 0) + service_counts.get('video_dubbing', 0)
        total_requests = len(usage_data.data)
        
        return {
            "posts_created": posts_created,
            "images_generated": images_generated,
            "videos_translated": videos_translated,
            "total_requests": total_requests
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching account stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


