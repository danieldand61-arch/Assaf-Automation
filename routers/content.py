"""
Content generation and editing routes
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import logging

from middleware.auth import get_optional_user
from services.content_generator import generate_posts
from services.image_generator import generate_images
from services.scraper import scrape_website

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/content", tags=["content"])

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

@router.post("/regenerate-text")
async def regenerate_text(
    request: RegenerateTextRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Regenerate a single post variation
    """
    try:
        logger.info(f"♻️ Regenerating text variation {request.variation_index}")
        
        # Generate all 4 variations again
        variations = await generate_posts(
            website_data=request.website_data,
            keywords=request.keywords,
            platforms=request.platforms,
            style=request.style,
            target_audience=request.target_audience,
            language=request.language,
            include_emojis=request.include_emojis
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
async def regenerate_image(
    request: RegenerateImageRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Regenerate image for a post
    """
    try:
        logger.info(f"♻️ Regenerating image for platform: {request.platform}")
        
        from main import PostVariation
        
        # Create temporary variation object
        temp_variation = PostVariation(
            text=request.post_text,
            hashtags=[],
            char_count=len(request.post_text),
            engagement_score=0.7,
            call_to_action=""
        )
        
        # Generate new image
        images = await generate_images(
            website_data=request.website_data,
            variations=[temp_variation],
            platforms=[request.platform],
            image_size=request.image_size,
            include_logo=request.include_logo,
            custom_prompt=request.custom_prompt
        )
        
        return {
            "image": images[0] if images else None
        }
        
    except Exception as e:
        logger.error(f"❌ Error regenerating image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/edit-text")
async def edit_text(
    request: EditTextRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Edit existing text with AI assistance
    Actions: shorten, lengthen, add_emojis, remove_emojis, change_tone
    """
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
        
        # Add language instruction
        language_names = {"en": "English", "he": "Hebrew", "es": "Spanish", "pt": "Portuguese"}
        lang_name = language_names.get(request.language, "English")
        prompt = f"Respond in {lang_name}. {prompt}"
        
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        
        edited_text = response.text.strip()
        
        return {
            "original": request.text,
            "edited": edited_text,
            "action": request.action
        }
        
    except Exception as e:
        logger.error(f"❌ Error editing text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
