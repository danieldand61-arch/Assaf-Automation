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
        return await _get(auth)
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

class MagicPromptRequest(BaseModel):
    user_prompt: str = ""
    goal: str = ""  # product, lifestyle, abstract, announcement
    strategy: str = "professional"  # professional, casual, bold, minimal
    brand_name: str = ""
    industry: str = ""
    brand_colors: List[str] = []
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

@router.post("/magic-prompt")
async def magic_prompt(request: MagicPromptRequest, req: Request = None):
    """Enhance a simple user prompt into a rich, visual-ready prompt using goal + strategy."""
    user = await get_optional_user(req) if req else None
    await _require_credits(user, 5.0)

    GOAL_MAP = {
        "product": "Hero product showcase — the product is the star. Studio-grade lighting, precise detail, premium commercial feel.",
        "lifestyle": "Lifestyle story — show the product/brand in a real-world aspirational context. People using, enjoying, living with it.",
        "abstract": "Conceptual / mood-driven — evoke a feeling or aesthetic. Abstract textures, colors, atmosphere over literal representation.",
        "announcement": "Big announcement — bold, attention-grabbing visual that signals something new, exciting, or important.",
    }
    STRATEGY_MAP = {
        "professional": {"env": "clean studio or corporate-quality setting", "light": "sharp, controlled lighting with soft shadows", "camera": "medium telephoto lens, shallow depth of field, polished commercial look", "vibe": "High-End Studio"},
        "casual": {"env": "warm, natural everyday environment, café, park, home", "light": "golden hour or soft window light, warm tones", "camera": "35mm lens, lifestyle editorial, slightly candid feel", "vibe": "Lifestyle Warmth"},
        "bold": {"env": "high contrast, dramatic environment, vivid colors, dynamic angles", "light": "hard directional light, deep shadows, neon or saturated hues", "camera": "wide-angle, dramatic perspective, cinematic punch", "vibe": "Bold Impact"},
        "minimal": {"env": "clean negative space, monochrome or muted palette, simple forms", "light": "even, diffused, soft studio or overcast natural light", "camera": "centered composition, geometric precision, Scandinavian aesthetic", "vibe": "Clean Minimalism"},
    }
    ANTI_GENERIC = [
        "Avoid cliché setups: no generic wood table, no plain white desk, no stock-photo handshake.",
        "Every element in the frame must feel intentional and premium.",
        "The image should look like a real campaign shoot, not a template.",
    ]

    goal_desc = GOAL_MAP.get(request.goal, GOAL_MAP["product"])
    strat = STRATEGY_MAP.get(request.strategy, STRATEGY_MAP["professional"])
    lang_names = {"en": "English", "he": "Hebrew", "es": "Spanish", "fr": "French"}
    lang = lang_names.get(request.language, "English")
    brand_ctx = f'Brand: "{request.brand_name}".' if request.brand_name else ""
    industry_ctx = f"Industry: {request.industry}." if request.industry else ""
    color_ctx = f"Subtly weave brand colors ({', '.join(request.brand_colors[:3])}) into props, backgrounds, or accents." if request.brand_colors else ""

    system = f"""You are an elite advertising prompt engineer. Your job is to transform a simple idea into a rich, specific, visual-ready prompt for an AI image generator.

RULES:
- Output ONLY the enhanced prompt text. No labels, no explanations.
- Write in {lang}.
- The prompt must describe a SINGLE cohesive image (no collages).
- Include specific details: subject, environment, lighting, camera style, mood.
- NEVER mention text, typography, logos, or watermarks — the image must be purely visual.
- {chr(10).join(ANTI_GENERIC)}
{brand_ctx} {industry_ctx} {color_ctx}

GOAL: {goal_desc}
ENVIRONMENT: {strat['env']}
LIGHTING: {strat['light']}
CAMERA: {strat['camera']}"""

    user_input = request.user_prompt.strip() or "a promotional image for the brand"

    try:
        import google.generativeai as genai
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(
            [{"role": "user", "parts": [f"{system}\n\nUser idea: {user_input}"]}],
            generation_config=genai.GenerationConfig(temperature=0.9, max_output_tokens=8192),
        )
        enhanced = response.text.strip().strip('"').strip("'")

        if user:
            try:
                from services.credits_service import record_usage
                in_t = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                out_t = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                await record_usage(user_id=user["user_id"], service_type="social_posts", input_tokens=in_t, output_tokens=out_t, model_name="gemini-2.5-flash", metadata={"action": "magic_prompt"})
            except Exception:
                pass

        return {"enhanced_prompt": enhanced, "vibe": strat["vibe"], "goal": request.goal, "strategy": request.strategy}
    except Exception as e:
        logger.error(f"Magic prompt error: {e}")
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
