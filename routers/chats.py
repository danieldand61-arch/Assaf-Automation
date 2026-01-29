"""
Chat Router - AI Chat System
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
from middleware.auth import get_current_user
from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chats", tags=["chats"])


class CreateChatRequest(BaseModel):
    title: Optional[str] = "New Chat"


class SendMessageRequest(BaseModel):
    content: str
    action_type: Optional[str] = None  # 'post_generation', 'video_dubbing', etc.
    action_data: Optional[dict] = None


class ChatMessage(BaseModel):
    id: str
    role: str  # 'user', 'assistant', 'system'
    content: str
    action_type: Optional[str] = None
    action_data: Optional[dict] = None
    created_at: str


class Chat(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    last_message_at: str
    message_count: Optional[int] = 0


@router.post("/create")
async def create_chat(
    request: CreateChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new chat
    """
    try:
        supabase = get_supabase()
        
        # Get active account
        user_settings = supabase.table("user_settings")\
            .select("active_account_id")\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        active_account_id = user_settings.data.get("active_account_id") if user_settings.data else None
        
        # Create new chat
        result = supabase.table("chats").insert({
            "user_id": current_user["user_id"],
            "account_id": active_account_id,
            "title": request.title
        }).execute()
        
        chat = result.data[0]
        logger.info(f"✅ Created chat {chat['id']} for user {current_user['user_id']}")
        
        return {
            "success": True,
            "chat": chat
        }
        
    except Exception as e:
        logger.error(f"❌ Create chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_chats(
    current_user: dict = Depends(get_current_user)
):
    """
    List all chats for current user
    """
    try:
        supabase = get_supabase()
        
        # Get all user's chats, ordered by last message
        result = supabase.table("chats")\
            .select("*")\
            .eq("user_id", current_user["user_id"])\
            .order("last_message_at", desc=True)\
            .execute()
        
        chats = result.data or []
        
        # Get message count for each chat
        for chat in chats:
            msg_count = supabase.table("chat_messages")\
                .select("id", count="exact")\
                .eq("chat_id", chat["id"])\
                .execute()
            chat["message_count"] = msg_count.count or 0
        
        return {
            "chats": chats
        }
        
    except Exception as e:
        logger.error(f"❌ List chats error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{chat_id}/messages")
async def get_messages(
    chat_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get all messages for a chat
    """
    try:
        supabase = get_supabase()
        
        # Verify chat belongs to user
        chat = supabase.table("chats")\
            .select("*")\
            .eq("id", chat_id)\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        if not chat.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Get messages
        result = supabase.table("chat_messages")\
            .select("*")\
            .eq("chat_id", chat_id)\
            .order("created_at", desc=False)\
            .execute()
        
        return {
            "chat": chat.data,
            "messages": result.data or []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Get messages error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{chat_id}/message")
async def send_message(
    chat_id: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a message to chat and get AI response
    """
    try:
        supabase = get_supabase()
        
        # Verify chat belongs to user
        chat = supabase.table("chats")\
            .select("*")\
            .eq("id", chat_id)\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        if not chat.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Save user message
        user_msg = supabase.table("chat_messages").insert({
            "chat_id": chat_id,
            "role": "user",
            "content": request.content,
            "action_type": request.action_type,
            "action_data": request.action_data
        }).execute()
        
        # If this is an action request, don't call AI
        if request.action_type:
            logger.info(f"🎬 Action triggered: {request.action_type}")
            return {
                "success": True,
                "message": user_msg.data[0],
                "requires_action": True,
                "action_type": request.action_type
            }
        
        # Get chat history for context
        messages = supabase.table("chat_messages")\
            .select("*")\
            .eq("chat_id", chat_id)\
            .order("created_at", desc=False)\
            .limit(20)\
            .execute()
        
        # Call AI for response (will implement next)
        ai_response = await get_ai_response(messages.data or [])
        
        # Save AI response
        assistant_msg = supabase.table("chat_messages").insert({
            "chat_id": chat_id,
            "role": "assistant",
            "content": ai_response
        }).execute()
        
        return {
            "success": True,
            "user_message": user_msg.data[0],
            "assistant_message": assistant_msg.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Send message error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a chat and all its messages
    """
    try:
        supabase = get_supabase()
        
        # Verify and delete (cascade will handle messages)
        result = supabase.table("chats")\
            .delete()\
            .eq("id", chat_id)\
            .eq("user_id", current_user["user_id"])\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        logger.info(f"🗑️ Deleted chat {chat_id}")
        
        return {
            "success": True,
            "message": "Chat deleted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def get_ai_response(messages: List[dict]) -> str:
    """
    Get AI response from Claude API (Anthropic)
    """
    try:
        import anthropic
        import os
        
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            logger.warning("⚠️ ANTHROPIC_API_KEY not set, using fallback response")
            return "I'm your AI assistant! I can help you with:\n\n• Generate social media posts\n• Translate videos with AI dubbing\n• Create images\n• Schedule posts\n\nWhat would you like to do?"
        
        # Convert messages to Claude format
        claude_messages = []
        for msg in messages:
            if msg["role"] in ["user", "assistant"]:
                claude_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        # Call Claude API
        client = anthropic.Anthropic(api_key=api_key)
        
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",  # Claude 3.5 Sonnet (latest)
            max_tokens=1024,
            system="You are a helpful AI assistant for a social media automation platform. You help users with content creation, video translation, and social media management. Be concise, friendly, and helpful. When users ask about capabilities, mention: post generation, video dubbing/translation, image generation, and scheduling features.",
            messages=claude_messages
        )
        
        ai_content = response.content[0].text
        logger.info(f"✅ Claude API response received ({len(ai_content)} chars)")
        
        return ai_content
        
    except Exception as e:
        logger.error(f"❌ AI response error: {str(e)}")
        return "I'm here to help! You can:\n\n• Generate social media posts\n• Translate videos with AI dubbing\n• Create images\n• Schedule posts\n\nClick one of the action buttons below or ask me anything!"
