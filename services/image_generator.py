from typing import List, Dict
import google.generativeai as genai
from models import ImageVariation, PostVariation
import base64
import os
import logging
import asyncio
from PIL import Image
import io
import httpx

# Initialize logger at module level
logger = logging.getLogger(__name__)


async def generate_images(
    website_data: Dict,
    variations: List[PostVariation],
    platforms: List[str],
    image_size: str = "1080x1080",
    include_logo: bool = False,
    custom_prompt: str = None,
    user_id: str = None
) -> List[ImageVariation]:
    """Generates images for posts using Gemini 2.5 Flash Image"""
    
    logger.info(f"🖼️ Generating {len(variations)} unique images with size: {image_size}")
    
    images = []
    
    # Use user-selected size
    size_info = {
        "name": f"custom_{image_size}",
        "dimensions": image_size,
        "aspect_ratio": _get_aspect_ratio(image_size)
    }
    
    # Initialize client
    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        logger.error("❌ GOOGLE_AI_API_KEY not found!")
        return [_get_placeholder_image(size_info) for _ in variations]
    
    genai.configure(api_key=api_key)
    model_name = 'gemini-2.5-flash-image'
    
    logger.info(f"🔍 Using model: {model_name}")
    
    # Create model once, reuse for all variations
    model = genai.GenerativeModel(model_name)
    
    # Generate unique image for each variation
    for idx, variation in enumerate(variations):
        # Pause between requests to avoid rate limiting (skip first)
        if idx > 0:
            await asyncio.sleep(2)
        
        last_error = None
        response = None
        
        for attempt in range(3):
            try:
                logger.info(f"🔍 Generating image {idx + 1}/{len(variations)} (attempt {attempt + 1}) for: {variation.text[:50]}...")
                
                plat = variation.platform or (platforms[idx % len(platforms)] if platforms else 'instagram')
                image_prompt = _build_image_prompt(website_data, variation, custom_prompt=custom_prompt, platform=plat, image_size=image_size)
                
                response = await asyncio.to_thread(
                    model.generate_content,
                    image_prompt,
                    generation_config={
                        "temperature": 0.4,
                    }
                )
                
                logger.info(f"✅ Response received")
                last_error = None
                break
            except Exception as e:
                last_error = e
                logger.warning(f"⚠️ Attempt {attempt + 1} failed: {type(e).__name__}: {e}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
        
        if last_error or response is None:
            logger.error(f"❌ Image {idx + 1} all attempts failed: {last_error}")
            images.append(_get_placeholder_image(size_info))
            continue
        
        try:
            
            # Track API usage for this image
            if user_id:
                try:
                    from services.credits_service import record_usage
                    
                    input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                    output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                    total_tokens = getattr(response.usage_metadata, 'total_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                    
                    logger.info(f"📊 Image {idx+1} tokens: input={input_tokens}, output={output_tokens}, total={total_tokens}")
                    
                    await record_usage(
                        user_id=user_id,
                        service_type="image_generation",
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        total_tokens=total_tokens,
                        model_name=model_name,
                        metadata={
                            "image_size": image_size,
                            "variation_index": idx + 1
                        }
                    )
                    logger.info(f"✅ Tracked usage for image {idx+1}")
                except Exception as e:
                    logger.error(f"❌ Failed to track image usage: {e}")
            
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
                logger.info(f"🔍 Original image from API: {img.size}, format: {img.format}, mode: {img.mode}")
            except Exception as e:
                logger.error(f"❌ PIL cannot open image: {e}")
                logger.error(f"🔍 First 100 bytes: {image_bytes[:100]}")
                raise
            
            # SMART FALLBACK: Fix aspect ratio if API ignored it
            api_width, api_height = img.size
            api_ratio = api_width / api_height
            
            # Target ratios and dimensions
            target_ratios = {
                "16:9": 16/9,
                "9:16": 9/16,
                "1:1": 1.0
            }
            target_dims = {
                "16:9": (1920, 1080),
                "9:16": (1080, 1920),
                "1:1": (1024, 1024)
            }
            
            # Calculate target based on user's image_size
            w, h = map(int, image_size.split('x'))
            if w == h:
                target_aspect = "1:1"
            elif w > h:
                target_aspect = "16:9"
            else:
                target_aspect = "9:16"
            
            target_ratio = target_ratios[target_aspect]
            target_width, target_height = target_dims[target_aspect]
            
            logger.info(f"🎯 Target: {target_aspect} ({target_width}x{target_height}), API gave: {api_ratio:.2f}")
            
            # If API ignored aspectRatio (tolerance 0.1)
            if abs(api_ratio - target_ratio) > 0.1:
                logger.warning(f"⚠️ API ignored aspectRatio! Fixing {api_width}x{api_height} → {target_width}x{target_height}")
                
                # STEP 1: Center crop to correct aspect ratio
                if api_ratio > target_ratio:
                    # Too wide - crop width
                    new_width = int(api_height * target_ratio)
                    left = (api_width - new_width) // 2
                    img = img.crop((left, 0, left + new_width, api_height))
                    logger.info(f"🔧 Cropped width: {api_width} → {new_width}")
                else:
                    # Too tall - crop height
                    new_height = int(api_width / target_ratio)
                    top = (api_height - new_height) // 2
                    img = img.crop((0, top, api_width, top + new_height))
                    logger.info(f"🔧 Cropped height: {api_height} → {new_height}")
                
                # STEP 2: Resize to final dimensions (LANCZOS = best quality)
                img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                logger.info(f"✅ Fixed! Final size: {img.size}")
            else:
                logger.info(f"✅ API respected aspectRatio! Size: {img.size}")
            
            # OVERLAY LOGO if requested
            if include_logo:
                logo_url = website_data.get('logo_url', '')
                if logo_url:
                    try:
                        logger.info(f"🎨 Overlaying logo from: {logo_url}")
                        img = await _overlay_logo(img, logo_url)
                        logger.info(f"✅ Logo overlayed successfully!")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to overlay logo: {e}")
                        # Continue without logo
                else:
                    logger.warning(f"⚠️ Include logo requested but no logo_url found")
            
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
            logger.error(f"❌ Image {idx + 1} generation error: {type(e).__name__}: {str(e)}")
            # Fallback to placeholder for this variation
            images.append(_get_placeholder_image(size_info))
    
    # Ensure we have the same number of images as variations
    while len(images) < len(variations):
        images.append(_get_placeholder_image(size_info))
    
    return images


def _get_aspect_ratio(dimensions: str) -> str:
    """Calculate aspect ratio from dimensions"""
    try:
        w, h = map(int, dimensions.split('x'))
        from math import gcd
        divisor = gcd(w, h)
        return f"{w//divisor}:{h//divisor}"
    except:
        return "1:1"


def _build_image_prompt(website_data: Dict, variation: PostVariation, custom_prompt: str = None, platform: str = 'instagram', image_size: str = '1080x1080') -> str:
    """Build an advertising-grade image prompt."""

    if custom_prompt:
        logger.info(f"🎨 Using custom prompt: {custom_prompt[:100]}...")
        return custom_prompt.strip()

    brand = website_data.get('title', '').strip() or 'a brand'
    industry = website_data.get('industry', '') or website_data.get('description', '')[:80]
    products = ', '.join(website_data.get('products', [])[:3])
    voice = website_data.get('brand_voice', 'professional')
    colors = website_data.get('colors', [])
    color_hint = f'Subtly incorporate brand colors ({", ".join(colors[:3])}) through props, backgrounds, or accents.' if colors else ''

    post_text = variation.text[:250]
    mood = _detect_mood(variation.text)
    vtype = getattr(variation, 'variant_type', '') or ''

    style_by_variant = 'warm editorial lifestyle photography with aspirational feel' if vtype == 'storyteller' else 'clean, bold commercial photography with high contrast and sharp focus'

    platform_style = {
        'instagram': 'Instagram-optimized: vibrant colors, high saturation, lifestyle editorial feel. Hero subject with negative space for text overlay.',
        'facebook': 'Facebook feed-optimized: eye-catching, scroll-stopping composition. Bright, relatable scene that triggers engagement.',
        'linkedin': 'LinkedIn-appropriate: professional, corporate-quality photography. Clean backgrounds, business context, polished look.',
        'tiktok': 'TikTok aesthetic: trendy, Gen-Z visual language. Bold colors, dynamic angles, lifestyle-forward.',
        'x': 'Twitter/X card: clean, minimal, high-impact single subject with strong focal point.',
    }.get(platform, 'Social media advertising: professional, eye-catching, commercial quality.')

    size_comp = {
        '1080x1080': 'Square 1:1. Center the subject. Symmetrical or rule-of-thirds composition.',
        '1080x1350': 'Portrait 4:5. Vertical composition. Subject in upper third, breathing room at bottom.',
        '1080x1920': 'Story/Reel 9:16. Full vertical. Subject centered, dramatic top-to-bottom flow.',
        '1200x628': 'Landscape 16:9. Wide cinematic composition. Subject on left or right third.',
    }.get(image_size.replace('_story', ''), 'Balanced composition with clear focal point.')

    prompt = f"""You are an elite advertising creative director. Create a premium social media advertisement image.

BRAND: "{brand}"
BRAND VOICE: {voice}
{f'INDUSTRY: {industry}' if industry else ''}
{f'PRODUCTS: {products}' if products else ''}

THE AD MUST CONVEY THIS MESSAGE:
"{post_text}"

VISUAL DIRECTION:
- {style_by_variant}
- {platform_style}
- Mood: {mood}
- {size_comp}
{f'- {color_hint}' if color_hint else ''}

PHOTOGRAPHY SPECS:
- Shot on Canon EOS R5, 85mm f/1.4 lens
- Shallow depth of field with creamy bokeh on background
- Golden hour or studio softbox lighting
- Color graded for social media (slightly lifted shadows, rich midtones)
- 8K detail, advertising campaign quality

COMPOSITION:
- One hero subject that instantly communicates the brand/product value
- Environmental storytelling through props and setting
- Aspirational lifestyle context that the target audience identifies with
- Visual hierarchy that draws the eye to the key selling point

STRICT RULES:
- ABSOLUTELY NO text, words, letters, numbers, watermarks, logos, or typography
- NO UI elements, buttons, overlays, or borders
- ONE single cohesive photograph, no collages or split frames
- NO stock photo feel. Must look like a real premium ad campaign shoot
- The image alone should make someone stop scrolling"""

    return prompt.strip()


def _detect_mood(text: str) -> str:
    """Return a cinematographic mood direction from post text."""
    t = text.lower()
    if any(w in t for w in ['sale', 'offer', 'discount', 'limited', 'hurry', 'deal', 'save']):
        return 'high-energy, urgency-driven. Warm reds and oranges. Dynamic composition'
    if any(w in t for w in ['luxury', 'premium', 'exclusive', 'elegant', 'vip', 'gold']):
        return 'dark and moody elegance. Deep blacks, gold accents, dramatic lighting'
    if any(w in t for w in ['fun', 'exciting', 'amazing', 'wow', 'love', 'happy', 'joy']):
        return 'bright, joyful, saturated. Warm sunlight, genuine happiness, candid moment'
    if any(w in t for w in ['trust', 'secure', 'reliable', 'professional', 'expert']):
        return 'confident and authoritative. Cool blues, clean lines, sharp focus'
    if any(w in t for w in ['health', 'natural', 'organic', 'eco', 'fresh', 'clean']):
        return 'fresh and airy. Soft greens, natural textures, morning light, dew drops'
    if any(w in t for w in ['tech', 'digital', 'ai', 'smart', 'innovation', 'future']):
        return 'futuristic and sleek. Cool tones, minimalist, subtle glow effects'
    if any(w in t for w in ['food', 'coffee', 'drink', 'taste', 'delicious', 'recipe']):
        return 'appetizing and indulgent. Warm tones, steam/texture details, close-up macro'
    return 'warm and inviting. Golden hour lighting, lifestyle editorial feel'


async def _overlay_logo(main_image: Image.Image, logo_url: str) -> Image.Image:
    """Downloads and overlays logo on the main image"""
    
    # Download logo
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(logo_url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        })
        logo_bytes = response.content
    
    # Open logo
    logo = Image.open(io.BytesIO(logo_bytes))
    
    # Convert to RGBA for transparency
    if logo.mode != 'RGBA':
        logo = logo.convert('RGBA')
    
    # Calculate logo size (10% of main image width, max 150px)
    main_width, main_height = main_image.size
    max_logo_width = min(int(main_width * 0.1), 150)
    
    # Resize logo maintaining aspect ratio
    logo_aspect = logo.width / logo.height
    new_logo_width = max_logo_width
    new_logo_height = int(new_logo_width / logo_aspect)
    
    logo = logo.resize((new_logo_width, new_logo_height), Image.Resampling.LANCZOS)
    
    # Convert main image to RGBA for compositing
    if main_image.mode != 'RGBA':
        main_image = main_image.convert('RGBA')
    
    # Create a new transparent layer
    overlay = Image.new('RGBA', main_image.size, (0, 0, 0, 0))
    
    # Calculate position (bottom-right corner with 20px padding)
    position = (
        main_width - new_logo_width - 20,
        main_height - new_logo_height - 20
    )
    
    # Paste logo onto overlay
    overlay.paste(logo, position, logo)
    
    # Composite overlay onto main image
    result = Image.alpha_composite(main_image, overlay)
    
    logger.info(f"🎨 Logo size: {new_logo_width}x{new_logo_height}, position: {position}")
    
    return result


def _get_placeholder_image(size_info: Dict) -> ImageVariation:
    """Returns a beautiful placeholder image if generation fails"""
    return ImageVariation(
        url=f"https://placehold.co/{size_info['dimensions']}/6366f1/white?text=AI+Generated+Image&font=roboto",
        size=size_info['name'],
        dimensions=size_info['dimensions']
    )
