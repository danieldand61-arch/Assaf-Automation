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
    mode: Optional[str] = None  # 'advisor' = no function calling, just answer from context


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
        
        # Get active account (safe — no .single() to avoid 406 on missing row)
        active_account_id = None
        try:
            user_settings = supabase.table("user_settings")\
                .select("active_account_id")\
                .eq("user_id", current_user["user_id"])\
                .limit(1)\
                .execute()
            if user_settings.data:
                active_account_id = user_settings.data[0].get("active_account_id")
        except Exception:
            pass
        
        # Create new chat
        result = supabase.table("chats").insert({
            "user_id": current_user["user_id"],
            "account_id": active_account_id,
            "title": request.title,
            "last_message_at": datetime.now().isoformat(),
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
    
    from services.credits_service import check_balance
    bal = await check_balance(current_user["user_id"], min_credits=10.0)
    if not bal["ok"]:
        raise HTTPException(status_code=402, detail=f"Not enough credits. You have {bal['remaining']:.0f}, need at least 10.")
    
    try:
        import google.generativeai as genai
        import os
        from services.chat_tools import get_available_tools, TOOLS_DESCRIPTION
        from services.function_executor import FunctionExecutor
        
        supabase = get_supabase()
        
        # Verify chat belongs to user
        logger.info(f"🔍 Verifying chat ownership for user {current_user['user_id']}")
        chat_rows = supabase.table("chats")\
            .select("*")\
            .eq("id", chat_id)\
            .eq("user_id", current_user["user_id"])\
            .limit(1)\
            .execute()
        
        if not chat_rows.data:
            logger.error(f"❌ Chat {chat_id} not found for user {current_user['user_id']}")
            raise HTTPException(status_code=404, detail="Chat not found")
        
        class _ChatWrap:
            data = chat_rows.data[0]
        chat = _ChatWrap()
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
            
            model_name = 'gemini-3-flash-preview'
            logger.info(f"🤖 Using model: {model_name}")
            
            # Get current date
            current_date = datetime.now().strftime("%B %d, %Y")
            
            # Get available tools
            tools_list = get_available_tools()
            logger.info(f"🔧 Loaded {len(tools_list)} tool definitions")
            
            # IMPORTANT: Do NOT pass tools directly as list of dicts
            # Instead, disable tools temporarily until we get proper SDK format working
            tools = None
            logger.warning("⚠️ Function calling temporarily disabled due to SDK compatibility")
            
            # Get company context + campaign data
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
                        metadata = acc.get('metadata', {}) or {}
                        brand_kit = metadata.get('brand_kit', {}) or {}
                        
                        company_context = f"""
DEFAULT COMPANY CONTEXT:
- Company: {brand_kit.get('business_name') or acc.get('name', 'Not specified')}
- Industry: {brand_kit.get('industry') or acc.get('industry', 'Not specified')}
- Description: {brand_kit.get('description') or acc.get('description', 'Not specified')}
- Products/Services: {', '.join(brand_kit.get('products', [])) or 'Not specified'}
- Key Features: {', '.join(brand_kit.get('key_features', [])) or 'Not specified'}
- Target Audience: {acc.get('target_audience', 'General audience')}
- Brand Voice: {brand_kit.get('brand_voice') or acc.get('brand_voice', 'professional')}
- Brand Colors: {', '.join(brand_kit.get('brand_colors', []) or acc.get('brand_colors', []) or [])}
- Website: {brand_kit.get('website_url') or metadata.get('website_url', 'Not provided')}
- Logo: {brand_kit.get('logo_url') or acc.get('logo_url', '')}
- Marketing Goal: {metadata.get('marketing_goal', 'Not specified')}
- Geographic Focus: {metadata.get('geographic_focus', 'Not specified')}
- Budget Range: {metadata.get('budget_range', 'Not specified')}
"""

                    # Load campaign data from ad_campaigns table
                    campaigns_ctx = ""
                    try:
                        campaigns = supabase.table("ad_campaigns")\
                            .select("*")\
                            .eq("account_id", account_id)\
                            .order("spend", desc=True)\
                            .limit(20)\
                            .execute()
                        
                        if campaigns.data:
                            campaigns_ctx = "\nAD CAMPAIGNS DATA (real user data from Google Ads / Meta Ads):\n"
                            for c in campaigns.data:
                                campaigns_ctx += (
                                    f"- [{c.get('platform','?').upper()}] \"{c.get('campaign_name','?')}\" "
                                    f"status={c.get('status','?')} | "
                                    f"spend=${c.get('spend',0):.2f} | "
                                    f"impressions={c.get('impressions',0)} | "
                                    f"clicks={c.get('clicks',0)} | "
                                    f"ctr={c.get('ctr',0):.2%} | "
                                    f"conversions={c.get('conversions',0)} | "
                                    f"cpa=${c.get('cost_per_conversion',0):.2f} | "
                                    f"roas={c.get('roas',0)}\n"
                                )
                            campaigns_ctx += "\nUse this data to give specific, data-driven recommendations. Reference campaign names and numbers.\n"
                    except Exception as camp_err:
                        logger.warning(f"Could not load campaign data: {camp_err}")
                    
                    company_context += campaigns_ctx
                    
                    company_context += """
CONTEXT RULES:
1. Use company + campaign data as DEFAULT context
2. If user asks about campaigns, use the REAL data above
3. Reference specific campaign names and metrics in your answers
4. User's prompt has PRIORITY over company context
5. Be an expert marketing advisor — give actionable, specific advice
"""
            except Exception as e:
                logger.warning(f"Could not load company context: {e}")
            
            is_advisor = request.mode == 'advisor'
            
            if is_advisor:
                system_instruction = f"""You are the world's most elite Marketing Strategist and CMO. Your expertise covers behavioral economics, data-driven growth hacking, and high-level brand positioning. Today is {current_date}.

{company_context}

STRATEGIC DIRECTIVES:
1. WAIT FOR INPUT: Do not provide unsolicited advice. Wait for the user's specific challenge.
2. THINK LIKE A CMO: Your responses must be high-level, strategic, and direct. Use marketing terminology correctly (LTV, CAC, ROAS, Flywheel, Blue Ocean Strategy).
3. DEEP PSYCHOLOGY: Every strategy must consider the user's 'Right Brain' (Emotion/Status) and 'Left Brain' (Logic/Utility).
4. NO AI FLUFF:
   - STRICTLY NO em-dashes.
   - No generic intros like 'As an AI, I can help...'.
   - Get straight to the strategic breakthrough.
5. STRUCTURE:
   - **Executive Summary** (Bold, 1-2 sentences).
   - **Strategic Breakdown** (Bullet points with deep insights).
   - **The Winning Move** (One high-impact action the user can take NOW).
6. TONE: Authoritative, decisive, and sophisticated. You are the smartest person in the room.

DATA ANALYSIS: When the user asks about campaigns, reference real campaign names, exact numbers, and trends from the data above. Flag underperformers, suggest budget reallocation, compare campaigns.

LANGUAGE: ALWAYS respond in the SAME LANGUAGE the user writes in (Russian, English, Hebrew, etc).

FORMAT: Use bold headers, bullet points, and structured tables for data comparisons. Never output JSON."""
            else:
                system_instruction = f"""You are Joyo Marketing AI assistant. Today's date is {current_date}.

{company_context}

{TOOLS_DESCRIPTION}

LANGUAGE RULES:
- ALWAYS respond in the SAME LANGUAGE the user writes in
- Russian → Russian, English → English, Hebrew → Hebrew

CRITICAL ACTION RULES:
🚨 WHEN USER ASKS TO CREATE/GENERATE GOOGLE ADS:
   You MUST respond with a JSON action. Extract the topic from user's message and use this format:
   
   ```json
   {{
     "action": "generate_google_ads",
     "params": {{
       "keywords": "topic here",
       "language": "ru",
       "website_url": ""
     }}
   }}
   ```
   
   Example conversations:
   - User: "создай рекламу для кофейни" 
     → Response: Brief intro text, then JSON:
     ```json
     {{"action": "generate_google_ads", "params": {{"keywords": "кофейня", "language": "ru"}}}}
     ```
   
   - User: "create ads for coffee shop"
     → Response: Brief intro, then JSON:
     ```json
     {{"action": "generate_google_ads", "params": {{"keywords": "coffee shop", "language": "en"}}}}
     ```

AVAILABLE ACTIONS:
1. generate_google_ads - Generate Google Ads content
2. get_campaigns - Get Google Ads campaigns
3. generate_social_posts - Generate social media posts

IMPORTANT:
- When user asks for Google Ads generation, respond ONLY with the JSON action
- Add brief explanation in Russian/English after the JSON
- Do NOT write ad copy yourself - delegate to the action"""
            
            # Create model
            if tools:
                model = genai.GenerativeModel(
                    model_name,
                    system_instruction=system_instruction,
                    tools=tools,
                    tool_config={'function_calling_config': {'mode': 'AUTO'}}
                )
                logger.info(f"✅ Model created with tools enabled")
            else:
                model = genai.GenerativeModel(
                    model_name,
                    system_instruction=system_instruction
                )
                logger.info(f"✅ Model created without tools")
            
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
            
            # Send message and handle actions
            logger.info(f"📤 Sending message to Gemini: {request.content[:100]}")
            response = chat_session.send_message(request.content)
            logger.info(f"📥 Received response from Gemini")
            
            # Get text response
            ai_content = response.text
            logger.info(f"✅ Gemini response ({len(ai_content)} chars): {ai_content[:300]}...")
            
            # Track API usage metrics
            try:
                from services.credits_service import record_usage
                
                # Get token counts from response
                input_tokens = response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else 0
                output_tokens = response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else 0
                total_tokens = response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0
                
                # Record real usage metrics with Gemini's total
                await record_usage(
                    user_id=current_user["user_id"],
                    service_type="gemini_chat",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,  # Pass Gemini's total directly
                    model_name=model_name,
                    metadata={
                        "chat_id": chat_id,
                        "message_length": len(request.content),
                        "response_length": len(ai_content)
                    }
                )
                logger.info(f"📊 Recorded {input_tokens + output_tokens} tokens (in:{input_tokens}, out:{output_tokens})")
            except Exception as e:
                logger.warning(f"⚠️ Failed to track usage: {e}")
            
            # Check if response contains JSON action
            import re
            import json
            
            if not is_advisor:
                logger.info("🔍 Searching for JSON action in response...")
                
                json_match = None
                code_block_match = re.search(r'```json\s*(\{.+?\})\s*```', ai_content, re.DOTALL)
                if code_block_match:
                    json_match = code_block_match
                    logger.info("📋 Found JSON in code block")
                
                if not json_match:
                    inline_match = re.search(r'\{[^{}]*"action"[^{}]*"params"[^{}]*\{[^{}]*\}[^{}]*\}', ai_content, re.DOTALL)
                    if inline_match:
                        json_match = inline_match
                        logger.info("📋 Found inline JSON")
                
                if json_match:
                    try:
                        json_str = json_match.group(1) if code_block_match else json_match.group(0)
                        logger.info(f"📄 Extracted JSON: {json_str[:200]}")
                        
                        action_json = json.loads(json_str)
                        action_type = action_json.get('action')
                        action_params = action_json.get('params', {})
                        
                        logger.info(f"🎯 Detected action: {action_type}")
                        
                        action_map = {
                            'generate_google_ads': 'generate_google_ads_content',
                            'get_campaigns': 'get_google_ads_campaigns',
                            'generate_social_posts': 'generate_social_media_posts'
                        }
                        
                        function_name = action_map.get(action_type)
                        if function_name:
                            logger.info(f"🚀 Executing function: {function_name}")
                            
                            result = None
                            if function_name == 'generate_google_ads_content':
                                result = await executor._generate_google_ads_content(action_params)
                            elif function_name == 'get_google_ads_campaigns':
                                result = await executor._get_google_ads_campaigns(action_params)
                            elif function_name == 'generate_social_media_posts':
                                result = await executor._generate_social_media_posts(action_params)
                            
                            if result:
                                logger.info(f"✅ Action executed: success={result.get('success')}")
                                
                                tool_message = None
                                try:
                                    action_type_map = {
                                        'generate_google_ads_content': 'google_ads',
                                        'generate_social_media_posts': 'post_generation',
                                        'get_google_ads_campaigns': 'campaigns_data'
                                    }
                                    frontend_action_type = action_type_map.get(function_name, function_name)
                                    
                                    action_msg = supabase.table("chat_messages").insert({
                                        "chat_id": chat_id,
                                        "role": "tool",
                                        "content": f"Executed: {function_name}",
                                        "action_type": frontend_action_type,
                                        "action_data": {"status": "expanded", "generatedContent": result}
                                    }).execute()
                                    logger.info(f"💾 Saved action to database with action_type={frontend_action_type}")
                                    
                                    if action_msg.data:
                                        tool_message = action_msg.data[0] if isinstance(action_msg.data, list) else action_msg.data
                                except Exception as db_err:
                                    logger.error(f"Failed to save action to DB: {db_err}")
                                
                                if result.get('success') and result.get('headlines'):
                                    result_text = f"\n\n✅ Сгенерировано:\n- {len(result['headlines'])} заголовков\n- {len(result.get('descriptions', []))} описаний\n\nРезультаты сохранены в истории чата."
                                    ai_content = re.sub(r'```json.+?```', result_text, ai_content, flags=re.DOTALL)
                                    ai_content = re.sub(r'\{[^{}]*"action"[^{}]*"params"[^{}]*\{[^{}]*\}[^{}]*\}', result_text, ai_content)
                            else:
                                logger.warning(f"⚠️ Function returned None")
                        else:
                            logger.warning(f"⚠️ Unknown action type: {action_type}")
                            
                    except json.JSONDecodeError as e:
                        logger.warning(f"⚠️ Failed to parse action JSON: {e}")
                    except Exception as e:
                        logger.error(f"❌ Error executing action: {e}")
                        logger.exception("Full error:")
                else:
                    logger.info("ℹ️ No JSON action detected in response")
            else:
                logger.info("ℹ️ Advisor mode — action detection skipped")
            
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
        
        # Prepare response with all messages
        response_data = {
            "success": True,
            "user_message": user_msg.data[0],
            "assistant_message": assistant_msg.data[0]
        }
        
        # Include tool message if action was executed
        if 'tool_message' in locals() and tool_message:
            response_data["tool_message"] = tool_message
            logger.info(f"📤 Returning tool message to frontend")
        
        return response_data
        
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


