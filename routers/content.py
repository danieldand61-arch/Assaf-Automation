"""
Content generation and editing routes
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import logging

from models import PostVariation
from services.content_generator import generate_posts
from services.image_generator import generate_images
from services.google_ads_generator import generate_google_ads
from services.scraper import scrape_website
from services.credits_service import check_balance
from middleware.auth import get_current_user

logger = logging.getLogger(__name__)


async def _require_credits(user: Optional[dict], min_credits: float):
    if user:
        bal = await check_balance(user["user_id"], min_credits)
        if not bal["ok"]:
            raise HTTPException(status_code=402, detail=f"Not enough credits. You have {bal['remaining']:.0f}, need at least {bal['needed']:.0f}.")

router = APIRouter(prefix="/api/content", tags=["content"])


async def get_optional_user(request: Request) -> Optional[dict]:
    """Try to extract user from token; return None if not authenticated."""
    try:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        from middleware.auth import get_current_user as _get
        return await _get(request)
    except Exception:
        return None

class RegenerateTextRequest(BaseModel):
    website_data: dict
    keywords: str
    platforms: List[str]
    style: str
    target_audience: str
    language: str = "en"
    include_emojis: bool = True
    variation_index: int  # Which variation to regenerate (0-3)

class RegenerateImageRequest(BaseModel):
    website_data: dict
    post_text: str
    platform: str
    image_size: str = "1080x1080"
    include_logo: bool = False
    custom_prompt: Optional[str] = None

class EditTextRequest(BaseModel):
    text: str
    action: str  # "shorten", "lengthen", "add_emojis", "remove_emojis", "change_tone"
    tone: Optional[str] = None  # for "change_tone" action
    language: str = "en"

class GenerateGoogleAdsRequest(BaseModel):
    website_data: dict
    keywords: str
    target_location: Optional[str] = ""
    language: str = "en"

@router.post("/regenerate-text")
async def regenerate_text(request: RegenerateTextRequest, req: Request = None):
    """
    Regenerate a single post variation
    """
    user = await get_optional_user(req) if req else None
    user_id = user["user_id"] if user else None
    await _require_credits(user, 10.0)
    try:
        logger.info(f"♻️ Regenerating text variation {request.variation_index}")
        
        variations = await generate_posts(
            website_data=request.website_data,
            keywords=request.keywords,
            platforms=request.platforms,
            style=request.style,
            target_audience=request.target_audience,
            language=request.language,
            include_emojis=request.include_emojis,
            user_id=user_id
        )
        
        # Return the requested variation (or fallback to first)
        idx = min(request.variation_index, len(variations) - 1)
        
        return {
            "variation": variations[idx],
            "all_variations": variations  # Return all in case user wants to pick different one
        }
        
    except Exception as e:
        logger.error(f"❌ Error regenerating text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/regenerate-image")
async def regenerate_image(request: RegenerateImageRequest, req: Request = None):
    """
    Regenerate image for a post
    """
    user = await get_optional_user(req) if req else None
    user_id = user["user_id"] if user else None
    await _require_credits(user, 80.0)
    try:
        logger.info(f"♻️ Regenerating image for platform: {request.platform}")
        
        from main import PostVariation as PV
        
        temp_variation = PV(
            text=request.post_text,
            hashtags=[],
            char_count=len(request.post_text),
            engagement_score=0.7,
            call_to_action=""
        )
        
        images = await generate_images(
            website_data=request.website_data,
            variations=[temp_variation],
            platforms=[request.platform],
            image_size=request.image_size,
            include_logo=request.include_logo,
            custom_prompt=request.custom_prompt,
            user_id=user_id
        )
        
        return {
            "image": images[0] if images else None
        }
        
    except Exception as e:
        logger.error(f"❌ Error regenerating image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/edit-text")
async def edit_text(request: EditTextRequest, req: Request = None):
    """
    Edit existing text with AI assistance
    Actions: shorten, lengthen, add_emojis, remove_emojis, change_tone
    """
    user = await get_optional_user(req) if req else None
    await _require_credits(user, 10.0)
    try:
        import google.generativeai as genai
        
        action_prompts = {
            "shorten": f"Shorten this text to be more concise while keeping the main message:\n\n{request.text}",
            "lengthen": f"Expand this text with more details and engagement:\n\n{request.text}",
            "add_emojis": f"Add relevant emojis to this text for more emotional impact:\n\n{request.text}",
            "remove_emojis": f"Remove all emojis from this text:\n\n{request.text}",
            "change_tone": f"Rewrite this text in a {request.tone} tone:\n\n{request.text}"
        }
        
        prompt = action_prompts.get(request.action, action_prompts["shorten"])
        
        language_names = {"en": "English", "he": "Hebrew", "es": "Spanish", "pt": "Portuguese"}
        lang_name = language_names.get(request.language, "English")
        prompt = f"Respond in {lang_name}. {prompt}"
        
        model = genai.GenerativeModel('gemini-3-flash-preview')
        response = model.generate_content(prompt)
        
        edited_text = response.text.strip()
        edited_text = edited_text.replace('**', '').replace('__', '').replace('~~', '')
        
        # Track usage
        if user:
            try:
                from services.credits_service import record_usage
                in_t = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                out_t = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                await record_usage(
                    user_id=user["user_id"],
                    service_type="social_posts",
                    input_tokens=in_t,
                    output_tokens=out_t,
                    model_name="gemini-3-flash-preview",
                    metadata={"action": request.action}
                )
            except Exception as te:
                logger.error(f"Failed to track edit-text usage: {te}")
        
        return {
            "original": request.text,
            "edited": edited_text,
            "action": request.action
        }
        
    except Exception as e:
        logger.error(f"Error editing text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-google-ads")
async def generate_google_ads_endpoint(request: GenerateGoogleAdsRequest, req: Request = None):
    """
    Generate complete Google Ads RSA package
    """
    user = await get_optional_user(req) if req else None
    user_id = user["user_id"] if user else None
    await _require_credits(user, 40.0)
    try:
        ads_package = await generate_google_ads(
            website_data=request.website_data,
            keywords=request.keywords,
            target_location=request.target_location,
            language=request.language,
            user_id=user_id
        )
        
        logger.info(f"✅ Generated {len(ads_package.get('headlines', []))} headlines")
        logger.info(f"✅ Generated {len(ads_package.get('descriptions', []))} descriptions")
        logger.info("🎯 ===== GOOGLE ADS GENERATION SUCCESS =====")
        
        return {
            "success": True,
            "ads_package": ads_package
        }
        
    except Exception as e:
        logger.error(f"❌ ===== GOOGLE ADS GENERATION FAILED =====")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Error message: {str(e)}")
        logger.exception("❌ Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))
