"""
Graphic Design Generator — creates styled social media graphics with text.
Categories: A (pure graphic), B (photo+text design), C (structured layout), D (AI illustration+text).
Uses Gemini 3.1 Flash Image to generate complete designs in a single call.
"""
from typing import List, Dict
from models import PostVariation, ImageVariation
import google.generativeai as genai
import base64
import os
import logging
import asyncio
import io
from PIL import Image

logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-3.1-flash-image-preview"


async def generate_graphic_designs(
    website_data: Dict,
    variations: List[PostVariation],
    platforms: List[str],
    image_size: str = "1080x1080",
    user_id: str = None,
) -> List[ImageVariation]:
    """Generate graphic designs (with text) for each post variation."""

    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        logger.error("GOOGLE_AI_API_KEY not found")
        return [_placeholder(image_size) for _ in variations]

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL_NAME)

    async def _gen_single(idx: int, variation: PostVariation) -> ImageVariation:
        plat = variation.platform or (platforms[idx % len(platforms)] if platforms else "instagram")
        prompt = _build_graphic_prompt(website_data, variation, plat, image_size)

        last_error = None
        response = None
        for attempt in range(3):
            try:
                response = await asyncio.to_thread(
                    model.generate_content, prompt, generation_config={"temperature": 0.6}
                )
                last_error = None
                break
            except Exception as e:
                last_error = e
                logger.warning(f"Graphic {idx+1} attempt {attempt+1} failed: {e}")
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))

        if last_error or response is None:
            logger.error(f"Graphic {idx+1} all attempts failed: {last_error}")
            return _placeholder(image_size)

        if user_id:
            try:
                from services.credits_service import record_usage
                in_t = getattr(response.usage_metadata, "prompt_token_count", 0) if hasattr(response, "usage_metadata") else 0
                out_t = getattr(response.usage_metadata, "candidates_token_count", 0) if hasattr(response, "usage_metadata") else 0
                total_t = getattr(response.usage_metadata, "total_token_count", 0) if hasattr(response, "usage_metadata") else 0
                await record_usage(
                    user_id=user_id, service_type="image_generation",
                    input_tokens=in_t, output_tokens=out_t, total_tokens=total_t,
                    model_name=MODEL_NAME, metadata={"type": "graphic_design", "variation_index": idx + 1},
                )
            except Exception as e:
                logger.error(f"Failed to track graphic usage: {e}")

        image_b64 = _extract_image(response, image_size)
        if not image_b64:
            return _placeholder(image_size)

        return ImageVariation(url=image_b64, size=f"graphic_{image_size}", dimensions=image_size)

    tasks = [_gen_single(idx, v) for idx, v in enumerate(variations)]
    images = list(await asyncio.gather(*tasks))

    while len(images) < len(variations):
        images.append(_placeholder(image_size))

    return images


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_graphic_prompt(
    website_data: Dict,
    variation: PostVariation,
    platform: str,
    image_size: str,
) -> str:
    brand = website_data.get("title", "").strip() or "Brand"
    industry = website_data.get("industry", "") or website_data.get("description", "")[:80]
    colors = website_data.get("colors", [])
    voice = website_data.get("brand_voice", "professional")
    language = website_data.get("language", "en")

    post_text = variation.text[:300]
    cta = variation.call_to_action or ""
    hashtags = variation.hashtags[:5]

    color_palette = ", ".join(colors[:4]) if colors else "choose a harmonious palette that fits the brand and content"

    headline = _extract_headline(post_text)

    size_map = {
        "1080x1080": ("1080x1080 square", "1:1"),
        "1080x1350": ("1080x1350 portrait", "4:5"),
        "1080x1920": ("1080x1920 story/reel", "9:16"),
        "1200x628": ("1200x628 landscape", "roughly 2:1"),
    }
    size_label, aspect = size_map.get(image_size, ("1080x1080 square", "1:1"))

    lang_instruction = ""
    if language and language.lower().startswith("he"):
        lang_instruction = "ALL text must be in Hebrew (RTL). English words/brand names can be mixed in."
    elif language:
        lang_instruction = f"ALL text must be in the brand's language. English brand names are acceptable."

    return f"""You are a world-class social media graphic designer. Create a COMPLETE, READY-TO-POST graphic design image.

BRAND: "{brand}"
INDUSTRY: {industry}
BRAND VOICE: {voice}
COLOR PALETTE: {color_palette}

CONTENT FOR THIS GRAPHIC:
Headline: "{headline}"
{f'Call to action: "{cta}"' if cta else ''}
{f'Hashtags: {", ".join(hashtags)}' if hashtags else ''}

Full post context (use for tone/mood, don't put all of this on the graphic):
"{post_text}"

PLATFORM: {platform}
SIZE: {size_label} (aspect ratio {aspect})

{lang_instruction}

YOUR TASK:
Create a professional social media graphic design. Internally decide the best visual approach for this content — it could be a pure graphic with typography, an illustration with text, or a structured layout with zones. Do NOT label or name the approach you chose anywhere in the image.

DESIGN RULES (CRITICAL):
1. TYPOGRAPHY IS THE HERO — headline must be large, bold, and immediately readable
2. Maximum 3 colors in the design (from the brand palette or harmonious choices)
3. Maximum 2 font styles (one for headlines, one for body/details)
4. Clear visual hierarchy: Headline biggest → subtext → CTA → details
5. Generous padding (at least 40px equivalent from all edges)
6. Text must be perfectly legible — high contrast against background
7. If using an illustration background, add semi-transparent overlay behind text areas
8. Maximum 30 words total on the graphic (headline + subtext + CTA)
9. The design must look like it was made by a professional designer, NOT by AI
10. NO stock photo aesthetics. This is GRAPHIC DESIGN, not photography

COMPOSITION:
- Strong focal point (usually the headline)
- Balanced whitespace
- Decorative elements (lines, shapes, icons) to add visual interest
- Brand name or logo text in a subtle corner position

CRITICAL — DO NOT PUT ANY OF THE FOLLOWING ON THE IMAGE:
- NO option labels ("Option A", "Option B", etc.)
- NO category names ("Pure Graphic", "Illustration + Text", etc.)
- NO platform name ("{platform}") or resolution/dimensions ("{size_label}") as visible text
- NO meta-commentary or approach descriptions
- ONLY the actual design content: headline, CTA, brand name, decorative elements

OUTPUT: Generate a single complete graphic design image at aspect ratio {aspect}. The image must be the FINAL design, ready to post on social media."""


