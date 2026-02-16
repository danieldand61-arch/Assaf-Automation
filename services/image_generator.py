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
    
    # Generate unique image for each variation
    for idx, variation in enumerate(variations):
        try:
            logger.info(f"🔍 Generating image {idx + 1}/{len(variations)} for variation: {variation.text[:50]}...")
            
            # Create unique prompt for this variation (use custom prompt if provided)
            image_prompt = _build_image_prompt(website_data, variation, custom_prompt=custom_prompt)
            
            # Calculate aspect ratio for config
            w, h = map(int, image_size.split('x'))
            aspect = "1:1" if w == h else ("16:9" if w > h else "9:16")
            
            # Generate image (run sync call in thread)
            model = genai.GenerativeModel(model_name)
            response = await asyncio.to_thread(
                model.generate_content,
                image_prompt,
                generation_config={
                    "temperature": 0.4,
                }
            )
            
            logger.info(f"✅ Response received")
            
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


def _build_image_prompt(website_data: Dict, variation: PostVariation, custom_prompt: str = None) -> str:
    """Build a concise, narrative scene prompt for Gemini image generation."""

    if custom_prompt:
        logger.info(f"🎨 Using custom prompt: {custom_prompt[:100]}...")
        return custom_prompt.strip()

    title = website_data.get('title', 'a brand')
    description = website_data.get('description', '')
    industry = website_data.get('industry', 'business')
    products = website_data.get('products', [])
    features = website_data.get('key_features', [])
    colors = website_data.get('colors', [])

    # Concrete product/service string
    product_str = ', '.join(products[:3]) if products else description[:120]
    feature_str = ', '.join(features[:3]) if features else ''
    color_hint = f"Brand palette: {', '.join(colors[:3])}. " if colors else ''

    # Determine visual style from industry
    style_map = {
        'food': 'overhead flat-lay food photography, warm natural lighting, wooden table surface',
        'restaurant': 'moody restaurant interior, warm ambient lighting, shallow depth of field',
        'fashion': 'editorial fashion photography, clean studio backdrop, dramatic directional lighting',
        'beauty': 'close-up beauty photography, soft diffused lighting, pastel tones, dewy skin texture',
        'tech': 'sleek product photography on dark gradient background, rim lighting, reflective surface',
        'fitness': 'dynamic action shot, natural gym or outdoor setting, energetic composition',
        'health': 'bright airy lifestyle photograph, natural daylight, green and white tones',
        'real_estate': 'architectural interior photography, wide-angle, bright natural light flooding through windows',
        'education': 'candid lifestyle photo of people learning together, warm indoor lighting',
        'finance': 'clean corporate photography, modern office, blue and grey tones, confident professionals',
    }
    visual_style = style_map.get(industry, 'professional commercial photography, clean composition, natural lighting')

    # Build a narrative scene description (Google's recommended approach)
    prompt = f"""A photorealistic, high-resolution social media photograph for "{title}".

Scene: {visual_style}. The image showcases {product_str} in a real-world, aspirational context. {f'Highlight: {feature_str}. ' if feature_str else ''}{color_hint}

The composition is clean with a single clear focal point, shot with an 85mm lens for soft bokeh background. Lighting is natural and flattering. The mood is {_detect_mood(variation.text)} and modern.

This image must feel authentic and premium — like a professional brand campaign photo, NOT a stock photo. Show the product/service being used or enjoyed by real people in a lifestyle setting.

CRITICAL RULES:
- Do NOT render any text, words, letters, numbers, watermarks, or logos on the image
- Do NOT include any UI elements, buttons, or overlays
- Pure photographic image only
- No collages or split compositions — one cohesive scene
- The subject should fill at least 60% of the frame"""

    return prompt.strip()


def _detect_mood(text: str) -> str:
    """Return a short mood keyword from post text."""
    t = text.lower()
    if any(w in t for w in ['sale', 'offer', 'discount', 'limited', 'hurry']):
        return 'vibrant and energetic'
    if any(w in t for w in ['luxury', 'premium', 'exclusive', 'elegant']):
        return 'sophisticated and refined'
    if any(w in t for w in ['fun', 'exciting', 'amazing', 'wow']):
        return 'bright and exciting'
    if any(w in t for w in ['trust', 'secure', 'reliable', 'professional']):
        return 'trustworthy and calm'
    if any(w in t for w in ['health', 'natural', 'organic', 'eco']):
        return 'fresh and natural'
    return 'warm and inviting'


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
