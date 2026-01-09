from typing import List, Dict
import google.generativeai as genai
from main import ImageVariation, PostVariation
import httpx
import io
import base64
from PIL import Image


async def generate_images(
    website_data: Dict,
    variations: List[PostVariation],
    platforms: List[str],
    include_logo: bool
) -> List[ImageVariation]:
    """Generates images for posts using Gemini 2.5 Flash Image (Nano Banana)"""
    
    images = []
    
    # Determine required sizes
    sizes_needed = _get_required_sizes(platforms)
    
    # Take first post variation for image generation
    main_variation = variations[0] if variations else None
    
    # Create prompt for Nano Banana
    image_prompt = _build_image_prompt(website_data, main_variation)
    
    # Use Gemini 2.5 Flash Image for image generation (as requested)
    import logging
    logger = logging.getLogger(__name__)
    model_name = 'gemini-2.5-flash-image'
    logger.info(f"🔍 DEBUG: Using image model: {model_name}")
    model = genai.GenerativeModel(model_name)
    
    for size_info in sizes_needed:
        try:
            logger.info(f"🔍 DEBUG: Generating image for {size_info['name']}...")
            # Generate with Gemini 2.5 Flash Image
            response = model.generate_content(
                image_prompt,
                generation_config={
                    "temperature": 0.4,
                    "top_p": 0.95,
                }
            )
            
            logger.info(f"🔍 DEBUG: Response received, checking candidates...")
            logger.info(f"🔍 DEBUG: Has candidates: {response.candidates is not None}")
            
            # Extract image from response
            if response.candidates and len(response.candidates) > 0:
                logger.info(f"🔍 DEBUG: Number of candidates: {len(response.candidates)}")
                logger.info(f"🔍 DEBUG: Candidate parts: {len(response.candidates[0].content.parts)}")
                
                for i, part in enumerate(response.candidates[0].content.parts):
                    logger.info(f"🔍 DEBUG: Part {i}: has inline_data={hasattr(part, 'inline_data')}, has text={hasattr(part, 'text')}")
                    
                    # Check if it's text response instead of image
                    if hasattr(part, 'text') and part.text:
                        logger.warning(f"⚠️ DEBUG: Part {i} contains TEXT, not image: {part.text[:100]}")
                    
                    if hasattr(part, 'inline_data') and part.inline_data:
                        logger.info(f"🔍 DEBUG: Found inline_data! Data length: {len(part.inline_data.data) if part.inline_data.data else 0}")
                        logger.info(f"🔍 DEBUG: MIME type: {part.inline_data.mime_type if hasattr(part.inline_data, 'mime_type') else 'unknown'}")
                        
                        # Decode base64 image
                        image_data = base64.b64decode(part.inline_data.data)
                        logger.info(f"🔍 DEBUG: Decoded image data size: {len(image_data)} bytes")
                        
                        # Save temporarily or convert to URL (for now using data URL)
                        image_base64 = base64.b64encode(image_data).decode('utf-8')
                        image_url = f"data:image/png;base64,{image_base64}"
                        
                        logger.info(f"✅ DEBUG: Image generated! Base64 length: {len(image_base64)}, Full URL length: {len(image_url)}")
                        
                        # Sanity check - real image should be > 10KB
                        if len(image_data) < 10000:
                            logger.warning(f"⚠️ DEBUG: Image too small ({len(image_data)} bytes)! This might be a placeholder!")
                        
                        images.append(ImageVariation(
                            url=image_url,
                            size=size_info['name'],
                            dimensions=size_info['dimensions']
                        ))
                        break
                else:
                    logger.warning(f"⚠️ DEBUG: No inline_data found in any part!")
            else:
                logger.warning(f"⚠️ DEBUG: No candidates in response!")
            
        except Exception as e:
            logger.error(f"❌ Image generation error: {type(e).__name__}: {str(e)}")
            logger.exception("Full traceback:")
            # Fallback to placeholder
            images.append(ImageVariation(
                url=f"https://via.placeholder.com/{size_info['dimensions'].replace('x', 'x')}/1877f2/ffffff?text=Generated+Image",
                size=size_info['name'],
                dimensions=size_info['dimensions']
            ))
    
    return images if images else _get_placeholder_images(sizes_needed)


def _get_required_sizes(platforms: List[str]) -> List[Dict]:
    """Determines required image sizes"""
    
    sizes = []
    
    if "instagram" in platforms:
        sizes.append({
            "name": "instagram_square",
            "dimensions": "1024x1024",
            "aspect_ratio": "1:1"
        })
    
    if "facebook" in platforms:
        sizes.append({
            "name": "facebook_landscape",
            "dimensions": "1024x1024",  # Nano Banana outputs 1024x1024
            "aspect_ratio": "1:1"
        })
    
    # If nothing selected - add universal square
    if not sizes:
        sizes.append({
            "name": "universal_square",
            "dimensions": "1024x1024",
            "aspect_ratio": "1:1"
        })
    
    return sizes


def _build_image_prompt(website_data: Dict, variation: PostVariation) -> str:
    """Creates prompt for image generation"""
    
    brand_colors = website_data.get('colors', [])
    colors_str = f"using brand colors: {', '.join(brand_colors[:3])}" if brand_colors else ""
    
    title = website_data.get('title', '')
    description = website_data.get('description', '')
    industry = website_data.get('industry', 'business')
    
    prompt = f"""
Create a modern, professional social media post image for {title}.

Style: Clean, eye-catching, modern design with professional photography or illustration.
Industry: {industry}
{colors_str}

Content focus: {description[:200]}

The image should be:
- Visually striking and scroll-stopping
- Professional but engaging
- Suitable for social media
- No text overlays (will be added later)
- High quality, crisp and clear

Mood: Inspiring, trustworthy, modern
"""
    
    return prompt.strip()


def _get_placeholder_images(sizes_needed: List[Dict]) -> List[ImageVariation]:
    """Returns placeholder images if generation fails"""
    return [
        ImageVariation(
            url=f"https://via.placeholder.com/{size['dimensions']}/4285f4/ffffff?text=Social+Media+Post",
            size=size['name'],
            dimensions=size['dimensions']
        )
        for size in sizes_needed
    ]