def _extract_headline(post_text: str) -> str:
    """Pull the hook/first line from the post as the graphic headline."""
    lines = [l.strip() for l in post_text.split("\n") if l.strip()]
    if lines:
        first = lines[0]
        if len(first) <= 80:
            return first
        return first[:77] + "..."
    return post_text[:60]


# ---------------------------------------------------------------------------
# Image extraction (reused pattern from image_generator)
# ---------------------------------------------------------------------------

def _extract_image(response, image_size: str) -> str | None:
    if not hasattr(response, "candidates") or not response.candidates:
        return None
    candidate = response.candidates[0]
    if not hasattr(candidate, "content") or not candidate.content or not candidate.content.parts:
        return None

    for part in candidate.content.parts:
        if hasattr(part, "inline_data") and part.inline_data:
            raw = part.inline_data.data
            if isinstance(raw, str):
                raw = base64.b64decode(raw)
            elif isinstance(raw, bytes):
                try:
                    decoded = raw[:20].decode("ascii")
                    if decoded.startswith(("iVBOR", "/9j/", "AAAA")):
                        raw = base64.b64decode(raw)
                except Exception:
                    pass

            try:
                img = Image.open(io.BytesIO(raw))
            except Exception:
                continue

            w, h = map(int, image_size.split("x"))
            target_ratio = w / h
            api_ratio = img.width / img.height

            if abs(api_ratio - target_ratio) > 0.1:
                if api_ratio > target_ratio:
                    new_w = int(img.height * target_ratio)
                    left = (img.width - new_w) // 2
                    img = img.crop((left, 0, left + new_w, img.height))
                else:
                    new_h = int(img.width / target_ratio)
                    top = (img.height - new_h) // 2
                    img = img.crop((0, top, img.width, top + new_h))
                img = img.resize((w, h), Image.Resampling.LANCZOS)

            if img.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                img = bg

            out = io.BytesIO()
            img.save(out, format="JPEG", quality=90, optimize=True)
            return f"data:image/jpeg;base64,{base64.b64encode(out.getvalue()).decode()}"

    return None


def _placeholder(image_size: str) -> ImageVariation:
    return ImageVariation(
        url=f"https://placehold.co/{image_size}/8B5CF6/white?text=Graphic+Design&font=roboto",
        size=f"graphic_{image_size}",
        dimensions=image_size,
    )
