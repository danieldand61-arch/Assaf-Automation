from typing import List, Dict
from google import genai
from google.genai import types
from main import ImageVariation, PostVariation
import base64
import os
import logging
import asyncio
from PIL import Image
import io

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
            
            # Generate image with proper config (run sync call in thread)
            response = await asyncio.to_thread(
                client.models.generate_content,
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
                    raw_data = part.inline_data.data
                    mime_type = getattr(part.inline_data, 'mime_type', 'image/png')
                    
                    # Check if data is bytes or string (base64)
                    logger.info(f"🔍 Raw data type: {type(raw_data)}")
                    
                    # Check if data looks like base64 (starts with common base64 patterns)
                    is_base64 = False
                    if isinstance(raw_data, bytes):
                        # Check if bytes contain base64 text (not binary image)
                        # PNG in base64 starts with: iVBORw0KGgo
                        # JPEG in base64 starts with: /9j/
                        try:
                            decoded_str = raw_data[:20].decode('ascii')
                            if decoded_str.startswith('iVBOR') or decoded_str.startswith('/9j/') or decoded_str.startswith('AAAA'):
                                is_base64 = True
                                logger.info(f"🔍 Data is base64-encoded bytes (starts with: {decoded_str[:10]})")
                        except:
                            logger.info(f"✅ Data is binary bytes")
                    elif isinstance(raw_data, str):
                        is_base64 = True
                        logger.info(f"📝 Data is base64 string")
                    
                    # Decode if base64
                    if is_base64:
                        if isinstance(raw_data, bytes):
                            raw_data = raw_data.decode('ascii')
                        image_bytes = base64.b64decode(raw_data)
                        logger.info(f"✅ Decoded from base64: {len(image_bytes)} bytes")
                    else:
                        image_bytes = raw_data
                        logger.info(f"✅ Using raw bytes: {len(image_bytes)} bytes")
                    
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
            
            # Debug: check first bytes to identify format
            magic_bytes = image_bytes[:8]
            logger.info(f"🔍 Magic bytes (hex): {magic_bytes.hex()}")
            
            # COMPRESS image to reduce size for data URL (browsers have ~2MB limit)
            # Open image
            try:
                img = Image.open(io.BytesIO(image_bytes))
                logger.info(f"🔍 Original image: {img.size}, format: {img.format}, mode: {img.mode}")
            except Exception as e:
                logger.error(f"❌ PIL cannot open image: {e}")
                logger.error(f"🔍 First 100 bytes: {image_bytes[:100]}")
                raise
            
            # Convert to RGB if needed (for JPEG compatibility)
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Compress to JPEG with quality 85 (good balance)
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85, optimize=True)
            compressed_bytes = output.getvalue()
            
            logger.info(f"🗜️ Compressed: {len(image_bytes)} → {len(compressed_bytes)} bytes ({len(compressed_bytes)/len(image_bytes)*100:.1f}%)")
            
            # Convert to base64 data URL
            image_base64 = base64.b64encode(compressed_bytes).decode('utf-8')
            image_url = f"data:image/jpeg;base64,{image_base64}"
            
            logger.info(f"✅ Image ready! Base64 size: {len(image_base64)} chars")
            
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
