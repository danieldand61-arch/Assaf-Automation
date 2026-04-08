"""
Generate Creative — produces professional ad images with embedded graphic text.
Two-step pipeline:
  1. LLM generates headline + subheadline from product description (+ optional user image)
  2. Image model creates the final ad creative with embedded text
"""
import asyncio
import base64
import io
import logging
import os
import httpx
from typing import List, Optional

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from PIL import Image as PILImage
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.credits_service import check_balance, record_usage

router = APIRouter(prefix="/api/creative", tags=["creative"])
logger = logging.getLogger(__name__)

IMAGE_MODEL = "gemini-3.1-flash-image-preview"
TEXT_MODEL = "gemini-2.5-flash"
CREDITS_PER_CREATIVE = 30


async def _resolve_image(url: str) -> dict | None:
    """Resolve image from URL or data URI to {data: base64, mime: str}."""
    if not url:
        return None
    if url.startswith("data:"):
        try:
            header, b64 = url.split(",", 1)
            mime = header.split(";")[0].split(":")[1] if ":" in header else "image/jpeg"
            return {"data": b64, "mime": mime}
        except Exception:
            return None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                mime = resp.headers.get("content-type", "image/jpeg")
                return {"data": base64.b64encode(resp.content).decode(), "mime": mime}
    except Exception as e:
        logger.warning(f"Could not fetch image {url[:80]}: {e}")
    return None


class CreativeRequest(BaseModel):
    product_description: str
    user_image_url: Optional[str] = None
    cta_text: str = "Shop Now"
    brand_name: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    logo_url: Optional[str] = None
    style: str = "modern"
    aspect_ratio: str = "1080x1080"
    background_style: Optional[str] = None
    count: int = 2
    language: str = "en"


# ── Step 1: Generate marketing copy ─────────────────────────────

LANG_NAMES = {"en": "English", "he": "Hebrew (עברית)", "es": "Spanish (Español)", "fr": "French (Français)"}
LANG_FALLBACKS = {
    "en": ("Discover Something New", "Premium quality, crafted for you"),
    "he": ("גלה משהו חדש", "איכות פרימיום, נוצר בשבילך"),
    "es": ("Descubre Algo Nuevo", "Calidad premium, creado para ti"),
    "fr": ("Découvrez Quelque Chose de Nouveau", "Qualité premium, conçu pour vous"),
}


async def _generate_copy(req: CreativeRequest, api_key: str, user_id: str = None) -> dict:
    """Use LLM to generate headline + subheadline from product description and optional image."""
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(TEXT_MODEL)

    brand_ctx = f'Brand: "{req.brand_name}". ' if req.brand_name else ""
    colors_ctx = f"Brand colors: {', '.join(req.brand_colors[:4])}. " if req.brand_colors else ""

    lang_name = LANG_NAMES.get(req.language, "English")
    lang_rule = f"\n- LANGUAGE: Write headline and subheadline ENTIRELY in {lang_name}. Every word must be in {lang_name}. Do NOT use any other language." if req.language != "en" else ""

    prompt_text = f"""You are an elite advertising copywriter. Generate a punchy headline and subheadline for a social media ad creative.

{brand_ctx}{colors_ctx}
Product/Visual: {req.product_description}
CTA: {req.cta_text}

RULES:
- Headline: 3-7 words, bold, attention-grabbing, makes people stop scrolling
- Subheadline: 5-12 words, supports the headline, adds context or emotion
- Do NOT use generic phrases like "Shop Now" or "Buy Today" in the headline
- Make it feel premium and professional{lang_rule}
- Output ONLY two lines, nothing else:
HEADLINE: <your headline>
SUBHEADLINE: <your subheadline>"""

    parts = [prompt_text]

    if req.user_image_url:
        img = await _resolve_image(req.user_image_url)
        if img:
            parts = [prompt_text, {"mime_type": img["mime"], "data": img["data"]}]
            logger.info("Attached user image to copy generation")

    fallback_hl, fallback_sub = LANG_FALLBACKS.get(req.language, LANG_FALLBACKS["en"])

    try:
        resp = await asyncio.to_thread(
            model.generate_content, parts, generation_config={"temperature": 0.7}
        )
        text = resp.text.strip()
        headline, subheadline = _parse_copy(text, fallback_hl, fallback_sub)
        if user_id:
            try:
                in_tok = getattr(resp, 'usage_metadata', None)
                await record_usage(
                    user_id=user_id, service_type="creative_generation",
                    input_tokens=getattr(in_tok, 'prompt_token_count', 0) if in_tok else 0,
                    output_tokens=getattr(in_tok, 'candidates_token_count', 0) if in_tok else 0,
                    model_name=TEXT_MODEL, metadata={"step": "copy_generation"},
                )
            except Exception:
                pass
        return {"headline": headline, "subheadline": subheadline}
    except Exception as e:
        logger.error(f"Copy generation failed: {e}")
        return {"headline": fallback_hl, "subheadline": fallback_sub}


