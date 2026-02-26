from typing import List, Dict
import google.generativeai as genai
import json
from models import PostVariation


async def generate_posts(
    website_data: Dict,
    keywords: str,
    platforms: List[str],
    style: str,
    target_audience: str,
    language: str = "en",
    include_emojis: bool = True,
    user_id: str = None,
    account_id: str = None
) -> List[PostVariation]:
    """Generates social media post variations using Gemini 3 Flash Preview"""
    
    import logging
    logger = logging.getLogger(__name__)
    
    # Build prompt for Gemini
    prompt = _build_prompt(
        website_data, keywords, platforms, style, 
        target_audience, language, include_emojis
    )
    
    # Use Gemini 2.5 Flash (as requested)
    model_name = 'gemini-3-pro-preview'
    logger.info(f" DEBUG: Using model: {model_name}")
    
    try:
        model = genai.GenerativeModel(model_name)
        logger.info(f" DEBUG: Model object created successfully")
        
        logger.info(f" DEBUG: Calling generate_content...")
        import asyncio
        from functools import partial
        response = await asyncio.to_thread(
            partial(
                model.generate_content,
                prompt,
                generation_config={
                    "temperature": 0.8,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": 8192,
                }
            )
        )
        logger.info(f"🔍 DEBUG: generate_content returned successfully")
        
        # Track credits usage
        if user_id:
            try:
                from services.credits_service import record_usage
                
                # Debug: log response structure
                logger.info(f"🔍 Response type: {type(response)}")
                logger.info(f"🔍 Has usage_metadata: {hasattr(response, 'usage_metadata')}")
                
                if hasattr(response, 'usage_metadata'):
                    logger.info(f"🔍 usage_metadata: {response.usage_metadata}")
                    input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                    output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
                    total_tokens = getattr(response.usage_metadata, 'total_token_count', input_tokens + output_tokens)
                    logger.info(f"📊 Tokens extracted: input={input_tokens}, output={output_tokens}, total={total_tokens}")
                else:
                    logger.warning("⚠️ No usage_metadata in response!")
                    input_tokens = 0
                    output_tokens = 0
                    total_tokens = 0
                
                # Pass total_tokens directly from Gemini instead of letting record_usage recalculate
                await record_usage(
                    user_id=user_id,
                    service_type="social_posts",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,  # NEW: pass Gemini's total directly
                    model_name=model_name,
                    metadata={
                        "keywords": keywords,
                        "platforms": platforms,
                        "language": language,
                        "style": style
                    }
                )
                logger.info(f"✅ Recorded usage: {total_tokens} tokens (Gemini's count)")
            except Exception as e:
                logger.error(f"❌ Failed to track credits: {e}")
                logger.exception("Full tracking error:")
    
    except Exception as e:
        logger.error(f"❌ DEBUG: Error in generate_content: {type(e).__name__}")
        logger.error(f"❌ DEBUG: Error message: {str(e)}")
        raise
    
    content = response.text
    logger.info(f"🔍 DEBUG: Received response text length: {len(content)}")
    logger.info(f"🔍 DEBUG: First 200 chars: {content[:200]}")
    
    # Parse response
    variations = _parse_gemini_response(content, platforms)
    logger.info(f"🔍 DEBUG: Parsed {len(variations)} variations")
    
    return variations


