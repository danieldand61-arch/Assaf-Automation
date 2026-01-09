from typing import List, Dict
from google import genai  # NEW SDK for image generation
from main import ImageVariation, PostVariation
import httpx
import io
import base64
from PIL import Image
import os


async def generate_images(
    website_data: Dict,
    variations: List[PostVariation],
    platforms: List[str],
    image_size: str = "1080x1080",
    include_logo: bool = False
) -> List[ImageVariation]:
    """Generates images for posts using Gemini 2.5 Flash Image (Nano Banana)"""
    
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"🔍 DEBUG: Generating image with size: {image_size}")
    
    images = []
    
    # Use user-selected size instead of platform-based
    sizes_needed = [{
        "name": f"custom_{image_size}",
        "dimensions": image_size,
        "aspect_ratio": _get_aspect_ratio(image_size)
    }]
    
    # Take first post variation for image generation
    main_variation = variations[0] if variations else None
    
    # Create prompt for Nano Banana
    image_prompt = _build_image_prompt(website_data, main_variation)
    
    # Use Gemini 2.5 Flash Image with NEW SDK (Nano Banana 🍌)
    model_name = 'gemini-2.5-flash-image'
    logger.info(f"🔍 DEBUG: Using NEW Google GenAI SDK with model: {model_name}")
    
    # Initialize client with API key from environment
    api_key = os.getenv("GOOGLE_AI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    for size_info in sizes_needed:
        try:
            logger.info(f"🔍 DEBUG: Generating image for {size_info['name']}...")
            
            # Generate with NEW SDK
            response = client.models.generate_content(
                model=model_name,
                contents=[image_prompt],
            )
            
            logger.info(f"🔍 DEBUG: Response received from NEW SDK")
            logger.info(f"🔍 DEBUG: Response type: {type(response)}")
            logger.info(f"🔍 DEBUG: Response dir: {[attr for attr in dir(response) if not attr.startswith('_')]}")
            logger.info(f"🔍 DEBUG: Has parts: {hasattr(response, 'parts')}")
            logger.info(f"🔍 DEBUG: Has candidates: {hasattr(response, 'candidates')}")
            logger.info(f"🔍 DEBUG: Has text: {hasattr(response, 'text')}")
            
            # Try different response structures
            parts = None
            if hasattr(response, 'parts'):
                parts = response.parts
                logger.info(f"🔍 DEBUG: Found parts directly")
            elif hasattr(response, 'candidates') and response.candidates:
                parts = response.candidates[0].content.parts if hasattr(response.candidates[0], 'content') else None
                logger.info(f"🔍 DEBUG: Found parts in candidates")
            
            # Extract image using NEW SDK response structure
            if parts:
                logger.info(f"🔍 DEBUG: Number of parts: {len(parts)}")
                
                for i, part in enumerate(parts):
                    logger.info(f"🔍 DEBUG: Part {i}: has inline_data={hasattr(part, 'inline_data')}, has text={hasattr(part, 'text')}")
                    
                    # Skip text parts
                    if hasattr(part, 'text') and part.text:
                        logger.info(f"ℹ️ DEBUG: Part {i} contains text: {part.text[:100] if part.text else ''}")
                        continue
                    
                    # Process image part
                    if hasattr(part, 'inline_data') and part.inline_data:
                        logger.info(f"🔍 DEBUG: Found inline_data!")
                        
                        # Get image data directly
                        image_data = part.inline_data.data
                        mime_type = part.inline_data.mime_type if hasattr(part.inline_data, 'mime_type') else 'image/png'
                        
                        logger.info(f"🔍 DEBUG: Image data size: {len(image_data)} bytes")
                        logger.info(f"🔍 DEBUG: MIME type: {mime_type}")
                        
                        # Convert to base64 for data URL
                        image_base64 = base64.b64encode(image_data).decode('utf-8')
                        image_url = f"data:{mime_type};base64,{image_base64}"
                        
                        logger.info(f"✅ DEBUG: Real image generated! Size: {len(image_data)} bytes, Base64 length: {len(image_base64)}")
                        
                        # Sanity check - real image should be > 10KB
                        if len(image_data) < 10000:
                            logger.warning(f"⚠️ DEBUG: Image too small ({len(image_data)} bytes)! Using placeholder instead.")
                            images.append(ImageVariation(
                                url=f"https://placehold.co/{size_info['dimensions']}/6366f1/white?text=AI+Generated+Image&font=roboto",
                                size=size_info['name'],
                                dimensions=size_info['dimensions']
                            ))
                        else:
                            images.append(ImageVariation(
                                url=image_url,
                                size=size_info['name'],
                                dimensions=size_info['dimensions']
                            ))
                        break
                else:
                    logger.warning(f"⚠️ DEBUG: No inline_data found in any part!")
            else:
                logger.warning(f"⚠️ DEBUG: No parts in response!")
            
        except Exception as e:
            logger.error(f"❌ Image generation error: {type(e).__name__}: {str(e)}")
            logger.exception("Full traceback:")
            # Fallback to beautiful placeholder
            images.append(ImageVariation(
                url=f"https://placehold.co/{size_info['dimensions']}/6366f1/white?text=AI+Generated+Image&font=roboto",
                size=size_info['name'],
                dimensions=size_info['dimensions']
            ))
    
    return images if images else _get_placeholder_images(sizes_needed)


def _get_aspect_ratio(dimensions: str) -> str:
    """Calculate aspect ratio from dimensions"""
    try:
        w, h = map(int, dimensions.split('x'))
        from math import gcd
        divisor = gcd(w, h)
        return f"{w//divisor}:{h//divisor}"
    except:
        return "1:1"


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
    """Returns beautiful placeholder images if generation fails"""
    return [
        ImageVariation(
            url=f"https://placehold.co/{size['dimensions']}/6366f1/white?text=Generated+Image&font=roboto",
            size=size['name'],
            dimensions=size['dimensions']
        )
        for size in sizes_needed
    ]