def _parse_copy(text: str, default_hl: str = "Discover Something New", default_sub: str = "Premium quality, crafted for you") -> tuple[str, str]:
    headline = default_hl
    subheadline = default_sub
    for line in text.split("\n"):
        line = line.strip()
        if line.upper().startswith("HEADLINE:"):
            headline = line.split(":", 1)[1].strip().strip('"')
        elif line.upper().startswith("SUBHEADLINE:"):
            subheadline = line.split(":", 1)[1].strip().strip('"')
    return headline, subheadline


# ── Step 2: Generate creative image ─────────────────────────────

@router.post("/generate")
async def generate_creative(req: CreativeRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]

    total_credits = CREDITS_PER_CREATIVE * req.count
    bal = await check_balance(user_id, min_credits=total_credits)
    if not bal["ok"]:
        raise HTTPException(status_code=402, detail=f"Not enough credits. Need {total_credits}.")

    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    copy = await _generate_copy(req, api_key, user_id=user_id)
    logger.info(f"Generated copy: {copy}")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(IMAGE_MODEL)

    user_image_data = await _resolve_image(req.user_image_url) if req.user_image_url else None

    async def _gen_one(idx: int) -> dict:
        prompt = _build_creative_prompt(req, copy, idx, has_user_image=user_image_data is not None)

        parts = [prompt]
        if user_image_data:
            parts.append({"mime_type": user_image_data["mime"], "data": user_image_data["data"]})

        last_err = None
        for attempt in range(3):
            try:
                resp = await asyncio.to_thread(
                    model.generate_content, parts,
                    generation_config={"temperature": 0.7}
                )
                img_b64 = _extract_image(resp, req.aspect_ratio)
                if img_b64:
                    try:
                        await record_usage(
                            user_id=user_id, service_type="creative_generation",
                            input_tokens=0, output_tokens=0, total_tokens=0,
                            model_name=IMAGE_MODEL, metadata={"idx": idx + 1},
                        )
                    except Exception:
                        pass
                    return {"url": img_b64, "index": idx, "headline": copy["headline"], "subheadline": copy["subheadline"]}
                last_err = "No image in response"
            except Exception as e:
                last_err = str(e)
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))

        logger.error(f"Creative {idx+1} failed: {last_err}")
        return {"url": f"https://placehold.co/{req.aspect_ratio}/8B5CF6/white?text=Error&font=roboto", "index": idx, "error": last_err}

    tasks = [_gen_one(i) for i in range(req.count)]
    results = await asyncio.gather(*tasks)

    return {
        "creatives": sorted(results, key=lambda r: r["index"]),
        "copy": copy,
    }


STYLE_GUIDES = {
    "modern": "Clean sans-serif typography, soft shadows, subtle gradients, sleek and professional feel",
    "minimal": "Lots of whitespace, thin elegant fonts, muted colors, understated luxury",
    "bold": "Heavy bold typography, high contrast colors, dynamic angles, attention-grabbing impact",
    "luxury": "Gold/dark tones, serif typography, marble/silk textures, premium feel",
    "playful": "Rounded fonts, bright cheerful colors, fun shapes and patterns, energetic mood",
}

