"""
Video Translation Router - ElevenLabs Integration
Translates and dubs videos into multiple languages using ElevenLabs API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
import logging
import os
import json
from datetime import datetime
from io import BytesIO

# Use official ElevenLabs SDK
try:
    from elevenlabs.client import ElevenLabs
    ELEVENLABS_SDK_AVAILABLE = True
except ImportError:
    ELEVENLABS_SDK_AVAILABLE = False
    import httpx

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

async def create_dubbing_for_language(video_content: bytes, filename: str, target_lang: str) -> str:
    """
    Create a dubbing project for a specific target language using ElevenLabs SDK
    Returns: dubbing_id
    """
    api_key = get_elevenlabs_api_key()
    
    # Map our language codes to ElevenLabs format (ISO 639-3 codes)
    language_map = {
        "he": "heb",  # Hebrew
        "en": "eng",  # English
        "es": "spa",  # Spanish
        "fr": "fra",  # French
        "pt": "por"   # Portuguese
    }
    
    elevenlabs_lang = language_map.get(target_lang, target_lang)
    
    try:
        logger.info(f"🚀 Creating dubbing: {filename} → {target_lang} ({elevenlabs_lang})")
        
        if ELEVENLABS_SDK_AVAILABLE:
            # Use official SDK (simplified parameters)
            client = ElevenLabs(api_key=api_key)
            
            # Prepare file-like object with name attribute
            file_obj = BytesIO(video_content)
            file_obj.name = filename  # SDK needs .name attribute
            
            # Create dubbing project with minimal required parameters
            # SDK method signature: dub_a_video_or_an_audio_file(file, target_lang, source_lang=None, ...)
            dubbing = client.dubbing.dub_a_video_or_an_audio_file(
                file=file_obj,
                target_lang=elevenlabs_lang,
                source_lang="eng"  # Assume English source (can be made dynamic later)
            )
            
            dubbing_id = dubbing.dubbing_id
            logger.info(f"✅ Dubbing created via SDK: {dubbing_id} for {target_lang}")
            return dubbing_id
            
        else:
            # Fallback to httpx (if SDK not available)
            import httpx
            logger.warning("⚠️ ElevenLabs SDK not available, using httpx fallback")
            
            async with httpx.AsyncClient(timeout=300.0) as http_client:
                # Prepare file-like object
                file_obj = BytesIO(video_content)
                file_obj.name = filename
                
                files = {
                    "file": (filename, file_obj, "video/mp4")
                }
                
                data = {
                    "target_lang": elevenlabs_lang,
                    "source_lang": "eng"  # Assume English source
                }
                
                headers = {"xi-api-key": api_key}
                
                logger.info(f"🔍 API URL: {ELEVENLABS_API_URL}/dubbing")
                
                response = await http_client.post(
                    f"{ELEVENLABS_API_URL}/dubbing",
                    headers=headers,
                    files=files,
                    data=data
                )
                
                logger.info(f"🔍 Response status: {response.status_code}")
                
                if response.status_code not in [200, 201]:
                    error_detail = response.text
                    logger.error(f"❌ Dubbing creation failed: {error_detail}")
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Dubbing failed: {error_detail}"
                    )
                
                result = response.json()
                dubbing_id = result.get("dubbing_id")
                logger.info(f"✅ Dubbing created via httpx: {dubbing_id} for {target_lang}")
                return dubbing_id
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Dubbing error for {target_lang}: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail=f"Dubbing failed for {target_lang}: {str(e)}"
        )

async def check_dubbing_status(dubbing_id: str, target_lang: str) -> dict:
    """
    Check dubbing job status using ElevenLabs SDK
    Returns: {status, target_lang}
    Note: Download URL is provided by separate endpoint
    """
    api_key = get_elevenlabs_api_key()
    
    try:
        if ELEVENLABS_SDK_AVAILABLE:
            # Use official SDK
            client = ElevenLabs(api_key=api_key)
            
            # Get dubbing metadata
            metadata = client.dubbing.get_dubbing_project_metadata(dubbing_id=dubbing_id)
            
            logger.info(f"📊 Dubbing {dubbing_id} status: {metadata.status}")
            
            status_map = {
                "dubbing": "processing",
                "dubbed": "completed",
                "failed": "failed"
            }
            
            status = status_map.get(metadata.status, "processing")
            
            result = {
                "status": status,
                "dubbing_id": dubbing_id,
                "target_lang": target_lang,
                "metadata": {
                    "name": getattr(metadata, "name", ""),
                    "target_languages": getattr(metadata, "target_languages", []),
                }
            }
            
            return result
            
        else:
            # Fallback to httpx
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                headers = {"xi-api-key": api_key}
                
                response = await http_client.get(
                    f"{ELEVENLABS_API_URL}/dubbing/{dubbing_id}",
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
    Upload video and start dubbing to multiple languages using ElevenLabs
    
    Priority languages:
    - he: Hebrew (Alpha - API access only)
    - en: English
    - es: Spanish
    - fr: French
    - pt: Portuguese
    
    Note: ElevenLabs creates one dubbing project per target language
    """
    try:
        # Parse target languages
        langs = [lang.strip() for lang in target_languages.split(",")]
        
        if not langs:
            raise HTTPException(status_code=400, detail="No target languages specified")
        
        logger.info(f"🎬 New dubbing request: {video.filename}")
        logger.info(f"   Target languages: {langs}")
        
        # Read video file once (will be reused for each language)
        video_content = await video.read()
        video_size_mb = len(video_content) / (1024 * 1024)
        logger.info(f"   Video size: {video_size_mb:.2f} MB")
        
        if video_size_mb > 500:  # 500MB limit for ElevenLabs
            raise HTTPException(status_code=400, detail="Video too large (max 500MB)")
        
        # Create a parent job ID to track all dubbing projects
        import uuid
        parent_job_id = str(uuid.uuid4())
        
        # Create separate dubbing project for each target language
        dubbing_ids = {}
        for lang in langs:
            try:
                dubbing_id = await create_dubbing_for_language(
                    video_content, 
                    video.filename, 
                    lang
                )
                dubbing_ids[lang] = dubbing_id
            except Exception as e:
                logger.error(f"❌ Failed to create dubbing for {lang}: {str(e)}")
                # Continue with other languages even if one fails
                dubbing_ids[lang] = None
        
        # Store job info with all dubbing IDs
        job = TranslationJob(
            job_id=parent_job_id,
            status="processing",
            original_video=video.filename,
            target_languages=langs,
            translated_videos=dubbing_ids,  # Store dubbing IDs here
            created_at=datetime.now().isoformat()
        )
        
        translation_jobs[parent_job_id] = job.dict()
        
        successful_count = sum(1 for did in dubbing_ids.values() if did is not None)
        logger.info(f"✅ Dubbing jobs created: {successful_count}/{len(langs)} successful")
        
        return {
            "success": True,
            "job_id": parent_job_id,
            "dubbing_ids": dubbing_ids,
            "message": f"Dubbing started for {successful_count}/{len(langs)} languages",
            "estimated_time": f"{successful_count * 10} minutes"  # ~10 min per language
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Dubbing error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{job_id}")
async def get_translation_status(job_id: str):
    """
    Check dubbing job status and provide download endpoints for completed dubs
    """
    if job_id not in translation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = translation_jobs[job_id]
    dubbing_ids = job.get("translated_videos", {})
    
    # Check status for each language's dubbing project
    completed_count = 0
    failed_count = 0
    download_urls = {}
    
    for lang, dubbing_id in dubbing_ids.items():
        if dubbing_id is None:
            failed_count += 1
            continue
            
        try:
            status_info = await check_dubbing_status(dubbing_id, lang)
            
            if status_info.get("status") == "completed":
                completed_count += 1
                # Provide our API endpoint for download (it will proxy from ElevenLabs)
                download_urls[lang] = f"/api/video/download/{dubbing_id}/{lang}"
            elif status_info.get("status") == "failed":
                failed_count += 1
                
        except Exception as e:
            logger.error(f"❌ Error checking status for {lang}: {str(e)}")
            failed_count += 1
    
    total_count = len(dubbing_ids)
    
    # Determine overall job status
    if completed_count == total_count:
        job["status"] = "completed"
        job["completed_at"] = datetime.now().isoformat()
    elif failed_count == total_count:
        job["status"] = "failed"
        job["error"] = "All dubbing jobs failed"
    elif failed_count > 0 or completed_count > 0:
        job["status"] = "partial"  # Some completed, some failed/processing
    else:
        job["status"] = "processing"
    
    # Store download URLs (our proxy endpoints)
    if download_urls:
        job["download_urls"] = download_urls
    
    translation_jobs[job_id] = job
    
    return {
        **job,
        "progress": {
            "completed": completed_count,
            "failed": failed_count,
            "processing": total_count - completed_count - failed_count,
            "total": total_count
        }
    }

@router.get("/jobs")
async def list_translation_jobs():
    """
    List all translation jobs
    """
    return {
        "jobs": list(translation_jobs.values()),
        "total": len(translation_jobs)
    }

@router.get("/download/{dubbing_id}/{language}")
async def download_dubbed_video(dubbing_id: str, language: str):
    """
    Download dubbed video file from ElevenLabs (proxy endpoint)
    This streams the file from ElevenLabs to the client
    
    Note: ElevenLabs returns the dubbed VIDEO (not just audio) when source was video
    """
    api_key = get_elevenlabs_api_key()
    
    # Map language codes to ElevenLabs format
    language_map = {
        "he": "heb",
        "en": "eng",
        "es": "spa",
        "fr": "fra",
        "pt": "por"
    }
    
    elevenlabs_lang = language_map.get(language, language)
    
    try:
        logger.info(f"📥 Downloading dubbed file: {dubbing_id} / {language} ({elevenlabs_lang})")
        
        # First, check if dubbing is completed
        try:
            status_info = await check_dubbing_status(dubbing_id, language)
            logger.info(f"🔍 Dubbing status: {status_info.get('status')}")
            
            if status_info.get('status') != 'completed':
                raise HTTPException(
                    status_code=400, 
                    detail=f"Dubbing not ready yet. Status: {status_info.get('status')}"
                )
        except Exception as e:
            logger.warning(f"⚠️ Could not check status: {str(e)}")
        
        # Use direct HTTP request to get proper headers and content type
        import httpx
        async with httpx.AsyncClient(timeout=300.0) as http_client:
            headers = {"xi-api-key": api_key}
            
            # ElevenLabs endpoint for getting dubbed file
            url = f"{ELEVENLABS_API_URL}/dubbing/{dubbing_id}/audio/{elevenlabs_lang}"
            logger.info(f"🔍 Downloading from: {url}")
            logger.info(f"🔑 Using API key: {api_key[:10]}...{api_key[-4:]}")
            
            response = await http_client.get(url, headers=headers)
            
            logger.info(f"📊 Response status: {response.status_code}")
            logger.info(f"📊 Response headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"❌ Download failed (status {response.status_code}): {error_detail}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"ElevenLabs API error ({response.status_code}): {error_detail}"
                )
            
            # Log response headers for debugging
            content_type = response.headers.get("content-type", "unknown")
            content_length = response.headers.get("content-length", "unknown")
            logger.info(f"📊 Content-Type: {content_type}")
            logger.info(f"📊 Content-Length: {content_length} bytes")
            
            # Get the full content
            file_content = response.content
            actual_size = len(file_content)
            logger.info(f"✅ Downloaded {actual_size} bytes")
            
            # Check if file is empty
            if actual_size == 0:
                logger.error(f"❌ Downloaded file is empty!")
                raise HTTPException(
                    status_code=500,
                    detail="Downloaded file is empty. Dubbing may not be ready."
                )
            
            if actual_size < 1000:  # Less than 1KB
                logger.warning(f"⚠️ File is suspiciously small: {actual_size} bytes")
                logger.warning(f"⚠️ Content preview: {file_content[:500]}")
            
            # Determine media type from response or default to video/mp4
            media_type = content_type if content_type != "unknown" else "video/mp4"
            
            # Determine file extension
            if "audio" in media_type or "mpeg" in media_type:
                extension = "mp3"
                media_type = "audio/mpeg"
            else:
                extension = "mp4"
                media_type = "video/mp4"
            
            logger.info(f"📦 Serving as: {media_type} (.{extension})")
            
            # Return the file
            return StreamingResponse(
                iter([file_content]),
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="dubbed_{dubbing_id}_{language}.{extension}"',
                    "Content-Length": str(len(file_content))
                }
            )
                    
    except Exception as e:
        logger.error(f"❌ Download error: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

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
        "supported_languages": ["Hebrew (he)", "English (en)", "Spanish (es)", "French (fr)", "Portuguese (pt)"]
    }
