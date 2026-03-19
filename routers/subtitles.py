"""
Subtitle generation for videos.
Flow: download MP4 -> ElevenLabs STT -> SRT -> FFmpeg burn-in -> upload -> return URL
"""
import asyncio
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

CREDITS_PER_SUBTITLE = 50


class AddSubtitlesRequest(BaseModel):
    video_url: str
    language: str = "he"   # "he" for Hebrew, "en" for English


@router.post("/add-subtitles")
async def add_subtitles(request: AddSubtitlesRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]

    bal = await check_balance(user_id, min_credits=CREDITS_PER_SUBTITLE)
    if not bal["ok"]:
        raise HTTPException(status_code=402, detail=f"Not enough credits. Need {CREDITS_PER_SUBTITLE}.")

    el_key = os.getenv("ELEVENLABS_API_KEY")
    if not el_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured")

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, "input.mp4")
        srt_path   = os.path.join(tmpdir, "subtitles.srt")
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

        # 2. Transcribe with ElevenLabs Speech-to-Text
        logger.info(f"🎙️ Transcribing with ElevenLabs STT (language={request.language})")
        try:
            srt_content = await _elevenlabs_to_srt(input_path, el_key, request.language)
        except Exception as e:
            logger.error(f"❌ ElevenLabs STT failed: {e}")
            raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

        if not srt_content.strip():
            raise HTTPException(status_code=422, detail="No speech detected in the video")

        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(srt_content)
        logger.info(f"✅ SRT generated ({len(srt_content)} chars)")

        # 3. Burn subtitles into video with FFmpeg
        logger.info("🔥 Burning subtitles with FFmpeg")
        try:
            await _burn_subtitles(input_path, srt_path, output_path, request.language)
        except Exception as e:
            logger.error(f"❌ FFmpeg failed: {e}")
            raise HTTPException(status_code=500, detail=f"Subtitle burn-in failed: {e}")

        # 4. Upload to Supabase
        logger.info("☁️ Uploading subtitled video")
        try:
            with open(output_path, "rb") as f:
                video_bytes = f.read()
            result_url = await _upload_video(video_bytes, user_id)
        except Exception as e:
            logger.error(f"❌ Upload failed: {e}")
            raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    try:
        await record_usage(
            user_id=user_id, service_type="subtitle_generation",
            input_tokens=0, output_tokens=0, total_tokens=0,
            model_name="elevenlabs-scribe", metadata={"language": request.language}
        )
    except Exception as e:
        logger.warning(f"Failed to record usage: {e}")

    logger.info(f"✅ Subtitled video ready: {result_url[:80]}")
    return {"video_url": result_url}


async def _elevenlabs_to_srt(video_path: str, api_key: str, language: str) -> str:
    """Transcribe via ElevenLabs Scribe and convert word timestamps to SRT."""
    with open(video_path, "rb") as f:
        video_data = f.read()

    payload: dict = {
        "model_id": "scribe_v1",
        "timestamps_granularity": "word",
    }
    if language:
        payload["language_code"] = language

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": api_key},
            files={"file": ("video.mp4", video_data, "video/mp4")},
            data=payload,
        )

    if response.status_code != 200:
        raise Exception(f"ElevenLabs STT returned {response.status_code}: {response.text[:300]}")

    data = response.json()
    words = data.get("words", [])
    if not words:
        # Fallback: use full text as single block
        text = data.get("text", "").strip()
        if not text:
            return ""
        return "1\n00:00:00,000 --> 00:00:30,000\n" + text + "\n"

    return _words_to_srt(words)


def _words_to_srt(words: list) -> str:
    """Group word-level timestamps into subtitle lines (~5 words / 3s max per block)."""
    lines = []
    block: list = []
    block_start: float = 0.0
    block_end: float = 0.0
    idx = 1

    for w in words:
        if w.get("type") == "spacing":
            continue
        start = float(w.get("start", 0))
        end   = float(w.get("end", start + 0.3))
        text  = w.get("text", "").strip()
        if not text:
            continue

        if not block:
            block_start = start

        block.append(text)
        block_end = end

        # Break into a new subtitle every 5 words or 3 seconds
        if len(block) >= 5 or (block_end - block_start) >= 3.0:
            lines.append(_srt_block(idx, block_start, block_end, " ".join(block)))
            idx += 1
            block = []

    if block:
        lines.append(_srt_block(idx, block_start, block_end, " ".join(block)))

    return "\n".join(lines)


def _srt_block(idx: int, start: float, end: float, text: str) -> str:
    return f"{idx}\n{_ts(start)} --> {_ts(end)}\n{text}\n"


def _ts(sec: float) -> str:
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int((sec - int(sec)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


async def _burn_subtitles(input_path: str, srt_path: str, output_path: str, language: str) -> None:
    """Use FFmpeg to burn SRT subtitles into the video."""
    force_style = (
        "FontSize=18,Bold=1,"
        "PrimaryColour=&Hffffff,OutlineColour=&H000000,"
        "BackColour=&H80000000,BorderStyle=4,Outline=2,Shadow=0,Alignment=2"
    )
    # FFmpeg needs forward slashes even on Windows
    srt_safe = srt_path.replace("\\", "/").replace(":", "\\:")

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", f"subtitles='{srt_safe}':force_style='{force_style}'",
        "-c:a", "copy",
        "-preset", "fast",
        output_path,
    ]

    result = await asyncio.to_thread(subprocess.run, cmd, capture_output=True, text=True)

    if result.returncode != 0:
        raise Exception(f"FFmpeg error: {result.stderr[-500:]}")


async def _upload_video(video_bytes: bytes, user_id: str) -> str:
    """Upload to Supabase storage and return public URL."""
    supabase = get_supabase()
    filename = f"subtitled/{user_id}/{uuid.uuid4().hex}.mp4"
    bucket = "posts"

    try:
        supabase.storage.from_(bucket).upload(
            path=filename, file=video_bytes,
            file_options={"content-type": "video/mp4", "upsert": "true"},
        )
    except Exception:
        bucket = "products"
        supabase.storage.from_(bucket).upload(
            path=filename, file=video_bytes,
            file_options={"content-type": "video/mp4", "upsert": "true"},
        )

    return supabase.storage.from_(bucket).get_public_url(filename)