BACKGROUND_GUIDES = {
    "sand": "natural sand texture, warm beige tones, organic feel",
    "marble": "white/grey marble surface, luxury elegant texture",
    "fabric": "soft fabric/linen texture, tactile warm feel",
    "gradient": "smooth modern gradient background, professional",
    "solid": "clean solid color background, minimal",
    "nature": "natural elements (leaves, wood), organic and fresh",
}


def _build_creative_prompt(req: CreativeRequest, copy: dict, variation_idx: int, has_user_image: bool = False) -> str:
    lang_name = LANG_NAMES.get(req.language, "English")
    text_dir = "right-to-left" if req.language == "he" else "left-to-right"
    w, h = map(int, req.aspect_ratio.split("x"))
    ar_map = {"1080x1080": "1:1", "1080x1350": "4:5", "1080x1920": "9:16", "1200x628": "16:9"}
    ar = ar_map.get(req.aspect_ratio, f"{w}:{h}")

    size_comp = {
        "1080x1080": "Square 1:1 canvas. Center the composition symmetrically.",
        "1080x1350": "Portrait 4:5 canvas. Vertical layout — headline top, product center, CTA bottom.",
        "1080x1920": "Story 9:16 canvas. Tall vertical — stack elements top to bottom with generous spacing.",
        "1200x628": "Landscape 16:9 canvas. Wide layout — product left, text block right (or vice versa).",
    }.get(req.aspect_ratio, "Balanced composition.")

    style_desc = STYLE_GUIDES.get(req.style, STYLE_GUIDES["modern"])
    bg_desc = BACKGROUND_GUIDES.get(req.background_style or "", "choose the best background that complements the product and style")
    colors = ", ".join(req.brand_colors[:4]) if req.brand_colors else "choose a professional harmonious palette"

    variation_twists = [
        "Use the headline as the dominant visual element with a bold layout",
        "Lead with the product/visual, headline wraps around it",
        "Split composition: image on one side, text block on the other",
        "Full-bleed background texture with centered text overlay",
    ]
    twist = variation_twists[variation_idx % len(variation_twists)]

    logo_instruction = ""
    if req.brand_name:
        logo_instruction = f'Place the brand name "{req.brand_name}" in the top-left corner as a small, elegant text logo.'

    image_instruction = ""
    if has_user_image:
        image_instruction = f"""USER-PROVIDED IMAGE:
I have attached a product/reference image. You MUST incorporate this image prominently into the ad creative.
The attached image should be the main visual — integrate it naturally into the design.
Product context: {req.product_description}"""
    elif req.product_description:
        image_instruction = f"""PRODUCT VISUAL:
The main visual focus should be a realistic, premium-looking depiction of: {req.product_description}
Make the product the hero of the composition."""

    return f"""You are an elite advertising art director at a top creative agency. Create a SINGLE, COMPLETE, READY-TO-PUBLISH ad creative image.

DESIGN BRIEF:
- Headline: "{copy['headline']}"
- Subheadline: "{copy['subheadline']}"
- CTA Button: "{req.cta_text}"
{f'- Brand: "{req.brand_name}"' if req.brand_name else ''}

STYLE DIRECTION: {style_desc}
BACKGROUND: {bg_desc}
COLOR PALETTE: {colors}
ASPECT RATIO: {ar} ({req.aspect_ratio}px)
COMPOSITION: {size_comp}

{logo_instruction}

{image_instruction}

LAYOUT DIRECTION FOR THIS VARIATION: {twist}

MANDATORY DESIGN STRUCTURE (follow this exactly):
1. TOP-LEFT: Brand name/logo — small, subtle, professional
2. HEADLINE: Large, bold, impossible to miss — clear visual hierarchy
3. SUBHEADLINE: Smaller supporting text below headline
4. PRODUCT/VISUAL: Central focus element that draws the eye
5. CTA BUTTON: Bold rectangular button at the bottom with the CTA text, high contrast
6. BACKGROUND: Clean/textured background ({bg_desc}) — NO clutter

TYPOGRAPHY RULES:
- Maximum 2 font styles (bold headline + clean body)
- Headline font size must be at least 3x the subheadline size
- All text must have excellent contrast and be instantly readable
- Text language: {lang_name}. Text direction: {text_dir}. Render all text correctly in {lang_name}.

CRITICAL QUALITY STANDARDS:
- This must look like a $5,000+ agency-produced ad creative
- Professional spacing, alignment, and visual balance
- The CTA button must look clickable and prominent
- Maximum 25 words total on the entire image
- SAFE MARGINS: Keep ALL text and important elements at least 10% away from every edge. Nothing should be cropped or cut off.
- The entire composition must fit WITHIN the {ar} canvas. Do NOT let text or visuals bleed off-frame.

ABSOLUTELY FORBIDDEN:
- No "Option A/B/C" labels
- No resolution text or dimensions on the image
- No platform names or meta-commentary
- No watermarks

Generate ONE complete ad creative image at {ar} aspect ratio."""


