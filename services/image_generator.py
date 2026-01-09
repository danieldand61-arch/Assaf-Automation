from typing import List, Dict
from google import genai
from google.genai import types
from main import ImageVariation, PostVariation
import base64
import os
import logging

# Initialize logger at module level
logger = logging.getLogger(__name__)


async def generate_images(
    website_data: Dict,
    variations: List[PostVariation],
    platforms: List[str],
    image_size: str = "1080x1080",
    include_logo: bool = False
) -> List[ImageVariation]:
    """Generates images for posts using Gemini 2.5 Flash Image"""
    
    logger.info(f"🖼️ Generating image with size: {image_size}")
    
    images = []
    
    # Use user-selected size
    sizes_needed = [{
        "name": f"custom_{image_size}",
        "dimensions": image_size,
        "aspect_ratio": _get_aspect_ratio(image_size)
    }]
    
    # Take first post variation for image generation
    main_variation = variations[0] if variations else None
    
    # Create prompt
    image_prompt = _build_image_prompt(website_data, main_variation)
    
    # Initialize client
    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        logger.error("❌ GOOGLE_AI_API_KEY not found!")
        return _get_placeholder_images(sizes_needed)
    
    client = genai.Client(api_key=api_key)
    model_name = 'gemini-2.5-flash-image'
    
    logger.info(f"🔍 Using model: {model_name}")
    
    for size_info in sizes_needed:
        try:
            logger.info(f"🔍 Generating image for {size_info['name']}...")
            
            # Calculate aspect ratio for config
            w, h = map(int, image_size.split('x'))
            aspect = "1:1" if w == h else ("16:9" if w > h else "9:16")
            
            # Generate image with proper config
            response = client.models.generate_content(
                model=model_name,
                contents=[image_prompt],
                config=types.GenerateContentConfig(
                    temperature=0.7,
                )
            )
            
            logger.info(f"✅ Response received")
            
            # Extract image bytes from response.candidates[0].content.parts[0].inline_data.data
            if not hasattr(response, 'candidates') or not response.candidates:
                logger.error("❌ No candidates in response")
                raise Exception("No candidates in response")
            
            candidate = response.candidates[0]
            
            if not hasattr(candidate, 'content') or not candidate.content:
                logger.error("❌ No content in candidate")
                raise Exception("No content in candidate")
            
            if not hasattr(candidate.content, 'parts') or not candidate.content.parts:
                logger.error("❌ No parts in content")
                raise Exception("No parts in content")
            
            logger.info(f"🔍 Found {len(candidate.content.parts)} parts")
            
            # Extract image from inline_data
            image_bytes = None
            mime_type = 'image/png'
            
            for i, part in enumerate(candidate.content.parts):
                logger.info(f"🔍 Part {i}: has inline_data={hasattr(part, 'inline_data')}")
                
                # ПРАВИЛЬНАЯ ОБРАБОТКА: извлекаем байты из inline_data
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_bytes = part.inline_data.data
                    mime_type = getattr(part.inline_data, 'mime_type', 'image/png')
                    logger.info(f"✅ Found image! Size: {len(image_bytes)} bytes, MIME: {mime_type}")
                    break
                elif hasattr(part, 'text') and part.text:
                    logger.info(f"ℹ️ Part {i} is text: {part.text[:100]}")
            
            if not image_bytes:
                logger.error("❌ No inline_data found in any part!")
                raise Exception("No image data in response")
            
            # Sanity check - real image should be > 10KB
            if len(image_bytes) < 10000:
                logger.warning(f"⚠️ Image too small ({len(image_bytes)} bytes)!")
                raise Exception(f"Generated image too small: {len(image_bytes)} bytes")
            
            # Convert to base64 data URL
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            image_url = f"data:{mime_type};base64,{image_base64}"
            
            logger.info(f"✅ Image generated successfully! Size: {len(image_bytes)} bytes")
            
            images.append(ImageVariation(
                url=image_url,
                size=size_info['name'],
                dimensions=size_info['dimensions']
            ))
            
        except Exception as e:
            logger.error(f"❌ Image generation error: {type(e).__name__}: {str(e)}")
            # Fallback to placeholder
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
