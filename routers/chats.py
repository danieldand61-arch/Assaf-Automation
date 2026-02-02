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
        
        logger.info(f"📤 Returning {len(result.data or [])} messages for chat {chat_id}")
        
        # Log tool messages with action_data
        tool_messages = [m for m in (result.data or []) if m.get('role') == 'tool']
        if tool_messages:
            logger.info(f"🔧 Tool messages: {len(tool_messages)}")
            for tm in tool_messages:
                has_content = bool(tm.get('action_data', {}).get('generatedContent'))
                logger.info(f"  - {tm.get('id')}: type={tm.get('action_type')}, has_content={has_content}")
        
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
    Send a message and get AI response from Gemini
    """
    logger.info(f"💬 Received message for chat {chat_id}")
    logger.info(f"📝 Message content: {request.content[:100]}")
    
    try:
        import google.generativeai as genai
        import os
        
        supabase = get_supabase()
        
        # Verify chat belongs to user
        logger.info(f"🔍 Verifying chat ownership for user {current_user['user_id']}")
        chat = supabase.table("chats")\
            .select("*")\
            .eq("id", chat_id)\
            .eq("user_id", current_user["user_id"])\
            .single()\
            .execute()
        
        if not chat.data:
            logger.error(f"❌ Chat {chat_id} not found for user {current_user['user_id']}")
            raise HTTPException(status_code=404, detail="Chat not found")
        
        logger.info(f"✅ Chat verified: {chat.data['title']}")
        
        # Save user message
        user_msg = supabase.table("chat_messages").insert({
            "chat_id": chat_id,
            "role": "user",
            "content": request.content,
            "action_type": request.action_type,
            "action_data": request.action_data
        }).execute()
        
        # Get chat history for context
        messages = supabase.table("chat_messages")\
            .select("*")\
            .eq("chat_id", chat_id)\
            .order("created_at", desc=False)\
            .limit(20)\
            .execute()
        
        # Build conversation history for Gemini
        conversation_history = []
        for msg in (messages.data or []):
            if msg["role"] in ["user", "assistant"]:
                conversation_history.append({
                    "role": "user" if msg["role"] == "user" else "model",
                    "parts": [msg["content"]]
                })
        
        # Call Gemini API
        try:
            api_key = os.getenv("GOOGLE_AI_API_KEY")
            if not api_key:
                logger.error("⚠️ GOOGLE_AI_API_KEY not configured")
                raise Exception("GOOGLE_AI_API_KEY not configured")
            
            genai.configure(api_key=api_key)
            logger.info(f"🔑 Gemini configured with API key: {api_key[:20]}...")
            
            # Use Gemini 2.5 Flash (latest, best price-performance)
            model_name = 'gemini-2.5-flash'
            logger.info(f"🤖 Using model: {model_name}")
            
            model = genai.GenerativeModel(
                model_name,
                system_instruction="""You are a helpful AI assistant for a social media automation platform. 
                
Key rules:
- ALWAYS respond in the SAME LANGUAGE the user writes in
- If user writes in Russian, respond in Russian
- If user writes in English, respond in English
- Be conversational, friendly, and helpful
- Help with content creation, social media questions, and creative ideas
- Keep responses concise but informative"""
            )
            
            # Build proper history (exclude current message)
            history = []
            if len(conversation_history) > 1:
                history = conversation_history[:-1]
            
            logger.info(f"📝 Chat history length: {len(history)}")
            logger.info(f"💬 User message: {request.content[:100]}")
            
            # Start chat with history
            chat_session = model.start_chat(history=history)
            
            # Send message
            response = chat_session.send_message(request.content)
            ai_content = response.text
            
            logger.info(f"✅ Gemini API response: {ai_content[:200]}...")
            
        except Exception as e:
            logger.error(f"⚠️ Gemini API error: {str(e)}")
            logger.exception("Full Gemini error:")
            ai_content = f"I apologize, but I encountered an error. Please try again or use the buttons below to generate posts or translate videos."
        
        # Save AI response
        assistant_msg = supabase.table("chat_messages").insert({
            "chat_id": chat_id,
            "role": "assistant",
            "content": ai_content
        }).execute()
        
        # Update chat title if this is first message
        if len(conversation_history) == 1:
            title = request.content[:50]
            if len(request.content) > 50:
                title += "..."
            supabase.table("chats")\
                .update({"title": title})\
                .eq("id", chat_id)\
                .execute()
        
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


@router.post("/{chat_id}/action")
async def log_action(
    chat_id: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a tool message in the chat (for post generation, dubbing, etc)
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
        
        # Save tool message
        action_log = supabase.table("chat_messages").insert({
            "chat_id": chat_id,
            "role": "tool",  # Changed from "system" to "tool"
            "content": request.content,
            "action_type": request.action_type,
            "action_data": request.action_data or {}
        }).execute()
        
        logger.info(f"🎬 Tool message created: {request.action_type} in chat {chat_id}")
        
        return {
            "success": True,
            "action": action_log.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Create tool message error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{chat_id}")
async def update_chat(
    chat_id: str,
    request: CreateChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update chat title
    """
    try:
        supabase = get_supabase()
        
        # Verify and update
        result = supabase.table("chats")\
            .update({"title": request.title})\
            .eq("id", chat_id)\
            .eq("user_id", current_user["user_id"])\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        logger.info(f"✏️ Updated chat {chat_id} title to: {request.title}")
        
        return {
            "success": True,
            "chat": result.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{chat_id}/messages/{message_id}")
async def update_message(
    chat_id: str,
    message_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Update message action_data (for tool messages)
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
        
        # Update message action_data
        result = supabase.table("chat_messages")\
            .update({"action_data": request.get("action_data")})\
            .eq("id", message_id)\
            .eq("chat_id", chat_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Message not found")
        
        logger.info(f"✏️ Updated message {message_id} in chat {chat_id}")
        
        return {
            "success": True,
            "message": result.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Update message error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{chat_id}/messages/{message_id}")
async def delete_message(
    chat_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a specific message (typically a tool message)
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
        
        # Delete message
        result = supabase.table("chat_messages")\
            .delete()\
            .eq("id", message_id)\
            .eq("chat_id", chat_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Message not found")
        
        logger.info(f"🗑️ Deleted message {message_id} from chat {chat_id}")
        
        return {
            "success": True,
            "message": "Message deleted"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete message error: {str(e)}")
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


