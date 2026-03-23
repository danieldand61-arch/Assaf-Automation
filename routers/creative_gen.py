"""
Generate Creative — produces professional ad images with embedded graphic text.
Structured prompts enforce: logo placement, headline hierarchy, product focus, CTA button, clean backgrounds.
"""
import asyncio
import base64
import io
import logging
import os
from typing import List, Optional

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from PIL import Image
from pydantic import BaseModel

from middleware.auth import get_current_user
from services.credits_service import check_balance, record_usage

router = APIRouter(prefix="/api/creative", tags=["creative"])
logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-3.1-flash-image-preview"
CREDITS_PER_CREATIVE = 30


class CreativeRequest(BaseModel):
    headline: str
    subheadline: Optional[str] = None
    cta_text: str = "Shop Now"
    product_description: Optional[str] = None
    brand_name: Optional[str] = None
    brand_colors: Optional[List[str]] = None
    logo_url: Optional[str] = None
    style: str = "modern"  # modern, minimal, bold, luxury, playful
    aspect_ratio: str = "1080x1080"
    include_product_image: bool = True
    background_style: Optional[str] = None  # sand, marble, fabric, gradient, etc.
    count: int = 2


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

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL_NAME)

    async def _gen_one(idx: int) -> dict:
        prompt = _build_creative_prompt(req, idx)
        last_err = None
        for attempt in range(3):
            try:
                resp = await asyncio.to_thread(
                    model.generate_content, prompt,
                    generation_config={"temperature": 0.7 + idx * 0.05}
                )
                img_b64 = _extract_image(resp, req.aspect_ratio)
                if img_b64:
                    try:
                        await record_usage(
                            user_id=user_id, service_type="creative_generation",
                            input_tokens=0, output_tokens=0, total_tokens=0,
                            model_name=MODEL_NAME, metadata={"idx": idx + 1},
                        )
                    except Exception:
                        pass
                    return {"url": img_b64, "index": idx}
                last_err = "No image in response"
            except Exception as e:
                last_err = str(e)
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))

        logger.error(f"Creative {idx+1} failed: {last_err}")
        return {"url": f"https://placehold.co/{req.aspect_ratio}/8B5CF6/white?text=Error&font=roboto", "index": idx, "error": last_err}

    tasks = [_gen_one(i) for i in range(req.count)]
    results = await asyncio.gather(*tasks)

    return {"creatives": sorted(results, key=lambda r: r["index"])}


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


def _build_creative_prompt(req: CreativeRequest, variation_idx: int) -> str:
    w, h = map(int, req.aspect_ratio.split("x"))
    ar = f"{w}:{h}" if w == h else ("4:5" if h > w else "16:9")

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

    product_instruction = ""
    if req.include_product_image and req.product_description:
        product_instruction = f"""PRODUCT VISUAL:
The main visual focus should be a realistic, premium-looking depiction of: {req.product_description}
Make the product the hero of the composition — it should be the first thing the eye is drawn to.
The product should look photorealistic and professionally shot/styled."""

    return f"""You are an elite advertising art director at a top creative agency. Create a SINGLE, COMPLETE, READY-TO-PUBLISH ad creative image.

DESIGN BRIEF:
- Headline: "{req.headline}"
{f'- Subheadline: "{req.subheadline}"' if req.subheadline else ''}
- CTA Button: "{req.cta_text}"
{f'- Brand: "{req.brand_name}"' if req.brand_name else ''}

STYLE DIRECTION: {style_desc}
BACKGROUND: {bg_desc}
COLOR PALETTE: {colors}
ASPECT RATIO: {ar} ({req.aspect_ratio}px)

{logo_instruction}

{product_instruction}

LAYOUT DIRECTION FOR THIS VARIATION: {twist}

MANDATORY DESIGN STRUCTURE (follow this exactly):
1. TOP-LEFT: Brand name/logo — small, subtle, professional
2. HEADLINE: Large, bold, impossible to miss — clear visual hierarchy
3. SUBHEADLINE (if provided): Smaller supporting text below headline
4. PRODUCT/VISUAL: Central focus element that draws the eye
5. CTA BUTTON: Bold rectangular button at the bottom with the CTA text, high contrast
6. BACKGROUND: Clean/textured background ({bg_desc}) — NO clutter

TYPOGRAPHY RULES:
- Maximum 2 font styles (bold headline + clean body)
- Headline font size must be at least 3x the subheadline size
- All text must have excellent contrast and be instantly readable
- Text alignment should feel intentional and designed

CRITICAL QUALITY STANDARDS:
- This must look like a $5,000+ agency-produced ad creative
- Professional spacing, alignment, and visual balance
- NO pixelation, NO amateur layout, NO cluttered composition
- The CTA button must look clickable and prominent
- Maximum 25 words total on the entire image

ABSOLUTELY FORBIDDEN:
- No "Option A/B/C" labels
- No resolution text or dimensions on the image
- No platform names
- No meta-commentary
- No watermarks
- No stock photo aesthetics — this is DESIGNED, not photographed (unless product requires it)

Generate ONE complete ad creative image at {ar} aspect ratio."""


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
            img.save(out, format="JPEG", quality=92, optimize=True)
            return f"data:image/jpeg;base64,{base64.b64encode(out.getvalue()).decode()}"

    return None
