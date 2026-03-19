"""
Subtitle generation for videos.
Flow: download MP4 -> Whisper transcription -> SRT -> FFmpeg burn-in -> upload -> return URL
"""
import asyncio
import base64
import io
import logging
import os
import subprocess
import tempfile
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database.supabase_client import get_supabase
from middleware.auth import get_current_user
from services.credits_service import check_balance, record_usage

router = APIRouter(prefix="/api/video-gen", tags=["subtitles"])
logger = logging.getLogger(__name__)

WHISPER_COST_PER_MINUTE = 0.006  # USD — OpenAI Whisper pricing
CREDITS_PER_SUBTITLE = 50        # flat fee for the feature


class AddSubtitlesRequest(BaseModel):
    video_url: str
    language: str = "en"   # "he" for Hebrew, "en" for English


@router.post("/add-subtitles")
async def add_subtitles(request: AddSubtitlesRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]

    bal = await check_balance(user_id, min_credits=CREDITS_PER_SUBTITLE)
    if not bal["ok"]:
        raise HTTPException(status_code=402, detail=f"Not enough credits. Need {CREDITS_PER_SUBTITLE}.")

    if not request.video_url:
        raise HTTPException(status_code=400, detail="video_url is required")

    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.mp4")
        srt_path = os.path.join(tmpdir, "subtitles.srt")
        output_path = os.path.join(tmpdir, "output.mp4")

        # 1. Download the video
        logger.info(f"⬇️ Downloading video: {request.video_url[:80]}")
        try:
            async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
                resp = await client.get(request.video_url)
                if resp.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"Could not download video: HTTP {resp.status_code}")
                with open(input_path, "wb") as f:
                    f.write(resp.content)
            logger.info(f"✅ Downloaded {len(resp.content) / 1024:.1f} KB")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to download video: {e}")

        # 2. Transcribe with Whisper
        logger.info(f"🎙️ Transcribing with Whisper (language={request.language})")
        try:
            srt_content = await _transcribe_to_srt(input_path, openai_key, request.language)
        except Exception as e:
            logger.error(f"❌ Whisper transcription failed: {e}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

        if not srt_content.strip():
            raise HTTPException(status_code=422, detail="No speech detected in the video")

        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
        logger.info(f"✅ SRT generated ({len(srt_content)} chars)")

        # 3. Burn subtitles into video with FFmpeg
        logger.info("🔥 Burning subtitles into video with FFmpeg")
        try:
            await _burn_subtitles(input_path, srt_path, output_path, request.language)
        except Exception as e:
            logger.error(f"❌ FFmpeg failed: {e}")
            raise HTTPException(status_code=500, detail=f"Subtitle burn-in failed: {e}")

        # 4. Upload result to Supabase storage
        logger.info("☁️ Uploading subtitled video to storage")
        try:
            with open(output_path, "rb") as f:
                video_bytes = f.read()
            result_url = await _upload_video(video_bytes, user_id)
        except Exception as e:
            logger.error(f"❌ Upload failed: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    # 5. Charge credits
    try:
        await record_usage(
            user_id=user_id, service_type="subtitle_generation",
            input_tokens=0, output_tokens=0, total_tokens=0,
            model_name="whisper-1", metadata={"language": request.language}
        )
    except Exception as e:
        logger.warning(f"Failed to record subtitle usage: {e}")

    logger.info(f"✅ Subtitled video ready: {result_url[:80]}")
    return {"video_url": result_url}


async def _transcribe_to_srt(video_path: str, api_key: str, language: str) -> str:
    """Call OpenAI Whisper API and return SRT-formatted subtitles."""
    whisper_lang = "he" if language.lower().startswith("he") else "en"

    async with httpx.AsyncClient(timeout=300.0) as client:
        with open(video_path, "rb") as f:
            video_data = f.read()

        response = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": ("video.mp4", video_data, "video/mp4")},
            data={
                "model": "whisper-1",
                "response_format": "srt",
                "language": whisper_lang,
            },
        )

    if response.status_code != 200:
        raise Exception(f"Whisper API returned {response.status_code}: {response.text[:200]}")

    return response.text


async def _burn_subtitles(input_path: str, srt_path: str, output_path: str, language: str) -> None:
    """Use FFmpeg to burn SRT subtitles into the video."""
    # For Hebrew we force right-to-left alignment
    alignment = "Alignment=2" if not language.lower().startswith("he") else "Alignment=2"
    force_style = (
        f"FontSize=18,Bold=1,PrimaryColour=&Hffffff,OutlineColour=&H000000,"
        f"BackColour=&H80000000,BorderStyle=4,Outline=2,Shadow=0,{alignment}"
    )

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", f"subtitles={srt_path}:force_style='{force_style}'",
        "-c:a", "copy",
        "-preset", "fast",
        output_path,
    ]

    result = await asyncio.to_thread(
        subprocess.run, cmd, capture_output=True, text=True
    )

    if result.returncode != 0:
        raise Exception(f"FFmpeg error: {result.stderr[-500:]}")


async def _upload_video(video_bytes: bytes, user_id: str) -> str:
    """Upload processed video to Supabase storage and return public URL."""
    supabase = get_supabase()
    filename = f"subtitled/{user_id}/{uuid.uuid4().hex}.mp4"
    bucket = "posts"

    try:
        supabase.storage.from_(bucket).upload(
            path=filename,
            file=video_bytes,
            file_options={"content-type": "video/mp4", "upsert": "true"},
        )
    except Exception:
        bucket = "products"
        supabase.storage.from_(bucket).upload(
            path=filename,
            file=video_bytes,
            file_options={"content-type": "video/mp4", "upsert": "true"},
        )

    return supabase.storage.from_(bucket).get_public_url(filename)
