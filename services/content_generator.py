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
    model_name = 'gemini-3-flash-preview'
    logger.info(f" DEBUG: Using model: {model_name}")
    
    try:
        model = genai.GenerativeModel(model_name)
        logger.info(f" DEBUG: Model object created successfully")
        
        logger.info(f" DEBUG: Calling generate_content...")
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.8,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 8192,  # Increased for 4 variations with hashtags
            }
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
    """Builds prompt for Gemini 3 Flash Preview with marketing psychology integration"""
    
    # Language names for prompt
    language_names = {
        "en": "English",
        "he": "Hebrew",
        "es": "Spanish",
        "pt": "Portuguese"
    }
    language_name = language_names.get(language, "English")
    
    emoji_instruction = "Use emojis strategically for emotional impact." if include_emojis else "Don't use emojis."
    
    platforms_str = " and ".join(platforms)
    
    # Determine if B2B or B2C
    is_b2b = target_audience.lower() in ["b2b", "business owners", "professionals", "enterprises"]
    audience_guidance = """
B2B FOCUS:
- Address fear of failure and risk mitigation
- Build trust and authority (social proof, credentials)
- Provide rational justification (ROI, efficiency gains)
- Help decision-maker look smart to their team
- Use: "Proven system", "Industry leaders trust us", "Reduce costs by X%"
""" if is_b2b else """
B2C FOCUS:
- Lead with lifestyle and identity transformation
- Emotional connection and aspiration
- Faster hooks and visual storytelling
- Use: "Transform your...", "Feel amazing", "Join thousands who..."
"""
    
    # Platform-specific rules for Caption Intelligence
    platform_rules = {
        "facebook":        "Facebook: conversational, medium length (100-250 words), community angle, storytelling. Ask questions to boost engagement. 3-5 hashtags.",
        "instagram":       "Instagram: visual-focused, emoji-friendly, lifestyle tone. 8-15 hashtags (mix trending + niche). Use line breaks for readability. Under 2200 chars.",
        "linkedin":        "LinkedIn: professional thought-leadership tone, longer (150-300 words). Data-driven, no emojis unless subtle. 3-5 industry hashtags. Under 3000 chars.",
        "tiktok":          "TikTok: casual, trending, Gen-Z friendly, very short (1-3 sentences). Use trending phrases. 3-6 hashtags with #fyp #viral. Under 2200 chars.",
        "x":               "X (Twitter): short, punchy, under 280 chars total including hashtags. One strong hook. 1-3 hashtags max. No fluff.",
        "google_business": "Google Business: factual, local-SEO optimized, include location keywords. Service-focused, professional. No hashtags. Under 1500 chars.",
    }

    # Build per-platform instruction block
    platform_instructions = ""
    for i, p in enumerate(platforms):
        rule = platform_rules.get(p, "General social media post, 100-200 words, 3-5 hashtags.")
        platform_instructions += f"\nVariation {i+1} — for {p.upper()}:\n  {rule}\n"

    num = len(platforms)

    prompt = f"""
Create exactly {num} social media post variation(s) IN {language_name.upper()}.
Each variation is optimized for a SPECIFIC platform. The tone, length, hashtag count, and style MUST be different for each.

BRAND INFORMATION:
- Name: {website_data.get('title', 'N/A')}
- Description: {website_data.get('description', 'N/A')}
- Content: {website_data.get('content', 'N/A')[:500]}
- Voice: {website_data.get('brand_voice', 'professional')}
- Products: {', '.join(website_data.get('products', []))}
- Features: {', '.join(website_data.get('key_features', []))}

POST REQUIREMENTS:
- Language: {language_name} (ALL text in {language_name.upper()})
- Topic/keywords: {keywords}
- Style: {style}
- Audience: {target_audience}
- {emoji_instruction}

{audience_guidance}

PER-PLATFORM INSTRUCTIONS (follow strictly):
{platform_instructions}

POST STRUCTURE: Hook → Problem → Solution → Proof → CTA
Use psychological triggers: social proof, scarcity, authority, reciprocity.

RESPONSE — strict JSON, no markdown:
{{
  "variations": [
    {{
      "platform": "facebook",
      "text": "Full post text optimized for this platform",
      "hashtags": ["tag1", "tag2"],
      "call_to_action": "Learn More",
      "engagement_score": 85
    }}
  ]
}}

RULES:
- Return ONLY valid JSON
- Exactly {num} variations, one per platform in order: {', '.join(platforms)}
- Each variation MUST match its platform's tone, length, and hashtag rules above
- engagement_score is a NUMBER 0-100
- hashtags array of strings without # prefix
"""
    
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
                
            plat = var.get('platform', platforms[i] if i < len(platforms) else '')
            variations.append(PostVariation(
                text=text,
                hashtags=hashtags[:12],
                char_count=len(text),
                engagement_score=float(var.get('engagement_score', 70)) / 100.0,
                call_to_action=var.get('call_to_action', 'Learn more!'),
                platform=plat,
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
        "facebook": 63206,  # Practical limit ~500-1000 for good engagement
        "instagram": 2200,
        "twitter": 280,
        "linkedin": 3000
    }
    return {p: limits.get(p, 1000) for p in platforms}