def _build_prompt(
    website_data: Dict,
    keywords: str,
    platforms: List[str],
    style: str,
    target_audience: str,
    language: str,
    include_emojis: bool
) -> str:
    """Builds prompt for Gemini with dual-variant marketing psychology"""
    
    language_names = {"en": "English", "he": "Hebrew", "es": "Spanish", "pt": "Portuguese"}
    language_name = language_names.get(language, "English")
    emoji_instruction = "Use emojis strategically for emotional impact." if include_emojis else "Don't use emojis."
    
    is_b2b = target_audience.lower() in ["b2b", "business owners", "professionals", "enterprises"]
    audience_guidance = """B2B: Address risk mitigation, build authority (social proof, credentials), rational justification (ROI, efficiency), help decision-maker look smart.""" if is_b2b else """B2C: Lead with lifestyle transformation, emotional connection, aspiration, visual storytelling."""

    char_limits = {
        "facebook": 1200, "instagram": 800, "linkedin": 3000,
        "tiktok": 2200, "x": 280, "google_business": 1500,
    }

    platform_rules = {
        "facebook":        "Conversational, community angle, ask questions. 3-5 hashtags. Max 1200 chars. Focus on Engagement.",
        "instagram":       "Visual-focused, lifestyle tone, line breaks for readability. 8-15 hashtags. Max 800 chars. Focus on the Hook.",
        "linkedin":        "Professional thought-leadership, data-driven. 3-5 industry hashtags. Max 3000 chars. Focus on Authority.",
        "tiktok":          "Casual, trending, Gen-Z friendly, very short. 3-6 hashtags with #fyp. Max 2200 chars.",
        "x":               "Short, punchy, under 280 chars total. 1-3 hashtags max. No fluff.",
        "google_business": "Factual, local-SEO optimized. No hashtags. Max 1500 chars.",
    }

    platforms_block = ""
    for p in platforms:
        rule = platform_rules.get(p, "General social media post, 100-200 words, 3-5 hashtags.")
        limit = char_limits.get(p, 1000)
        platforms_block += f"\n{p.upper()} (max {limit} chars): {rule}"

    num = len(platforms) * 2

    prompt = f"""You are JOYO, an elite Senior Creative Director and Behavioral Marketing Strategist. You do NOT write generic "AI content." You engineer high-converting, psychologically-driven social media posts. Your tone is sharp, intelligent, human, and ruthlessly focused on ROI and engagement.

# BRAND CONTEXT
- Business: {website_data.get('title', 'N/A')}
- Industry: {website_data.get('industry', 'N/A')}
- Description: {website_data.get('description', 'N/A')}
- Website content: {website_data.get('content', 'N/A')[:500]}
- Brand Voice: {website_data.get('brand_voice', 'professional')}
- Products: {', '.join(website_data.get('products', []))}
- Key Features: {', '.join(website_data.get('key_features', []))}

# USER REQUEST
- Topic: {keywords}
- Style: {style}
- Audience: {target_audience}
- Language: {language_name} (ALL output text MUST be in {language_name.upper()})
- {emoji_instruction}
- {audience_guidance}

# PLATFORM RULES{platforms_block}

# ANTI-FLUFF PROTOCOL (STRICT)
You are forbidden from sounding like generic AI.
- BANNED WORDS/PHRASES: "Unlock", "Revolutionize", "Discover the power of", "Elevate", "In today's fast-paced world", "Ultimate", "Seamless", "Transform", "Welcome to the future of", "Game-changer", "Take it to the next level."
- EMOJIS: Maximum 1-2 per post. NEVER use emojis as bullet points.
- Write like a top-tier human copywriter. Short punchy sentences. Vary sentence length. Ask provocative questions. Speak directly to the reader's pain.
- Absolutely NO em-dashes. Use commas, periods, or ellipsis instead.

# POST STRUCTURE (BLANK LINES between sections):
Hook\\n\\n
Body (Problem → Solution → Proof)\\n\\n
CTA

- Hook: 3-6 word curiosity-gap opening. MUST stand alone as its own paragraph.
- Body: Problem → Solution → Proof woven together naturally. Include one concrete element (stat, number, testimonial, before/after).
- CTA: Direct, urgency-driven call to action. MUST be its own paragraph.

# PSYCHOLOGICAL FRAMEWORKS
For EACH platform, generate exactly 2 variations:

Variant A "storyteller" (PAS Framework):
- Problem (Hook): A visceral, highly relatable frustration or pain point.
- Agitation: Twist the knife. Why does this cost them time/money/peace of mind? Make it emotional.
- Solution: Introduce the product naturally as the inevitable relief.

Variant B "closer" (AIDA Framework):
- Attention: A scroll-stopping, contrarian hook or bold claim.
- Interest: A compelling fact, data point, or unique mechanism from the brand data.
- Desire: The core emotional benefit (status, wealth, time saved).
- Action: A clear, frictionless CTA.

# BRAND VOICE ADAPTATION
- If Professional: authoritative, data-backed language, industry terminology.
- If Bold: aggressive, short, provocative statements.
- If Casual: speak like a trusted friend, conversational.
- If Luxury: exclusive, refined, aspirational.

# STRATEGIST'S NOTE
For EACH variation, write a 1-sentence "strategist_note" explaining WHY this specific psychological trigger and angle will convert for this niche. This note is for the business owner, written in {language_name}.

# STRICT RULES
1. Every variation MUST have paragraph breaks (Hook, body, CTA as separate blocks).
2. Total: exactly {num} variations ({len(platforms)} platforms x 2 variants each).
3. Respect each platform's character limit strictly.
4. No AI fingerprints. Human rhythm. Contrarian angles welcome.
5. Option 1 (storyteller) = direct answer to the topic. Option 2 (closer) = a creative out-of-the-box angle from the brand data.

# RESPONSE FORMAT - strict JSON, no markdown:
{{
  "variations": [
    {{
      "platform": "instagram",
      "variant_type": "storyteller",
      "text": "Full post text with \\n\\n paragraph breaks",
      "hashtags": ["tag1", "tag2"],
      "call_to_action": "Shop Now",
      "engagement_score": 85,
      "strategist_note": "One sentence explaining why this angle converts for this niche"
    }},
    {{
      "platform": "instagram",
      "variant_type": "closer",
      "text": "Full post text with \\n\\n paragraph breaks",
      "hashtags": ["tag1", "tag2"],
      "call_to_action": "Learn More",
      "engagement_score": 80,
      "strategist_note": "One sentence explaining why this angle converts for this niche"
    }}
  ]
}}

Platform order: {', '.join(platforms)}. For each platform, storyteller first, then closer.
engagement_score is NUMBER 0-100. hashtags without # prefix. Return ONLY valid JSON."""
    
    return prompt


