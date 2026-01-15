"""
Video Translation Router - ElevenLabs Integration
Translates and dubs videos into multiple languages using ElevenLabs API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Optional
from pydantic import BaseModel
import logging
import os
import httpx
import json
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/video", tags=["video-translation"])

# ============= Models =============
class TranslationRequest(BaseModel):
    """Request model for video translation"""
    target_languages: List[str]  # ["he", "es", "fr", "pt"]
    video_url: Optional[str] = None  # If video is already uploaded somewhere
    
class TranslationJob(BaseModel):
    """Translation job status"""
    job_id: str
    status: str  # "pending", "processing", "completed", "failed"
    original_video: str
    target_languages: List[str]
    translated_videos: dict  # {"he": "url", "es": "url"}
    created_at: str
    completed_at: Optional[str] = None
    error: Optional[str] = None

# In-memory storage (replace with DB in production)
translation_jobs = {}

# ============= ElevenLabs API Functions =============
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1"

def get_elevenlabs_api_key() -> str:
    """Get ElevenLabs API key from environment"""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500, 
            detail="ELEVENLABS_API_KEY not configured. Please add it to .env"
        )
    return api_key

async def upload_video_to_elevenlabs(video_file: bytes, filename: str) -> str:
    """
    Upload video to ElevenLabs for translation
    Returns: video_id
    """
    api_key = get_elevenlabs_api_key()
    
    try:
        # Large video uploads can take 3-5 minutes (500MB max)
        async with httpx.AsyncClient(timeout=300.0) as client:
            # Upload video to ElevenLabs
            files = {"video": (filename, video_file, "video/mp4")}
            headers = {"xi-api-key": api_key}
            
            logger.info(f"📤 Uploading video to ElevenLabs: {filename}")
            response = await client.post(
                f"{ELEVENLABS_API_URL}/video-translation/upload",
                headers=headers,
                files=files
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"❌ Upload failed: {error_detail}")
                raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs upload failed: {error_detail}")
            
            data = response.json()
            video_id = data.get("video_id")
            logger.info(f"✅ Video uploaded: {video_id}")
            return video_id
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Upload timeout - video too large")
    except Exception as e:
        logger.error(f"❌ Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

async def start_video_translation(video_id: str, target_languages: List[str]) -> str:
    """
    Start video translation job on ElevenLabs
    Returns: job_id
    """
    api_key = get_elevenlabs_api_key()
    
    # Map language codes to ElevenLabs format
    language_map = {
        "he": "Hebrew",  # Hebrew (Alpha - API only)
        "es": "Spanish",
        "fr": "French",
        "pt": "Portuguese",
        "en": "English"
    }
    
    elevenlabs_languages = [language_map.get(lang, lang) for lang in target_languages]
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "xi-api-key": api_key,
                "Content-Type": "application/json"
            }
            
            payload = {
                "video_id": video_id,
                "target_languages": elevenlabs_languages
            }
            
            logger.info(f"🚀 Starting translation: {video_id} → {elevenlabs_languages}")
            response = await client.post(
                f"{ELEVENLABS_API_URL}/video-translation/translate",
                headers=headers,
                json=payload
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"❌ Translation failed: {error_detail}")
                raise HTTPException(status_code=response.status_code, detail=f"Translation start failed: {error_detail}")
            
            data = response.json()
            job_id = data.get("job_id")
            logger.info(f"✅ Translation started: {job_id}")
            return job_id
            
    except Exception as e:
        logger.error(f"❌ Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

async def check_translation_status(job_id: str) -> dict:
    """
    Check translation job status
    Returns: {status, translated_videos: {lang: url}}
    """
    api_key = get_elevenlabs_api_key()
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {"xi-api-key": api_key}
            
            response = await client.get(
                f"{ELEVENLABS_API_URL}/video-translation/status/{job_id}",
                headers=headers
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"❌ Status check failed: {error_detail}")
                return {"status": "failed", "error": error_detail}
            
            data = response.json()
            return data
            
    except Exception as e:
        logger.error(f"❌ Status check error: {str(e)}")
        return {"status": "failed", "error": str(e)}

# ============= API Endpoints =============

@router.post("/translate")
async def translate_video(
    video: UploadFile = File(...),
    target_languages: str = Form(...)  # Comma-separated: "he,es,pt"
):
    """
    Upload video and start translation to multiple languages
    
    Priority languages:
    - he: Hebrew (Alpha - API access only)
    - es: Spanish
    - fr: French
    - pt: Portuguese
    """
    try:
        # Parse target languages
        langs = [lang.strip() for lang in target_languages.split(",")]
        
        if not langs:
            raise HTTPException(status_code=400, detail="No target languages specified")
        
        logger.info(f"🎬 New translation request: {video.filename}")
        logger.info(f"   Target languages: {langs}")
        
        # Read video file
        video_content = await video.read()
        video_size_mb = len(video_content) / (1024 * 1024)
        logger.info(f"   Video size: {video_size_mb:.2f} MB")
        
        if video_size_mb > 500:  # 500MB limit
            raise HTTPException(status_code=400, detail="Video too large (max 500MB)")
        
        # Step 1: Upload to ElevenLabs
        video_id = await upload_video_to_elevenlabs(video_content, video.filename)
        
        # Step 2: Start translation
        job_id = await start_video_translation(video_id, langs)
        
        # Store job info
        job = TranslationJob(
            job_id=job_id,
            status="processing",
            original_video=video.filename,
            target_languages=langs,
            translated_videos={},
            created_at=datetime.now().isoformat()
        )
        
        translation_jobs[job_id] = job.dict()
        
        logger.info(f"✅ Translation job created: {job_id}")
        
        return {
            "success": True,
            "job_id": job_id,
            "message": f"Translation started for {len(langs)} languages",
            "estimated_time": f"{len(langs) * 5} minutes"  # Rough estimate
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Translation error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{job_id}")
async def get_translation_status(job_id: str):
    """
    Check translation job status and get download URLs
    """
    if job_id not in translation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Get current status from ElevenLabs
    elevenlabs_status = await check_translation_status(job_id)
    
    # Update local storage
    job = translation_jobs[job_id]
    job["status"] = elevenlabs_status.get("status", "processing")
    
    if elevenlabs_status.get("status") == "completed":
        job["translated_videos"] = elevenlabs_status.get("videos", {})
        job["completed_at"] = datetime.now().isoformat()
    elif elevenlabs_status.get("status") == "failed":
        job["error"] = elevenlabs_status.get("error", "Unknown error")
    
    translation_jobs[job_id] = job
    
    return job

@router.get("/jobs")
async def list_translation_jobs():
    """
    List all translation jobs
    """
    return {
        "jobs": list(translation_jobs.values()),
        "total": len(translation_jobs)
    }

@router.delete("/job/{job_id}")
async def cancel_translation_job(job_id: str):
    """
    Cancel a translation job
    """
    if job_id not in translation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # TODO: Call ElevenLabs API to cancel job
    
    translation_jobs[job_id]["status"] = "cancelled"
    
    return {"success": True, "message": "Job cancelled"}

# ============= Health Check =============
@router.get("/health")
async def video_health():
    """Check if ElevenLabs API is configured"""
    api_key = os.getenv("ELEVENLABS_API_KEY")
    return {
        "status": "healthy",
        "elevenlabs_configured": bool(api_key),
        "supported_languages": ["Hebrew (he)", "Spanish (es)", "French (fr)", "Portuguese (pt)"]
    }
