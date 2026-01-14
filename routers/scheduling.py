"""
Post scheduling routes (in-memory version for testing without Supabase)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

router = APIRouter(prefix="/api/scheduling", tags=["scheduling"])
logger = logging.getLogger(__name__)

# In-memory storage for scheduled posts (will be lost on server restart)
scheduled_posts_db = []

class SchedulePostRequest(BaseModel):
    post_data: dict
    platforms: List[str]
    scheduled_time: str  # ISO format

class ScheduledPost(BaseModel):
    id: str
    post_data: dict
    platforms: List[str]
    scheduled_time: str
    status: str  # "pending", "published", "failed"
    created_at: str

@router.post("/schedule")
async def schedule_post(request: SchedulePostRequest):
    """
    Schedule a post for later publication
    """
    try:
        # Generate simple ID
        post_id = f"post_{len(scheduled_posts_db) + 1}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Validate scheduled time is in future
        scheduled_dt = datetime.fromisoformat(request.scheduled_time.replace('Z', '+00:00'))
        if scheduled_dt <= datetime.now():
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
        
        # Create scheduled post
        scheduled_post = {
            "id": post_id,
            "post_data": request.post_data,
            "platforms": request.platforms,
            "scheduled_time": request.scheduled_time,
            "status": "pending",
            "created_at": datetime.now().isoformat()
        }
        
        scheduled_posts_db.append(scheduled_post)
        
        logger.info(f"📅 Scheduled post {post_id} for {request.scheduled_time}")
        
        return {
            "success": True,
            "post_id": post_id,
            "scheduled_time": request.scheduled_time,
            "message": "Post scheduled successfully"
        }
        
    except Exception as e:
        logger.error(f"❌ Scheduling error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scheduled")
async def get_scheduled_posts():
    """
    Get all scheduled posts
    """
    return {
        "scheduled_posts": scheduled_posts_db,
        "total": len(scheduled_posts_db)
    }


@router.delete("/scheduled/{post_id}")
async def cancel_scheduled_post(post_id: str):
    """
    Cancel a scheduled post
    """
    global scheduled_posts_db
    
    # Find and remove post
    original_count = len(scheduled_posts_db)
    scheduled_posts_db = [p for p in scheduled_posts_db if p["id"] != post_id]
    
    if len(scheduled_posts_db) == original_count:
        raise HTTPException(status_code=404, detail="Scheduled post not found")
    
    logger.info(f"🗑️ Cancelled scheduled post {post_id}")
    
    return {
        "success": True,
        "message": "Scheduled post cancelled"
    }
