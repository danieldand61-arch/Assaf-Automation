"""
Video Translation Router - ElevenLabs Integration
Translates and dubs videos into multiple languages using ElevenLabs API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import StreamingResponse
from typing import List, Optional
from pydantic import BaseModel
import logging
import os
import json
from datetime import datetime
from io import BytesIO
from middleware.auth import get_current_user

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

async def create_dubbing_for_language(video_content: bytes, filename: str, target_lang: str, user_id: str = None) -> str:
    """
    Create a dubbing project for a specific target language using ElevenLabs SDK
    Returns: dubbing_id
    """
    api_key = get_elevenlabs_api_key()
    
    # Map our language codes to ElevenLabs format
    # ElevenLabs uses ISO 639-1 codes (2-letter) for most languages
    language_map = {
        "he": "he",   # Hebrew - ⚠️ NOT supported in dubbing API yet
        "en": "en",   # English ✅
        "es": "es",   # Spanish ✅
        "fr": "fr",   # French ✅
        "pt": "pt",   # Portuguese (Brazilian) ✅
        "de": "de",   # German ✅
        "it": "it",   # Italian ✅
        "pl": "pl",   # Polish ✅
        "ru": "ru",   # Russian ✅
        "ar": "ar",   # Arabic ✅
        "zh": "zh",   # Chinese ✅
        "ja": "ja",   # Japanese ✅
        "ko": "ko",   # Korean ✅
        "tr": "tr",   # Turkish ✅
    }
    
    # Check if language is actually supported by dubbing API
    # NOTE: Scribe v2 is for Speech-to-Text (transcription), NOT for dubbing!
    # Hebrew is supported in Scribe v2 for transcription, but NOT in Dubbing API
    UNSUPPORTED_IN_DUBBING = ["he"]  # Hebrew not in dubbing API (only in Scribe v2 STT)
    if target_lang in UNSUPPORTED_IN_DUBBING:
        logger.warning(f"⚠️ {target_lang} is not supported in ElevenLabs Dubbing API")
        logger.warning(f"   Hebrew IS supported in Scribe v2 (Speech-to-Text), but NOT in Dubbing")
        raise HTTPException(
            status_code=400,
            detail=f"Language '{target_lang}' is not supported in ElevenLabs Dubbing API. "
                   f"Supported languages: en, es, fr, pt, de, it, pl, ru, ar, zh, ja, ko, tr. "
                   f"Note: Hebrew is supported in Scribe v2 (Speech-to-Text), but not in video dubbing. "
                   f"For Hebrew dubbing, try: Azure Video Indexer, Google Cloud, or Rask.ai"
        )
    
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
            # For Hebrew and other v3-only languages, try to use highest quality model
            dubbing_params = {
                "file": file_obj,
                "target_lang": elevenlabs_lang,
                "source_lang": "eng",  # Assume English source (can be made dynamic later)
            }
            
            # Try to use highest quality/most comprehensive model for Hebrew
            if target_lang == "he":
                logger.info("🔍 Hebrew requested - attempting with advanced parameters")
                # Note: Some parameters may not be supported by API
                # dubbing_params["model_id"] = "eleven_multilingual_v3"  # If supported
            
            dubbing = client.dubbing.dub_a_video_or_an_audio_file(**dubbing_params)
            
            dubbing_id = dubbing.dubbing_id
            logger.info(f"✅ Dubbing created via SDK: {dubbing_id} for {target_lang}")
            
            # Log dubbing response to check for credit info
            logger.info(f"🔍 Dubbing response type: {type(dubbing)}")
            logger.info(f"🔍 Dubbing response attributes: {dir(dubbing)}")
            if hasattr(dubbing, '__dict__'):
                logger.info(f"🔍 Dubbing response dict: {dubbing.__dict__}")
            
            # Track API usage - for now use video duration estimate
            # ElevenLabs charges per character of source audio (~1 credit per 1000 chars)
            # We'll get exact cost from metadata after completion
            if user_id:
                try:
                    from services.credits_service import record_usage
                    
                    video_size_bytes = len(video_content)
                    video_size_mb = video_size_bytes / (1024 * 1024)
                    
                    # Estimate credits based on video length
                    # ElevenLabs dubbing: ~1000 characters = 1 credit
                    # Rough estimate: 1 minute video = ~150 words = ~1000 chars = 1 credit
                    # For 5MB video (~30-60 seconds), estimate ~1-2 credits
                    estimated_credits = max(1, int(video_size_mb / 3))  # ~1 credit per 3MB
                    
                    await record_usage(
                        user_id=user_id,
                        service_type="video_dubbing",
                        input_tokens=estimated_credits,  # Store estimated credits
                        output_tokens=0,
                        total_tokens=estimated_credits,
                        model_name="elevenlabs_dubbing",
                        metadata={
                            "target_language": target_lang,
                            "filename": filename,
                            "dubbing_id": dubbing_id,
                            "video_size_mb": round(video_size_mb, 2),
                            "estimated_credits": estimated_credits,
                            "note": "Estimated cost - actual cost tracked after completion"
                        }
                    )
                    logger.info(f"✅ Tracked video dubbing: ~{estimated_credits} credits (estimated) for {target_lang}")
                except Exception as e:
                    logger.error(f"❌ Failed to track video dubbing: {e}")
            
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
                
                # Track API usage
                if user_id:
                    try:
                        from services.credits_service import record_usage
                        
                        video_size_bytes = len(video_content)
                        video_size_mb = video_size_bytes / (1024 * 1024)
                        
                        # Estimate credits based on video length
                        estimated_credits = max(1, int(video_size_mb / 3))
                        
                        await record_usage(
                            user_id=user_id,
                            service_type="video_dubbing",
                            input_tokens=estimated_credits,
                            output_tokens=0,
                            total_tokens=estimated_credits,
                            model_name="elevenlabs_dubbing",
                            metadata={
                                "target_language": target_lang,
                                "filename": filename,
                                "dubbing_id": dubbing_id,
                                "video_size_mb": round(video_size_mb, 2),
                                "estimated_credits": estimated_credits
                            }
                        )
                        logger.info(f"✅ Tracked video dubbing: ~{estimated_credits} credits (estimated) for {target_lang}")
                    except Exception as e:
                        logger.error(f"❌ Failed to track video dubbing: {e}")
                
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

async def get_user_subscription_info() -> dict:
    """
    Get ElevenLabs user subscription info including available credits
    """
    api_key = get_elevenlabs_api_key()
    
    try:
        if ELEVENLABS_SDK_AVAILABLE:
            client = ElevenLabs(api_key=api_key)
            subscription = client.user.get_subscription()
            
            logger.info(f"💳 Subscription info: {subscription}")
            logger.info(f"🔍 Subscription attributes: {dir(subscription)}")
            if hasattr(subscription, '__dict__'):
                logger.info(f"🔍 Subscription dict: {subscription.__dict__}")
            
            return {
                "character_count": getattr(subscription, "character_count", 0),
                "character_limit": getattr(subscription, "character_limit", 0),
                "credits_remaining": getattr(subscription, "character_limit", 0) - getattr(subscription, "character_count", 0)
            }
        else:
            import httpx
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                headers = {"xi-api-key": api_key}
                response = await http_client.get(
                    f"{ELEVENLABS_API_URL}/user/subscription",
                    headers=headers
                )
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"💳 Subscription data: {data}")
                    return data
                return {}
    except Exception as e:
        logger.error(f"❌ Failed to get subscription info: {e}")
        return {}

async def check_dubbing_status(dubbing_id: str, target_lang: str) -> dict:
    """
    Check dubbing job status using ElevenLabs SDK
    Returns: {status, target_lang, credits_used (if completed)}
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
            logger.info(f"🔍 Metadata attributes: {dir(metadata)}")
            if hasattr(metadata, '__dict__'):
                logger.info(f"🔍 Metadata dict: {metadata.__dict__}")
            
            status_map = {
                "dubbing": "processing",
                "dubbed": "completed",
                "failed": "failed"
            }
            
            status = status_map.get(metadata.status, "processing")
            
            # Try to get character count (used for billing)
            character_count = getattr(metadata, "character_count", None)
            expected_duration_sec = getattr(metadata, "expected_duration_sec", None)
            
            # Try to get actual cost from metadata
            # ElevenLabs may provide 'cost' or 'credits_used' in metadata
            credits_from_metadata = getattr(metadata, "cost", None) or getattr(metadata, "credits_used", None)
            
            # Fallback: calculate from character count (~1 credit per 1000 characters)
            credits_used = None
            if credits_from_metadata:
                credits_used = float(credits_from_metadata)
                logger.info(f"💰 Dubbing cost from metadata: {credits_used} credits")
            elif character_count:
                credits_used = character_count / 1000.0
                logger.info(f"💰 Dubbing used {character_count} characters = ~{credits_used:.2f} credits (estimated)")
            
            result = {
                "status": status,
                "dubbing_id": dubbing_id,
                "target_lang": target_lang,
                "credits_used": credits_used,
                "metadata": {
                    "name": getattr(metadata, "name", ""),
                    "target_languages": getattr(metadata, "target_languages", []),
                    "character_count": character_count,
                    "duration_sec": expected_duration_sec
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
    target_languages: str = Form(...),  # Comma-separated: "en,es,pt"
    current_user: dict = Depends(get_current_user)
):
    """
    Upload video and start dubbing to multiple languages using ElevenLabs
    
    Cost tracking:
    - Records balance before dubbing
    - After completion, checks balance again to get exact credits used
    
    ✅ Supported languages (Dubbing API):
    - en: English
    - es: Spanish  
    - fr: French
    - pt: Portuguese
    - de: German
    - it: Italian
    - pl: Polish
    - ru: Russian
    - ar: Arabic
    - zh: Chinese
    - ja: Japanese
    - ko: Korean
    - tr: Turkish
    
    ⚠️ Hebrew (he) is NOT supported in Dubbing API yet
    - Hebrew IS available in Text-to-Speech v3 model
    - For Hebrew dubbing, contact ElevenLabs support or use manual workflow
    
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
        
        # Get current credits balance before starting
        balance_before = None
        try:
            sub_info = await get_user_subscription_info()
            balance_before = sub_info.get("credits_remaining")
            logger.info(f"💰 Credits before dubbing: {balance_before}")
        except Exception as e:
            logger.warning(f"⚠️ Could not get balance: {e}")
        
        # Create a parent job ID to track all dubbing projects
        import uuid
        parent_job_id = str(uuid.uuid4())
        
        # Create separate dubbing project for each target language
        dubbing_ids = {}
        user_id = current_user.get("user_id")
        
        for lang in langs:
            try:
                dubbing_id = await create_dubbing_for_language(
                    video_content, 
                    video.filename, 
                    lang,
                    user_id=user_id
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
        
        job_dict = job.dict()
        # Add balance tracking
        if balance_before is not None:
            job_dict["balance_before"] = balance_before
        
        translation_jobs[parent_job_id] = job_dict
        
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
async def get_translation_status(job_id: str, current_user: dict = Depends(get_current_user)):
    """
    Check dubbing job status and provide download endpoints for completed dubs
    Also updates actual credits used when job completes
    """
    if job_id not in translation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = translation_jobs[job_id]
    dubbing_ids = job.get("translated_videos", {})
    user_id = current_user.get("user_id")
    
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
                
                # Log character count if available (for reference)
                if status_info.get("credits_used"):
                    logger.info(f"📊 Dubbing {dubbing_id} estimated: {status_info['credits_used']} credits from character count")
                
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
        
        # Get balance after completion to calculate actual credits used
        if "balance_before" in job and "balance_after" not in job:
            try:
                sub_info = await get_user_subscription_info()
                balance_after = sub_info.get("credits_remaining")
                job["balance_after"] = balance_after
                
                if balance_after is not None:
                    actual_credits_used = job["balance_before"] - balance_after
                    job["actual_credits_used"] = actual_credits_used
                    logger.info(f"💰 Actual credits used: {actual_credits_used} (before: {job['balance_before']}, after: {balance_after})")
                    
                    # Record actual usage
                    if user_id and actual_credits_used > 0:
                        try:
                            from services.credits_service import record_usage
                            await record_usage(
                                user_id=user_id,
                                service_type="video_dubbing_actual",
                                input_tokens=int(actual_credits_used),
                                output_tokens=0,
                                total_tokens=int(actual_credits_used),
                                model_name="elevenlabs_dubbing",
                                metadata={
                                    "job_id": job_id,
                                    "target_languages": job.get("target_languages", []),
                                    "balance_before": job["balance_before"],
                                    "balance_after": balance_after,
                                    "note": "Actual credits from balance difference"
                                }
                            )
                            logger.info(f"✅ Recorded actual credits usage: {actual_credits_used}")
                        except Exception as e:
                            logger.error(f"❌ Failed to record actual credits: {e}")
            except Exception as e:
                logger.warning(f"⚠️ Could not get balance after: {e}")
                
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
    
    # Use ISO 639-1 codes (2-letter) for ElevenLabs Dubbing API
    language_map = {
        "he": "he",   # Hebrew
        "en": "en",   # English
        "es": "es",   # Spanish
        "fr": "fr",   # French
        "pt": "pt",   # Portuguese
        "de": "de",   # German
        "it": "it",   # Italian
        "pl": "pl",   # Polish
        "ru": "ru",   # Russian
        "ar": "ar",   # Arabic
        "zh": "zh",   # Chinese
        "ja": "ja",   # Japanese
        "ko": "ko",   # Korean
        "tr": "tr",   # Turkish
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

# ============= Subscription Info =============
@router.get("/subscription")
async def get_subscription(current_user: dict = Depends(get_current_user)):
    """
    Get ElevenLabs subscription info including credits balance
    """
    try:
        info = await get_user_subscription_info()
        return {
            "success": True,
            "subscription": info
        }
    except Exception as e:
        logger.error(f"❌ Failed to get subscription: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