def _dominant_edge_color(img: PILImage.Image) -> tuple:
    """Sample pixels along all 4 edges to find the most common color for padding."""
    pixels = []
    w, h = img.size
    for x in range(w):
        pixels.append(img.getpixel((x, 0)))
        pixels.append(img.getpixel((x, h - 1)))
    for y in range(h):
        pixels.append(img.getpixel((0, y)))
        pixels.append(img.getpixel((w - 1, y)))
    rgb_pixels = [(p[0], p[1], p[2]) if isinstance(p, tuple) else (p, p, p) for p in pixels]
    avg_r = sum(p[0] for p in rgb_pixels) // len(rgb_pixels)
    avg_g = sum(p[1] for p in rgb_pixels) // len(rgb_pixels)
    avg_b = sum(p[2] for p in rgb_pixels) // len(rgb_pixels)
    return (avg_r, avg_g, avg_b)


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
                img = PILImage.open(io.BytesIO(raw))
            except Exception:
                continue

            w, h = map(int, image_size.split("x"))
            target_ratio = w / h
            api_ratio = img.width / img.height

            if abs(api_ratio - target_ratio) > 0.05:
                if api_ratio > target_ratio:
                    new_w = int(img.height * target_ratio)
                    crop_pct = (img.width - new_w) / img.width
                    if crop_pct <= 0.25:
                        left = (img.width - new_w) // 2
                        img = img.crop((left, 0, left + new_w, img.height))
                    else:
                        img.thumbnail((w, h), PILImage.Resampling.LANCZOS)
                        bg_color = _dominant_edge_color(img)
                        canvas = PILImage.new("RGB", (w, h), bg_color)
                        canvas.paste(img, ((w - img.width) // 2, (h - img.height) // 2))
                        img = canvas
                else:
                    new_h = int(img.width / target_ratio)
                    crop_pct = (img.height - new_h) / img.height
                    if crop_pct <= 0.25:
                        top = (img.height - new_h) // 2
                        img = img.crop((0, top, img.width, top + new_h))
                    else:
                        img.thumbnail((w, h), PILImage.Resampling.LANCZOS)
                        bg_color = _dominant_edge_color(img)
                        canvas = PILImage.new("RGB", (w, h), bg_color)
                        canvas.paste(img, ((w - img.width) // 2, (h - img.height) // 2))
                        img = canvas

            img = img.resize((w, h), PILImage.Resampling.LANCZOS)

            if img.mode in ("RGBA", "LA", "P"):
                bg = PILImage.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                img = bg

            out = io.BytesIO()
            img.save(out, format="JPEG", quality=92, optimize=True)
            return f"data:image/jpeg;base64,{base64.b64encode(out.getvalue()).decode()}"

    return None
