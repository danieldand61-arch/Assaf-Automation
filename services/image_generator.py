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
    user_id: str = None,
    include_people: bool = False,
    reference_image: str = None
) -> List[ImageVariation]:
    """Generates images for posts using Gemini 2.5 Flash Image"""
    
    logger.info(f"🖼️ Generating {len(variations)} unique images in parallel with size: {image_size}")
    
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
    model_name = 'gemini-3.1-flash-image-preview'
    
    logger.info(f"🔍 Using model: {model_name}")
    
    # Create model once, reuse for all variations
    model = genai.GenerativeModel(model_name)
    
    # Decode reference image once if provided (base64 data URI)
    ref_image_part = None
    if reference_image:
        try:
            if reference_image.startswith('data:'):
                header, b64data = reference_image.split(',', 1)
                mime = header.split(':')[1].split(';')[0] if ':' in header else 'image/jpeg'
                ref_bytes = base64.b64decode(b64data)
            else:
                resp = httpx.get(reference_image, timeout=15, follow_redirects=True)
                ref_bytes = resp.content
                mime = resp.headers.get("content-type", "image/jpeg")
            ref_image_part = {"mime_type": mime, "data": ref_bytes}
            logger.info(f"🖼️ Reference image loaded: {len(ref_bytes)} bytes, {mime}")
        except Exception as e:
            logger.warning(f"⚠️ Could not load reference image: {e}")
    
    # Generate all images in parallel
    async def _generate_single_image(idx: int, variation: PostVariation) -> ImageVariation:
        last_error = None
        response = None
        
        for attempt in range(3):
            try:
                logger.info(f"🔍 Generating image {idx + 1}/{len(variations)} (attempt {attempt + 1}) for: {variation.text[:50]}...")
                
                plat = variation.platform or (platforms[idx % len(platforms)] if platforms else 'instagram')
                image_prompt = _build_image_prompt(website_data, variation, custom_prompt=custom_prompt, platform=plat, image_size=image_size, include_people=include_people, has_reference=ref_image_part is not None)
                
                content = []
                if ref_image_part:
                    content.append(ref_image_part)
                content.append(image_prompt)
                
                response = await asyncio.to_thread(
                    model.generate_content,
                    content,
                    generation_config={"temperature": 0.6}
                )
                
                logger.info(f"✅ Response received for image {idx + 1}")
                last_error = None
                break
            except Exception as e:
                last_error = e
                logger.warning(f"⚠️ Image {idx + 1} attempt {attempt + 1} failed: {type(e).__name__}: {e}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
        
        if last_error or response is None:
            logger.error(f"❌ Image {idx + 1} all attempts failed: {last_error}")
            return _get_placeholder_image(size_info)
        
        try:
            if user_id:
                try:
                    from services.credits_service import record_usage
                    input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                    output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                    total_tokens = getattr(response.usage_metadata, 'total_token_count', 0) if hasattr(response, 'usage_metadata') else 0
                    logger.info(f"📊 Image {idx+1} tokens: input={input_tokens}, output={output_tokens}, total={total_tokens}")
                    await record_usage(
                        user_id=user_id, service_type="image_generation",
                        input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens,
                        model_name=model_name, metadata={"image_size": image_size, "variation_index": idx + 1}
                    )
                except Exception as e:
                    logger.error(f"❌ Failed to track image usage: {e}")
            
            if not hasattr(response, 'candidates') or not response.candidates:
                raise Exception("No candidates in response")
            candidate = response.candidates[0]
            if not hasattr(candidate, 'content') or not candidate.content:
                raise Exception("No content in candidate")
            if not hasattr(candidate.content, 'parts') or not candidate.content.parts:
                raise Exception("No parts in content")
            
            image_bytes = None
            mime_type = 'image/png'
            
            for i, part in enumerate(candidate.content.parts):
                if hasattr(part, 'inline_data') and part.inline_data:
                    raw_data = part.inline_data.data
                    mime_type = getattr(part.inline_data, 'mime_type', 'image/png')
                    
                    is_base64 = False
                    if isinstance(raw_data, bytes):
                        try:
                            decoded_str = raw_data[:20].decode('ascii')
                            if decoded_str.startswith('iVBOR') or decoded_str.startswith('/9j/') or decoded_str.startswith('AAAA'):
                                is_base64 = True
                        except:
                            pass
                    elif isinstance(raw_data, str):
                        is_base64 = True
                    
                    if is_base64:
                        if isinstance(raw_data, bytes):
                            raw_data = raw_data.decode('ascii')
                        image_bytes = base64.b64decode(raw_data)
                    else:
                        image_bytes = raw_data
                    
                    logger.info(f"✅ Image {idx+1}: {len(image_bytes)} bytes, MIME: {mime_type}")
                    break
            
            if not image_bytes:
                raise Exception("No image data in response")
            
            if len(image_bytes) < 10000:
                raise Exception(f"Generated image too small: {len(image_bytes)} bytes")
            
            try:
                img = Image.open(io.BytesIO(image_bytes))
            except Exception as e:
                logger.error(f"❌ PIL cannot open image {idx+1}: {e}")
                raise
            
            api_width, api_height = img.size
            api_ratio = api_width / api_height
            
            target_ratios = {"16:9": 16/9, "9:16": 9/16, "1:1": 1.0}
            target_dims = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1024, 1024)}
            
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
            
            return ImageVariation(
                url=image_url,
                size=size_info['name'],
                dimensions=size_info['dimensions']
            )
            
        except Exception as e:
            logger.error(f"❌ Image {idx + 1} generation error: {type(e).__name__}: {str(e)}")
            return _get_placeholder_image(size_info)
    
    # Run all image generations in parallel
    tasks = [_generate_single_image(idx, v) for idx, v in enumerate(variations)]
    images = list(await asyncio.gather(*tasks))
    
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


