"""
Graphic Text Image Generator — separate pipeline for images WITH text overlay.
Uses Gemini with a minimal prompt (no "NO TEXT" rule) to generate ad-style visuals.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
import google.generativeai as genai
import asyncio
import base64
import httpx
import io
import logging
import os
from PIL import Image
from middleware.auth import get_current_user
from services.credits_service import check_balance, record_usage

router = APIRouter(prefix="/api/graphic", tags=["graphic_gen"])
logger = logging.getLogger(__name__)

MODEL_NAME = "gemini-3.1-flash-image-preview"


class GraphicRequest(BaseModel):
    text_on_image: str
    description: str = ""
    image_size: str = "1080x1080"
    style: str = "modern"  # modern, bold, minimal, elegant, playful
    brand_colors: list[str] = []
    brand_name: str = ""
    reference_image: Optional[str] = None  # base64 data URI or URL — overlay text on this


@router.post("/generate")
async def generate_graphic(request: GraphicRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    bal = await check_balance(user_id, min_credits=80.0)
    if not bal["ok"]:
        raise HTTPException(status_code=402, detail=f"Not enough credits. You have {bal['remaining']:.0f}, need 80.")

    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_AI_API_KEY not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL_NAME)

    prompt = _build_graphic_prompt(request)
    content = []

    if request.reference_image:
        ref_part = await _load_image(request.reference_image)
        if ref_part:
            content.append(ref_part)

    content.append(prompt)

    last_error = None
    response = None
    for attempt in range(3):
        try:
            response = await asyncio.to_thread(
                model.generate_content, content, generation_config={"temperature": 0.4}
            )
            last_error = None
            break
        except Exception as e:
            last_error = e
            logger.warning(f"Graphic gen attempt {attempt+1} failed: {e}")
            if attempt < 2:
                await asyncio.sleep(2 * (attempt + 1))

    if last_error or response is None:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {last_error}")

    try:
        in_t = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        out_t = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        await record_usage(user_id=user_id, service_type="image_generation", input_tokens=in_t, output_tokens=out_t,
                           model_name=MODEL_NAME, metadata={"type": "graphic_text", "size": request.image_size})
    except Exception as e:
        logger.warning(f"Failed to record graphic usage: {e}")

    image_b64 = _extract_image(response, request.image_size)
    if not image_b64:
        raise HTTPException(status_code=500, detail="No image generated")

    return {"image_url": image_b64}


def _build_graphic_prompt(req: GraphicRequest) -> str:
    color_hint = f"Use these brand colors: {', '.join(req.brand_colors[:4])}." if req.brand_colors else ""
    brand_hint = f'Brand: "{req.brand_name}".' if req.brand_name else ""

    w, h = map(int, req.image_size.split('x'))
    if w == h:
        ratio = "square 1:1"
    elif w > h:
        ratio = "landscape 16:9"
    else:
        ratio = "portrait 9:16"

    style_map = {
        "modern": "Clean modern design with geometric shapes, gradient backgrounds, and sans-serif typography",
        "bold": "Bold high-contrast design with large impactful text, strong colors, and dynamic layout",
        "minimal": "Minimalist design with lots of white space, thin fonts, subtle colors",
        "elegant": "Elegant premium design with serif fonts, dark/gold palette, luxurious feel",
        "playful": "Playful colorful design with rounded shapes, bright gradients, fun casual fonts",
    }
    style_desc = style_map.get(req.style, style_map["modern"])

    if req.reference_image:
        return f"""The user has provided a BACKGROUND IMAGE above. Generate a new image that uses this photo as the background and overlays the following text on it in a professional, readable way.

TEXT TO DISPLAY ON THE IMAGE:
"{req.text_on_image}"

{f'Additional context: {req.description}' if req.description else ''}
{brand_hint} {color_hint}

DESIGN RULES:
- The text MUST be clearly readable against the background
- Add a semi-transparent overlay, gradient, or text shadow to ensure contrast
- {style_desc}
- Professional marketing/advertising quality
- {ratio} format
- The text is the HERO element — make it prominent and well-positioned
- Keep the background photo visible but ensure text legibility comes first"""
    else:
        return f"""Generate a professional marketing graphic image with TEXT on it.

TEXT TO DISPLAY ON THE IMAGE:
"{req.text_on_image}"

{f'Context/theme: {req.description}' if req.description else ''}
{brand_hint} {color_hint}

DESIGN STYLE: {style_desc}

REQUIREMENTS:
- {ratio} format
- The text "{req.text_on_image}" MUST be rendered clearly and readably on the image
- Professional advertising/social media graphic quality
- Beautiful background design that complements the text
- Text should be the focal point with proper hierarchy and spacing
- Use appropriate font styling for the design style
- Make it look like a professional designer created it"""


async def _load_image(source: str) -> dict | None:
    try:
        if source.startswith('data:'):
            header, b64 = source.split(',', 1)
            mime = header.split(':')[1].split(';')[0] if ':' in header else 'image/jpeg'
            return {"mime_type": mime, "data": base64.b64decode(b64)}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(source, follow_redirects=True)
            return {"mime_type": resp.headers.get("content-type", "image/jpeg"), "data": resp.content}
    except Exception as e:
        logger.warning(f"Failed to load reference image: {e}")
        return None


def _extract_image(response, image_size: str) -> str | None:
    if not hasattr(response, 'candidates') or not response.candidates:
        return None
    candidate = response.candidates[0]
    if not hasattr(candidate, 'content') or not candidate.content or not candidate.content.parts:
        return None

    for part in candidate.content.parts:
        if hasattr(part, 'inline_data') and part.inline_data:
            raw = part.inline_data.data
            if isinstance(raw, str):
                raw = base64.b64decode(raw)
            elif isinstance(raw, bytes):
                try:
                    decoded = raw[:20].decode('ascii')
                    if decoded.startswith(('iVBOR', '/9j/', 'AAAA')):
                        raw = base64.b64decode(raw)
                except Exception:
                    pass

            try:
                img = Image.open(io.BytesIO(raw))
            except Exception:
                continue

            w, h = map(int, image_size.split('x'))
            target_ratio = w / h
            api_ratio = img.width / img.height

            if abs(api_ratio - target_ratio) > 0.1:
                if api_ratio > target_ratio:
                    nw = int(img.height * target_ratio)
                    left = (img.width - nw) // 2
                    img = img.crop((left, 0, left + nw, img.height))
                else:
                    nh = int(img.width / target_ratio)
                    top = (img.height - nh) // 2
                    img = img.crop((0, top, img.width, top + nh))

            target_dims = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1024, 1024)}
            if w == h:
                tw, th = target_dims["1:1"]
            elif w > h:
                tw, th = target_dims["16:9"]
            else:
                tw, th = target_dims["9:16"]
            img = img.resize((tw, th), Image.Resampling.LANCZOS)

            if img.mode in ('RGBA', 'LA', 'P'):
                bg = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = bg

            out = io.BytesIO()
            img.save(out, format='JPEG', quality=85, optimize=True)
            return f"data:image/jpeg;base64,{base64.b64encode(out.getvalue()).decode()}"

    return None
