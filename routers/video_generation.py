"""
Video Generation Router - Kling AI Integration
Text-to-Video and Image-to-Video generation using Kling 2.6 AI
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import httpx
import logging
import os
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/video-gen", tags=["video_generation"])
logger = logging.getLogger(__name__)

KLING_API_URL = "https://kling26ai.com/api"

def get_kling_api_key() -> str:
    """Get Kling AI API key from environment"""
    api_key = os.getenv("KLING_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="KLING_API_KEY not configured")
    return api_key

class TextToVideoRequest(BaseModel):
    prompt: str  # max 1000 chars
    aspect_ratio: str = "16:9"  # 16:9, 9:16, 1:1
    duration: str = "5"  # "5" or "10" seconds
    sound: bool = False  # doubles cost if True

class ImageToVideoRequest(BaseModel):
    prompt: str  # max 1000 chars
    image_urls: List[str]  # reference images
    duration: str = "5"  # "5" or "10" seconds
    sound: bool = False

class VideoGenerationResponse(BaseModel):
    task_id: str
    status: str
    message: str
    estimated_credits: int

class VideoStatusResponse(BaseModel):
    task_id: str
    status: str  # IN_PROGRESS, SUCCESS, FAILED
    video_urls: Optional[List[str]] = None
    consumed_credits: Optional[int] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None

@router.post("/text-to-video", response_model=VideoGenerationResponse)
async def generate_text_to_video(
    request: TextToVideoRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate video from text prompt using Kling 2.6 AI
    
    Credit costs:
    - 5s without sound: 500 credits
    - 10s without sound: 1000 credits
    - 5s with sound: 1000 credits
    - 10s with sound: 2000 credits
    """
    api_key = get_kling_api_key()
    
    # Validate prompt length
    if len(request.prompt) > 1000:
        raise HTTPException(status_code=400, detail="Prompt must be 1000 characters or less")
    
    # Validate parameters
    if request.aspect_ratio not in ["16:9", "9:16", "1:1"]:
        raise HTTPException(status_code=400, detail="Invalid aspect_ratio. Must be 16:9, 9:16, or 1:1")
    
    if request.duration not in ["5", "10"]:
        raise HTTPException(status_code=400, detail="Invalid duration. Must be '5' or '10' seconds")
    
    # Calculate estimated credits (×2 markup on Kling prices)
    base_credits = 500 if request.duration == "5" else 1000
    estimated_credits = base_credits * 2 if request.sound else base_credits
    
    try:
        logger.info(f"🎬 Creating text-to-video task for user {current_user.get('user_id')}")
        logger.info(f"📝 Prompt: {request.prompt[:100]}...")
        logger.info(f"⚙️ Settings: {request.aspect_ratio}, {request.duration}s, sound={request.sound}")
        logger.info(f"💰 Estimated credits: {estimated_credits}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{KLING_API_URL}/generate",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "prompt": request.prompt,
                    "aspect_ratio": request.aspect_ratio,
                    "duration": request.duration,
                    "sound": request.sound
                }
            )
            
            if response.status_code == 401:
                raise HTTPException(status_code=500, detail="Invalid Kling API key")
            elif response.status_code == 402:
                raise HTTPException(status_code=402, detail="Insufficient credits in Kling account")
            elif response.status_code == 429:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later")
            elif response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Kling API error {response.status_code}: {error_text}")
                raise HTTPException(status_code=500, detail=f"Kling API error: {error_text}")
            
            data = response.json()
            
            if data.get("code") != 200:
                raise HTTPException(status_code=500, detail=data.get("message", "Unknown error"))
            
            task_id = data.get("data", {}).get("task_id")
            
            if not task_id:
                raise HTTPException(status_code=500, detail="No task_id returned from Kling API")
            
            logger.info(f"✅ Video generation task created: {task_id}")
            
            # TODO: Record usage in database
            try:
                from services.credits_service import record_usage
                await record_usage(
                    user_id=current_user.get("user_id"),
                    service_type="video_generation",
                    input_tokens=0,
                    output_tokens=0,
                    total_tokens=estimated_credits,
                    model_name="kling-2.6",
                    metadata={
                        "task_id": task_id,
                        "prompt": request.prompt[:200],
                        "duration": request.duration,
                        "sound": request.sound,
                        "aspect_ratio": request.aspect_ratio,
                        "type": "text-to-video"
                    }
                )
                logger.info(f"📊 Recorded {estimated_credits} credits usage")
            except Exception as e:
                logger.warning(f"⚠️ Failed to record usage: {e}")
            
            return VideoGenerationResponse(
                task_id=task_id,
                status="IN_PROGRESS",
                message="Video generation started. Use task_id to check status.",
                estimated_credits=estimated_credits
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create video generation task: {e}")
        logger.exception("Full error:")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/image-to-video", response_model=VideoGenerationResponse)
async def generate_image_to_video(
    request: ImageToVideoRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate video from image + prompt using Kling 2.6 AI
    
    Credit costs:
    - 5s without sound: 500 credits
    - 10s without sound: 1000 credits
    - 5s with sound: 1000 credits
    - 10s with sound: 2000 credits
    """
    api_key = get_kling_api_key()
    
    # Validate
    if len(request.prompt) > 1000:
        raise HTTPException(status_code=400, detail="Prompt must be 1000 characters or less")
    
    if not request.image_urls:
        raise HTTPException(status_code=400, detail="At least one image_url is required")
    
    if request.duration not in ["5", "10"]:
        raise HTTPException(status_code=400, detail="Invalid duration. Must be '5' or '10' seconds")
    
    # Calculate estimated credits (×2 markup on Kling prices)
    base_credits = 500 if request.duration == "5" else 1000
    estimated_credits = base_credits * 2 if request.sound else base_credits
    
    try:
        logger.info(f"🎬 Creating image-to-video task for user {current_user.get('user_id')}")
        logger.info(f"📝 Prompt: {request.prompt[:100]}...")
        logger.info(f"🖼️ Images: {len(request.image_urls)} image(s)")
        logger.info(f"⚙️ Settings: {request.duration}s, sound={request.sound}")
        logger.info(f"💰 Estimated credits: {estimated_credits}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{KLING_API_URL}/generate",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "prompt": request.prompt,
                    "image_urls": request.image_urls,
                    "duration": request.duration,
                    "sound": request.sound,
                    "aspect_ratio": "16:9"  # ignored when image_urls exist
                }
            )
            
            if response.status_code == 401:
                raise HTTPException(status_code=500, detail="Invalid Kling API key")
            elif response.status_code == 402:
                raise HTTPException(status_code=402, detail="Insufficient credits in Kling account")
            elif response.status_code == 429:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later")
            elif response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Kling API error {response.status_code}: {error_text}")
                raise HTTPException(status_code=500, detail=f"Kling API error: {error_text}")
            
            data = response.json()
            
            if data.get("code") != 200:
                raise HTTPException(status_code=500, detail=data.get("message", "Unknown error"))
            
            task_id = data.get("data", {}).get("task_id")
            
            if not task_id:
                raise HTTPException(status_code=500, detail="No task_id returned from Kling API")
            
            logger.info(f"✅ Video generation task created: {task_id}")
            
            # Record usage
            try:
                from services.credits_service import record_usage
                await record_usage(
                    user_id=current_user.get("user_id"),
                    service_type="video_generation",
                    input_tokens=0,
                    output_tokens=0,
                    total_tokens=estimated_credits,
                    model_name="kling-2.6",
                    metadata={
                        "task_id": task_id,
                        "prompt": request.prompt[:200],
                        "duration": request.duration,
                        "sound": request.sound,
                        "image_count": len(request.image_urls),
                        "type": "image-to-video"
                    }
                )
                logger.info(f"📊 Recorded {estimated_credits} credits usage")
            except Exception as e:
                logger.warning(f"⚠️ Failed to record usage: {e}")
            
            return VideoGenerationResponse(
                task_id=task_id,
                status="IN_PROGRESS",
                message="Video generation started. Use task_id to check status.",
                estimated_credits=estimated_credits
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to create video generation task: {e}")
        logger.exception("Full error:")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{task_id}", response_model=VideoStatusResponse)
async def get_video_status(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Check status of video generation task
    
    Status values:
    - IN_PROGRESS: Video is still being generated
    - SUCCESS: Video is ready (video_urls will be populated)
    - FAILED: Generation failed (error_message will explain why)
    """
    api_key = get_kling_api_key()
    
    try:
        logger.info(f"🔍 Checking status for task: {task_id}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{KLING_API_URL}/status",
                headers={
                    "Authorization": f"Bearer {api_key}"
                },
                params={"task_id": task_id}
            )
            
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"❌ Kling API error {response.status_code}: {error_text}")
                raise HTTPException(status_code=500, detail=f"Failed to get task status: {error_text}")
            
            data = response.json()
            
            if data.get("code") != 200:
                raise HTTPException(status_code=500, detail=data.get("message", "Unknown error"))
            
            task_data = data.get("data", {})
            
            status = task_data.get("status", "UNKNOWN")
            video_urls = task_data.get("response", []) if status == "SUCCESS" else None
            consumed_credits = task_data.get("consumed_credits")
            error_message = task_data.get("error_message")
            created_at = task_data.get("created_at")
            
            logger.info(f"📊 Task {task_id} status: {status}")
            if video_urls:
                logger.info(f"✅ Video ready: {len(video_urls)} file(s)")
            if error_message:
                logger.error(f"❌ Task failed: {error_message}")
            
            return VideoStatusResponse(
                task_id=task_id,
                status=status,
                video_urls=video_urls,
                consumed_credits=consumed_credits,
                error_message=error_message,
                created_at=created_at
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to get task status: {e}")
        logger.exception("Full error:")
        raise HTTPException(status_code=500, detail=str(e))