def _build_image_prompt(website_data: Dict, variation: PostVariation, custom_prompt: str = None, platform: str = 'instagram', image_size: str = '1080x1080', include_people: bool = False, has_reference: bool = False) -> str:
    """Build an advertising-grade image prompt."""

    if custom_prompt:
        logger.info(f"🎨 Using custom prompt: {custom_prompt[:100]}...")
        return f"""Generate a professional social media advertisement image based on this description:

"{custom_prompt.strip()}"

STRICT RULES:
- ABSOLUTELY NO text, words, letters, numbers, watermarks, logos, or typography in the image
- NO UI elements, buttons, overlays, or borders
- ONE single cohesive photograph, no collages or split frames
- Professional advertising quality, high resolution
- The image alone should make someone stop scrolling"""

    brand = website_data.get('title', '').strip() or 'a brand'
    industry = website_data.get('industry', '') or website_data.get('description', '')[:80]
    products = ', '.join(website_data.get('products', [])[:3])
    features = ', '.join(website_data.get('key_features', [])[:3])
    voice = website_data.get('brand_voice', 'professional')
    colors = website_data.get('colors', [])
    color_hint = f'Subtly incorporate brand colors ({", ".join(colors[:3])}) through props, backgrounds, or accents.' if colors else ''

    brand_colors = ', '.join(colors[:4]) if colors else ''
    target_audience = website_data.get('target_audience', '')

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

    people_line = (
        'If the post mentions a person or lifestyle scenario, show a real person naturally interacting with the product/environment. Authentic expression, natural skin.'
        if include_people else
        'Do NOT include any people, faces, hands, silhouettes, or human body parts in the image. Focus on product, environment, and objects only.'
    )

    if has_reference:
        prompt = f"""You are an elite advertising creative director. The user has provided a REFERENCE IMAGE above.

YOUR #1 PRIORITY: Generate a NEW image that closely matches the STYLE, MOOD, COLOR PALETTE, COMPOSITION, and VISUAL FEEL of the reference image.

WHAT TO KEEP FROM THE REFERENCE:
- Same overall mood and atmosphere (lighting, warmth/coolness, time of day)
- Same color palette and tonal range
- Similar composition style and framing
- Same level of detail and artistic style (photographic, painterly, minimal, etc.)
- Same emotional feeling the reference evokes

WHAT TO ADAPT:
- Subtly incorporate the brand context: "{brand}" ({industry})
- The post topic: "{post_text[:200]}"
- {size_comp}

{people_line}

STRICT RULES:
- ABSOLUTELY NO text, words, letters, numbers, watermarks, logos, or typography
- NO UI elements, buttons, overlays, or borders
- ONE single cohesive image, no collages or split frames
- The reference image is your PRIMARY guide. The brand context is SECONDARY.
- If the reference shows a sunset landscape, generate a sunset landscape. If it shows food, generate food. FOLLOW THE REFERENCE."""
    else:
        prompt = f"""You are a visual director. Generate a scroll-stopping image for social media.

YOUR BRAND:
- Brand: "{brand}"
- Voice: {voice}
{f'- Industry: {industry}' if industry else ''}
{f'- Products: {products}' if products else ''}
{f'- Key features: {features}' if features else ''}
{f'- Brand colors: {brand_colors}' if brand_colors else ''}
{f'- Target audience: {target_audience}' if target_audience else ''}

THIS IMAGE MUST ILLUSTRATE THIS POST:
"{post_text}"

CREATIVE DIRECTION:

Read the post carefully. Identify the core emotion and scenario.

Don't illustrate the topic literally. Find the emotional truth.
A post about failure? Show the aftermath - an empty chair, a light left on in an empty room.
A post about growth? Show worn running shoes next to new ones. A plant pushing through a crack.

The viewer should see the image and immediately FEEL what the post is about.

Make the image specific and vivid:
- What's happening - a moment in motion, not a posed subject
- The perspective - what angle? How close?
- The light - where from? What quality? What shadows?
- The place - real texture and detail. Worn surfaces, lived-in spaces, real objects
- The colors - lean toward the brand's color world

Let the brand breathe through the image naturally. If someone saw just the image, they should get a sense of what kind of business this is.

{people_line}

PLATFORM: {platform_style}
DIMENSIONS: {size_comp}
MOOD: {mood}

ABSOLUTE RULES:
- NO text, words, letters, numbers, watermarks, logos, or typography anywhere in the image
- NO UI elements, buttons, overlays, or borders
- ONE single cohesive image, no collages or split frames
- NO generic stock photo feel
- The image MUST match the post content
- If this looks like something you've generated a thousand times before - find a fresher angle

Now generate the image."""

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
