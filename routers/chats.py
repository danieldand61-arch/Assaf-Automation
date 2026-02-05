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
    Send a message and get AI response from Gemini with function calling support
    """
    logger.info(f"💬 Received message for chat {chat_id}")
    logger.info(f"📝 Message content: {request.content[:100]}")
    
    try:
        import google.generativeai as genai
        import os
        from services.chat_tools import get_available_tools, TOOLS_DESCRIPTION
        from services.function_executor import FunctionExecutor
        
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
        
        # Get chat history for context (increased to 50 for better context)
        messages = supabase.table("chat_messages")\
            .select("*")\
            .eq("chat_id", chat_id)\
            .order("created_at", desc=False)\
            .limit(50)\
            .execute()
        
        # Build conversation history for Gemini (including function calls)
        conversation_history = []
        for msg in (messages.data or []):
            if msg["role"] == "user":
                conversation_history.append({
                    "role": "user",
                    "parts": [msg["content"]]
                })
            elif msg["role"] == "assistant":
                conversation_history.append({
                    "role": "model",
                    "parts": [msg["content"]]
                })
            elif msg["role"] == "function":
                # Add function results to history
                try:
                    import json
                    function_name = msg.get("action_type", "unknown")
                    function_result = msg.get("action_data", {})
                    
                    conversation_history.append({
                        "role": "function",
                        "parts": [{
                            "function_response": {
                                "name": function_name,
                                "response": function_result
                            }
                        }]
                    })
                except Exception as e:
                    logger.warning(f"⚠️ Could not parse function message: {e}")
        
        # Call Gemini API with function calling
        try:
            api_key = os.getenv("GOOGLE_AI_API_KEY")
            if not api_key:
                logger.error("⚠️ GOOGLE_AI_API_KEY not configured")
                raise Exception("GOOGLE_AI_API_KEY not configured")
            
            genai.configure(api_key=api_key)
            logger.info(f"🔑 Gemini configured")
            
            # Use Gemini 2.5 Flash
            model_name = 'gemini-3-flash-preview'
            logger.info(f"🤖 Using model: {model_name}")
            
            # Get current date
            current_date = datetime.now().strftime("%B %d, %Y")
            
            # Get available tools
            tools = get_available_tools()
            
            # Get company context
            company_context = ""
            try:
                account_id = chat.data.get("account_id")
                if account_id:
                    account = supabase.table("accounts")\
                        .select("*")\
                        .eq("id", account_id)\
                        .single()\
                        .execute()
                    
                    if account.data:
                        acc = account.data
                        company_context = f"""
DEFAULT COMPANY CONTEXT (can be overridden by user):
- Company: {acc.get('name', 'Not specified')}
- Industry: {acc.get('industry', 'Not specified')}
- Description: {acc.get('description', 'Not specified')}
- Target Audience: {acc.get('target_audience', 'General audience')}
- Brand Voice: {acc.get('brand_voice', 'professional')}

IMPORTANT CONTEXT RULES:
1. Use company context as DEFAULT if user doesn't specify otherwise
2. If user mentions different topic/industry → FOLLOW USER'S REQUEST
3. If user says "ignore company data" → IGNORE IT COMPLETELY
4. User's prompt has PRIORITY over company context
5. Be flexible and context-aware
"""
            except Exception as e:
                logger.warning(f"Could not load company context: {e}")
            
            # Enhanced system instruction with tools
            system_instruction = f"""You are Joyo Marketing AI assistant. Today's date is {current_date}.

{company_context}

{TOOLS_DESCRIPTION}

LANGUAGE RULES:
- ALWAYS respond in the SAME LANGUAGE the user writes in
- Russian → Russian, English → English, Hebrew → Hebrew

BEHAVIOR:
- Be proactive: suggest tools when relevant
- Check connections before operations
- Provide actionable insights
- Be conversational and helpful
- Use tools to provide real data, not assumptions
- Use company context intelligently but respect user's specific requests

WORKFLOW EXAMPLES:
- User: "create ads" → use company context + generate_google_ads_content
- User: "create ads for tech startup" → ignore company, follow user's request
- User: "analyze campaigns" → use get_google_ads_campaigns + analyze_campaign_performance
- User wants social posts → use generate_social_media_posts with company context

IMPORTANT: When using tools, explain what you're doing and show results clearly."""
            
            model = genai.GenerativeModel(
                model_name,
                tools=tools,  # ← ENABLE FUNCTION CALLING!
                system_instruction=system_instruction
            )
            
            # Build proper history (exclude current message)
            history = []
            if len(conversation_history) > 1:
                history = conversation_history[:-1]
            
            logger.info(f"📝 Chat history length: {len(history)}")
            logger.info(f"💬 User message: {request.content[:100]}")
            
            # Start chat with history
            chat_session = model.start_chat(history=history)
            
            # Initialize function executor
            account_id = chat.data.get("account_id")
            executor = FunctionExecutor(
                user_id=current_user["user_id"],
                account_id=account_id
            )
            
            # Send message and handle function calls
            response = chat_session.send_message(request.content)
            
            # Check if function call is needed
            max_iterations = 5  # Prevent infinite loops
            iteration = 0
            
            while iteration < max_iterations:
                iteration += 1
                
                # Check if response contains function call
                if response.candidates[0].content.parts[0].function_call:
                    function_call = response.candidates[0].content.parts[0].function_call
                    function_name = function_call.name
                    function_args = dict(function_call.args)
                    
                    logger.info(f"🔧 Function call detected: {function_name}")
                    logger.info(f"   Arguments: {function_args}")
                    
                    # Execute function
                    result = await executor.execute(function_name, function_args)
                    
                    logger.info(f"✅ Function executed: success={result.get('success')}")
                    
                    # Save function call to history
                    function_msg = supabase.table("chat_messages").insert({
                        "chat_id": chat_id,
                        "role": "function",
                        "content": f"Executed: {function_name}",
                        "action_type": function_name,
                        "action_data": result
                    }).execute()
                    
                    # Send function result back to Gemini
                    response = chat_session.send_message(
                        genai.protos.Content(parts=[
                            genai.protos.Part(
                                function_response=genai.protos.FunctionResponse(
                                    name=function_name,
                                    response=result
                                )
                            )
                        ])
                    )
                else:
                    # No more function calls, get final response
                    break
            
            # Get final text response
            ai_content = response.text
            logger.info(f"✅ Gemini final response: {ai_content[:200]}...")
            
        except Exception as e:
            logger.error(f"⚠️ Gemini API error: {str(e)}")
            logger.exception("Full Gemini error:")
            ai_content = f"I apologize, but I encountered an error: {str(e)}"
        
        # Save AI response
        assistant_msg = supabase.table("chat_messages").insert({
            "chat_id": chat_id,
            "role": "assistant",
            "content": ai_content
        }).execute()
        
        # Update chat title if this is first real message
        if len([m for m in (messages.data or []) if m["role"] == "user"]) == 1:
            title = request.content[:50]
            if len(request.content) > 50:
                title += "..."
            supabase.table("chats")\
                .update({"title": title})\
                .eq("id", chat_id)\
                .execute()
        
        # Update last_message_at
        supabase.table("chats")\
            .update({"last_message_at": datetime.now().isoformat()})\
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
        logger.exception("Full traceback:")
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


