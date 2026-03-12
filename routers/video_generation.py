"""
Video Generation Router — Kling 3.0 via KIE AI
Text-to-Video and Image-to-Video generation
API docs: https://docs.kie.ai/market/kling/kling-3-0
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json
import logging
import os
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/video-gen", tags=["video_generation"])
logger = logging.getLogger(__name__)

KIE_API_URL = "https://api.kie.ai"
KIE_MODEL = "kling-3.0/video"

# Our sale price per second (real cost × 2 margin, 1 credit = $0.001)
# Std: $0.10/s base → 200cr/s, $0.15/s audio → 300cr/s
# Pro: $0.135/s base → 270cr/s, $0.20/s audio → 400cr/s
OUR_CREDITS_PER_SEC = {
    "std_no_audio": 200,
    "std_audio": 300,
    "pro_no_audio": 270,
    "pro_audio": 400,
}

# KIE states → our normalized states
_STATE_MAP = {
    "waiting": "IN_PROGRESS",
    "queuing": "IN_PROGRESS",
    "generating": "IN_PROGRESS",
    "success": "SUCCESS",
    "fail": "FAILED",
}


def get_kling_api_key() -> str:
    api_key = os.getenv("KLING_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="KLING_API_KEY not configured")
    return api_key


def _estimate_credits(quality: str, duration: int, sound: bool) -> int:
    key = f"{quality}_{'audio' if sound else 'no_audio'}"
    per_sec = OUR_CREDITS_PER_SEC.get(key, 270)
    return per_sec * duration


class TextToVideoRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"
    duration: int = 5
    sound: bool = False
    quality: str = "pro"  # "pro" or "std"

class ImageToVideoRequest(BaseModel):
    prompt: str
    image_url: str
    duration: int = 5
    sound: bool = False
    quality: str = "pro"

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


async def _create_kie_task(input_params: dict, api_key: str, callback_url: str = None) -> str:
    """Call KIE AI /api/v1/jobs/createTask and return taskId."""
    body: dict = {"model": KIE_MODEL, "input": input_params}
    if callback_url:
        body["callBackUrl"] = callback_url

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{KIE_API_URL}/api/v1/jobs/createTask",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )

        if resp.status_code == 401:
            raise HTTPException(status_code=500, detail="Invalid KIE AI API key")
        if resp.status_code == 402:
            raise HTTPException(status_code=402, detail="Insufficient credits in KIE AI account")
        if resp.status_code == 429:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later")
        if resp.status_code != 200:
            logger.error(f"KIE API error {resp.status_code}: {resp.text}")
            raise HTTPException(status_code=500, detail=f"KIE API error: {resp.text}")

        data = resp.json()
        logger.info(f"KIE API response: {json.dumps(data, default=str)[:500]}")

        code = data.get("code")
        if code and int(code) != 200:
            msg = data.get("msg") or data.get("message") or "Unknown error"
            http_code = 402 if int(code) == 402 else 500
            raise HTTPException(status_code=http_code, detail=msg)

        task_id = data.get("data", {}).get("taskId")
        if not task_id:
            raise HTTPException(status_code=500, detail=f"No taskId in KIE response: {json.dumps(data, default=str)[:200]}")

        logger.info(f"KIE task created: {task_id}")
        return task_id


async def _charge_credits_on_success(user_id: str, task_id: str, estimated_credits: int, metadata: dict):
    """Deduct credits only when video generation succeeds."""
    try:
        from services.credits_service import record_usage
        await record_usage(
            user_id=user_id,
            service_type="video_generation",
            input_tokens=0,
            output_tokens=0,
            total_tokens=estimated_credits,
            model_name="kling-3.0",
            metadata=metadata,
            video_duration_sec=metadata.get("duration", 5),
        )
        logger.info(f"Charged {estimated_credits} credits for successful task {task_id}")
    except Exception as e:
        logger.warning(f"Failed to charge credits: {e}")


def _friendly_error(fail_code: str, fail_msg: str) -> str:
    """Convert KIE error codes into user-friendly messages."""
    code = str(fail_code).strip()
    if code == "500" or "internal" in fail_msg.lower():
        return "The AI model is busy right now. Please try again in a few minutes. No credits were charged."
    if code == "400" or "invalid" in fail_msg.lower() or "param" in fail_msg.lower():
        return "Invalid prompt or parameters. Please adjust your prompt and try again. No credits were charged."
    if "content" in fail_msg.lower() or "moderat" in fail_msg.lower() or "sensitive" in fail_msg.lower():
        return "Your prompt was flagged by content moderation. Please rephrase and try again. No credits were charged."
    return f"Generation failed: {fail_msg}. No credits were charged."


async def _save_video_task(user_id: str, task_id: str, estimated_credits: int, metadata: dict):
    try:
        from database.supabase_client import get_supabase
        supabase = get_supabase()
        supabase.table("video_tasks").insert({
            "user_id": user_id,
            "task_id": task_id,
            "status": "IN_PROGRESS",
            "estimated_credits": estimated_credits,
            "metadata": metadata,
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to save video task: {e}")


async def _charge_on_success_from_task(task_id: str):
    """Look up video_tasks row and charge credits only on first success."""
    try:
        from database.supabase_client import get_supabase
        supabase = get_supabase()
        row = supabase.table("video_tasks").select("user_id, estimated_credits, metadata, credits_charged") \
            .eq("task_id", task_id).limit(1).execute()
        if not row.data:
            logger.warning(f"No video_tasks row for {task_id}, skipping charge")
            return
        task = row.data[0]
        if task.get("credits_charged"):
            return
        user_id = task["user_id"]
        credits = int(task.get("estimated_credits", 0))
        meta = task.get("metadata") or {}
        await _charge_credits_on_success(user_id, task_id, credits, meta)
        supabase.table("video_tasks").update({"credits_charged": True}).eq("task_id", task_id).execute()
    except Exception as e:
        logger.error(f"Failed to charge credits on success for {task_id}: {e}")


async def _update_video_task(task_id: str, status: str, video_urls: list = None, error_message: str = None):
    try:
        from database.supabase_client import get_supabase
        supabase = get_supabase()
        update: dict = {"status": status}
        if video_urls:
            update["video_urls"] = video_urls
        if error_message:
            update["error_message"] = error_message
        supabase.table("video_tasks").update(update).eq("task_id", task_id).execute()
    except Exception as e:
        logger.warning(f"Failed to update video task {task_id}: {e}")


@router.post("/text-to-video", response_model=VideoGenerationResponse)
async def generate_text_to_video(
    request: TextToVideoRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate video from text prompt using Kling 3.0 via KIE AI."""
    estimated_credits = _estimate_credits(request.quality, request.duration, request.sound)

    from services.credits_service import check_balance
    bal = await check_balance(current_user["user_id"], min_credits=float(estimated_credits))
    if not bal["ok"]:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough credits. You have {bal['remaining']:.0f}, need {estimated_credits}.",
        )

    api_key = get_kling_api_key()

    if len(request.prompt) > 2000:
        raise HTTPException(status_code=400, detail="Prompt must be 2000 characters or less")
    if request.aspect_ratio not in ("16:9", "9:16", "1:1"):
        raise HTTPException(status_code=400, detail="Invalid aspect_ratio")
    if not 3 <= request.duration <= 15:
        raise HTTPException(status_code=400, detail="Duration must be 3-15 seconds")
    if request.quality not in ("pro", "std"):
        raise HTTPException(status_code=400, detail="Quality must be 'pro' or 'std'")

    user_id = current_user["user_id"]
    logger.info(f"Creating kling-3.0 {request.quality} text-to-video | user={user_id[:8]} | {request.duration}s sound={request.sound} | ~{estimated_credits} cr")

    try:
        task_id = await _create_kie_task(
            {
                "prompt": request.prompt,
                "duration": str(request.duration),
                "aspect_ratio": request.aspect_ratio,
                "sound": request.sound,
                "mode": request.quality,
                "multi_shots": False,
            },
            api_key,
        )
        meta = {
            "task_id": task_id,
            "prompt": request.prompt[:200],
            "duration": request.duration,
            "sound": request.sound,
            "aspect_ratio": request.aspect_ratio,
            "quality": request.quality,
            "type": "text-to-video",
        }
        await _save_video_task(user_id, task_id, estimated_credits, meta)

        return VideoGenerationResponse(
            task_id=task_id,
            status="IN_PROGRESS",
            message="Video generation started. Poll /status/{task_id} for updates.",
            estimated_credits=estimated_credits,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create text-to-video task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-to-video", response_model=VideoGenerationResponse)
async def generate_image_to_video(
    request: ImageToVideoRequest,
    current_user: dict = Depends(get_current_user),
):
    """Generate video from image + prompt using Kling 3.0 via KIE AI."""
    estimated_credits = _estimate_credits(request.quality, request.duration, request.sound)

    from services.credits_service import check_balance
    bal = await check_balance(current_user["user_id"], min_credits=float(estimated_credits))
    if not bal["ok"]:
        raise HTTPException(
            status_code=402,
            detail=f"Not enough credits. You have {bal['remaining']:.0f}, need {estimated_credits}.",
        )

    api_key = get_kling_api_key()

    if len(request.prompt) > 2000:
        raise HTTPException(status_code=400, detail="Prompt must be 2000 characters or less")
    if not request.image_url:
        raise HTTPException(status_code=400, detail="image_url is required")
    if not 3 <= request.duration <= 15:
        raise HTTPException(status_code=400, detail="Duration must be 3-15 seconds")
    if request.quality not in ("pro", "std"):
        raise HTTPException(status_code=400, detail="Quality must be 'pro' or 'std'")

    user_id = current_user["user_id"]
    logger.info(f"Creating kling-3.0 {request.quality} image-to-video | user={user_id[:8]} | {request.duration}s sound={request.sound} | ~{estimated_credits} cr")

    try:
        task_id = await _create_kie_task(
            {
                "prompt": request.prompt,
                "image_urls": [request.image_url],
                "duration": str(request.duration),
                "sound": request.sound,
                "mode": request.quality,
                "multi_shots": False,
            },
            api_key,
        )
        meta = {
            "task_id": task_id,
            "prompt": request.prompt[:200],
            "duration": request.duration,
            "sound": request.sound,
            "quality": request.quality,
            "type": "image-to-video",
        }
        await _save_video_task(user_id, task_id, estimated_credits, meta)

        return VideoGenerationResponse(
            task_id=task_id,
            status="IN_PROGRESS",
            message="Video generation started. Poll /status/{task_id} for updates.",
            estimated_credits=estimated_credits,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create image-to-video task: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}", response_model=VideoStatusResponse)
async def get_video_status(
    task_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Check status of video generation task via KIE AI recordInfo endpoint."""
    api_key = get_kling_api_key()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{KIE_API_URL}/api/v1/jobs/recordInfo",
                headers={"Authorization": f"Bearer {api_key}"},
                params={"taskId": task_id},
            )

            if resp.status_code != 200:
                logger.error(f"KIE status API error {resp.status_code}: {resp.text}")
                raise HTTPException(status_code=500, detail="Failed to get task status")

            data = resp.json()
            if data.get("code") != 200:
                raise HTTPException(status_code=500, detail=data.get("msg", "Unknown error"))

            task_data = data.get("data", {})
            kie_state = task_data.get("state", "waiting")
            status = _STATE_MAP.get(kie_state, "IN_PROGRESS")

            video_urls = None
            error_message = None

            if status == "SUCCESS":
                result_json_str = task_data.get("resultJson", "")
                if result_json_str:
                    try:
                        result_obj = json.loads(result_json_str)
                        video_urls = result_obj.get("resultUrls", [])
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse resultJson for task {task_id}")
                await _update_video_task(task_id, "SUCCESS", video_urls)
                await _charge_on_success_from_task(task_id)

            elif status == "FAILED":
                fail_code = task_data.get("failCode", "unknown")
                fail_msg = task_data.get("failMsg", "Generation failed")
                error_message = _friendly_error(fail_code, fail_msg)
                logger.error(f"KIE task FAILED: task={task_id} failCode={fail_code} failMsg={fail_msg}")
                await _update_video_task(task_id, "FAILED", error_message=error_message)

            created_at = None
            create_time = task_data.get("createTime")
            if create_time:
                from datetime import datetime, timezone
                created_at = datetime.fromtimestamp(create_time / 1000, tz=timezone.utc).isoformat()

            return VideoStatusResponse(
                task_id=task_id,
                status=status,
                video_urls=video_urls,
                error_message=error_message,
                created_at=created_at,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_video_history(current_user: dict = Depends(get_current_user)):
    """Get user's video generation history."""
    try:
        from database.supabase_client import get_supabase
        supabase = get_supabase()
        result = supabase.table("video_tasks") \
            .select("*") \
            .eq("user_id", current_user["user_id"]) \
            .order("created_at", desc=True) \
            .limit(50) \
            .execute()
        return {"tasks": result.data or []}
    except Exception as e:
        logger.error(f"Failed to get video history: {e}")
        return {"tasks": []}


@router.post("/webhook")
async def video_webhook(request: Request):
    """
    Webhook endpoint for KIE AI async completion callbacks.
    KIE posts task results here when callBackUrl is configured.
    """
    try:
        body = await request.json()
        task_id = body.get("data", {}).get("taskId") or body.get("taskId")
        kie_state = body.get("data", {}).get("state") or body.get("state", "")

        if not task_id:
            raise HTTPException(status_code=400, detail="Missing taskId")

        status = _STATE_MAP.get(kie_state, kie_state)
        logger.info(f"Webhook received: task={task_id} state={kie_state} -> status={status}")

        video_urls = None
        error_message = None

        if status == "SUCCESS":
            result_json_str = body.get("data", {}).get("resultJson", "")
            if result_json_str:
                try:
                    result_obj = json.loads(result_json_str) if isinstance(result_json_str, str) else result_json_str
                    video_urls = result_obj.get("resultUrls", [])
                except (json.JSONDecodeError, AttributeError):
                    pass
            await _charge_on_success_from_task(task_id)
        elif status == "FAILED":
            fail_code = body.get("data", {}).get("failCode", "unknown")
            fail_msg = body.get("data", {}).get("failMsg", "Generation failed")
            error_message = _friendly_error(fail_code, fail_msg)
            logger.error(f"KIE webhook FAILED: task={task_id} failCode={fail_code} failMsg={fail_msg}")

        await _update_video_task(task_id, status, video_urls, error_message)

        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