def _parse_gemini_response(content: str, platforms: List[str]) -> List[PostVariation]:
    """Parses Gemini response and creates PostVariation objects"""
    
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"🔍 DEBUG: Parsing response, content length: {len(content)}")
        
        # Remove markdown code blocks if present
        content = content.replace('```json', '').replace('```', '').strip()
        
        # Extract JSON from response
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        
        if json_start == -1 or json_end == 0:
            logger.error(f"❌ DEBUG: No JSON found in response!")
            logger.error(f"🔍 DEBUG: Response content: {content[:500]}")
            raise ValueError("No JSON in response")
        
        json_str = content[json_start:json_end]
        logger.info(f"🔍 DEBUG: Extracted JSON string length: {len(json_str)}")
        logger.info(f"🔍 DEBUG: JSON preview: {json_str[:300]}...")
        
        # Try to fix common JSON errors
        # Fix: remove items after closing bracket in arrays
        import re
        # This regex tries to fix: ],  "item",  by removing the extra items
        json_str = re.sub(r'(\])\s*,\s*"[^"]*"\s*,', r'\1,', json_str)
        
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.error(f"❌ JSON decode failed: {e}")
            logger.error(f"🔍 Trying to save the first valid variation...")
            
            # Try to extract at least the first variation
            match = re.search(r'"variations"\s*:\s*\[\s*(\{[^}]*"text"[^}]*\})', json_str, re.DOTALL)
            if match:
                first_var = match.group(1)
                json_str = f'{{"variations": [{first_var}]}}'
                data = json.loads(json_str)
                logger.info(f"✅ Recovered at least 1 variation!")
            else:
                raise
        
        logger.info(f"🔍 DEBUG: JSON parsed successfully!")
        logger.info(f"🔍 DEBUG: Variations in data: {len(data.get('variations', []))}")
        
        variations = []
        for i, var in enumerate(data.get('variations', [])):
            logger.info(f"🔍 DEBUG: Processing variation {i+1}...")
            text = var.get('text', '')
            if not text:
                continue
                
            # Clean hashtags - remove any that are not strings
            hashtags = var.get('hashtags', [])
            if isinstance(hashtags, list):
                hashtags = [h for h in hashtags if isinstance(h, str)]
            else:
                hashtags = []
                
            plat = var.get('platform', platforms[i // 2] if i // 2 < len(platforms) else '')
            vtype = var.get('variant_type', 'storyteller' if i % 2 == 0 else 'closer')
            variations.append(PostVariation(
                text=text,
                hashtags=hashtags[:12],
                char_count=len(text),
                engagement_score=float(var.get('engagement_score', 70)) / 100.0,
                call_to_action=var.get('call_to_action', 'Learn more!'),
                platform=plat,
                variant_type=vtype,
                strategist_note=var.get('strategist_note', ''),
            ))
        
        logger.info(f"✅ DEBUG: Successfully parsed {len(variations)} variations!")
        if not variations:
            raise ValueError("No valid variations found")
        return variations
        
    except Exception as e:
        logger.error(f"❌ DEBUG: Error parsing Gemini response: {type(e).__name__}: {str(e)}")
        logger.error(f"🔍 DEBUG: Full response content:\n{content}")
        logger.exception("Full traceback:")
        # Fallback: create basic variation
        return [
            PostVariation(
                text=f"Check out our latest updates! Visit our website to learn more. #marketing #business",
                hashtags=["marketing", "business", "digital"],
                char_count=75,
                engagement_score=0.70,
                call_to_action="Learn more!"
            )
        ]


def _calculate_char_limits(platforms: List[str]) -> Dict[str, int]:
    """Returns character limits for platforms"""
    limits = {
        "facebook": 1200,
        "instagram": 800,
        "twitter": 280,
        "x": 280,
        "linkedin": 3000,
        "tiktok": 2200,
        "google_business": 1500,
    }
    return {p: limits.get(p, 1000) for p in platforms}
