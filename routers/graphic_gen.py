"""
Graphic Text Overlay — adds text on top of an existing image.
Step 1: User generates/uploads an image.
Step 2: This endpoint overlays text onto it using Gemini.
"""
from fastapi import APIRouter, HTTPException, Depends
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


class TextOverlayRequest(BaseModel):
    image: str  # base64 data URI or URL of the source image
    text_on_image: str
    style: str = "modern"
    brand_colors: list[str] = []
    brand_name: str = ""


@router.post("/add-text")
async def add_text_overlay(request: TextOverlayRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    bal = await check_balance(user_id, min_credits=80.0)
    if not bal["ok"]:
        raise HTTPException(status_code=402, detail=f"Not enough credits. You have {bal['remaining']:.0f}, need 80.")

    if not request.text_on_image.strip():
        raise HTTPException(status_code=400, detail="text_on_image is required")

    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_AI_API_KEY not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(MODEL_NAME)

    img_part = await _load_image(request.image)
    if not img_part:
        raise HTTPException(status_code=400, detail="Could not load source image")

    prompt = _build_overlay_prompt(request)
    content = [img_part, prompt]

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
            logger.warning(f"Text overlay attempt {attempt+1} failed: {e}")
            if attempt < 2:
                await asyncio.sleep(2 * (attempt + 1))

    if last_error or response is None:
        raise HTTPException(status_code=500, detail=f"Text overlay failed: {last_error}")

    try:
        in_t = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        out_t = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        await record_usage(user_id=user_id, service_type="image_generation", input_tokens=in_t, output_tokens=out_t,
                           model_name=MODEL_NAME, metadata={"type": "text_overlay"})
    except Exception as e:
        logger.warning(f"Failed to record usage: {e}")

    image_b64 = _extract_image(response)
    if not image_b64:
        raise HTTPException(status_code=500, detail="No image generated")

    return {"image_url": image_b64}


def _build_overlay_prompt(req: TextOverlayRequest) -> str:
    color_hint = f"Use these brand colors for the text/accents: {', '.join(req.brand_colors[:4])}." if req.brand_colors else ""
    brand_hint = f'This is for brand "{req.brand_name}".' if req.brand_name else ""

    style_map = {
        "modern": "Clean sans-serif typography, subtle gradient or frosted overlay behind text",
        "bold": "Large bold impactful text, high contrast, uppercase, strong drop shadow",
        "minimal": "Thin elegant font, lots of breathing room, subtle text placement",
        "elegant": "Serif typography, dark overlay band, gold/white text, luxurious feel",
        "playful": "Fun rounded font, colorful text with outline/shadow, energetic placement",
    }
    style_desc = style_map.get(req.style, style_map["modern"])

    return f"""The user has provided an IMAGE above. Your job is to add TEXT on top of this image to create a professional marketing/advertising visual.

TEXT TO ADD:
"{req.text_on_image}"

{brand_hint} {color_hint}

TYPOGRAPHY STYLE: {style_desc}

CRITICAL RULES:
- Keep the original image as the background — do NOT regenerate or significantly alter the photo
- Add the text "{req.text_on_image}" as a clear, readable overlay
- Ensure high contrast between text and background (use overlay bands, shadows, or gradients as needed)
- Position text for maximum visual impact and readability
- The result should look like a professional social media ad or marketing banner
- Text must be the HERO element — prominent, well-sized, properly spaced
- Maintain the original image's composition and quality"""


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
        logger.warning(f"Failed to load image: {e}")
        return None


def _extract_image(response) -> str | None:
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

            if img.mode in ('RGBA', 'LA', 'P'):
                bg = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = bg

            out = io.BytesIO()
            img.save(out, format='JPEG', quality=90, optimize=True)
            return f"data:image/jpeg;base64,{base64.b64encode(out.getvalue()).decode()}"

    return None
