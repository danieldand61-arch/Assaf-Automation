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
    include_emojis: bool = True
) -> List[PostVariation]:
    """Generates social media post variations using Gemini 2.5 Pro"""
    
    import logging
    logger = logging.getLogger(__name__)
    
    # Build prompt for Gemini
    prompt = _build_prompt(
        website_data, keywords, platforms, style, 
        target_audience, language, include_emojis
    )
    
    # Use Gemini 2.5 Flash (as requested)
    model_name = 'gemini-2.5-flash'
    logger.info(f"🔍 DEBUG: Using model: {model_name}")
    
    try:
        model = genai.GenerativeModel(model_name)
        logger.info(f"🔍 DEBUG: Model object created successfully")
        
        logger.info(f"🔍 DEBUG: Calling generate_content...")
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
    """Builds prompt for Gemini 2.5 Pro with marketing psychology integration"""
    
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
    
    prompt = f"""
Create 4 post variations for {platforms_str} IN {language_name.upper()} using PROVEN MARKETING PSYCHOLOGY principles.

═══════════════════════════════════════════════════════════════
📊 BRAND INFORMATION:
═══════════════════════════════════════════════════════════════
- Name: {website_data.get('title', 'N/A')}
- Description: {website_data.get('description', 'N/A')}
- Main content: {website_data.get('content', 'N/A')[:500]}
- Brand voice: {website_data.get('brand_voice', 'professional')}
- Products/services: {', '.join(website_data.get('products', []))}
- Key features: {', '.join(website_data.get('key_features', []))}

═══════════════════════════════════════════════════════════════
🎯 POST REQUIREMENTS:
═══════════════════════════════════════════════════════════════
- Language: {language_name} (ALL TEXT MUST BE IN {language_name.upper()})
- Keywords: {keywords}
- Style: {style}
- Target audience: {target_audience}
- {emoji_instruction}

═══════════════════════════════════════════════════════════════
🧠 MARKETING PSYCHOLOGY RULES (CRITICAL):
═══════════════════════════════════════════════════════════════

1. EMOTION FIRST, LOGIC SECOND (95% of decisions are emotional)
   - Lead with emotional benefit ("Transform your business")
   - Then add rational proof ("Proven system, 10,000+ users")

2. LOSS AVERSION (2x more powerful than gain)
   - Frame as "Don't miss/lose" rather than "Get/gain"
   - Emphasize cost of inaction: "While you wait, competitors are..."

3. PSYCHOLOGICAL TRIGGERS (use 1-3 per post):
   - Social Proof: "10,000+ users", "Rated 4.9★", "Industry leaders use..."
   - Scarcity: "Limited time", "Only 3 left", "Offer ends soon"
   - Authority: "Expert-approved", "Certified", "Award-winning"
   - Reciprocity: "Free guide", "Exclusive tip", "Bonus included"
   - Unity: "Join our community", "We understand you", "You're not alone"

4. POST STRUCTURE (Hook → Agitate → Solve → Prove → CTA):
   - Hook: Emotional attention grabber (first 5-7 words are CRITICAL)
   - Agitate: Amplify the problem they face
   - Solve: Present your solution naturally
   - Prove: Add credibility (numbers, testimonials, results)
   - CTA: Clear, action-driven (use power words)

5. POWER WORDS (use naturally):
   - Free, Proven, Guaranteed, Limited, New, Instant, Exclusive
   - Transform, Discover, Unlock, Master, Secret, Breakthrough

6. AUDIENCE ADAPTATION:
{audience_guidance}

═══════════════════════════════════════════════════════════════
📝 FOR EACH VARIATION CREATE:
═══════════════════════════════════════════════════════════════
1. Hook (first line MUST grab attention emotionally)
2. Body (agitate problem → present solution → add proof)
3. Strong CTA with power words
4. 8-12 strategic hashtags (mix popular + niche)
5. Engagement score (0-100) based on psychology applied

VARIATION DIVERSITY:
- Variation 1: Social Proof dominant ("10,000+ users transformed...")
- Variation 2: Scarcity/Urgency focus ("Limited time: Don't miss...")
- Variation 3: Educational value + soft CTA ("Here's how to...")
- Variation 4: Emotional transformation ("Imagine waking up...")

═══════════════════════════════════════════════════════════════
📤 RESPONSE FORMAT - STRICT JSON (NO MARKDOWN):
═══════════════════════════════════════════════════════════════
{{
  "variations": [
    {{
      "text": "Full post text (Hook + Agitate + Solve + Prove + CTA)",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
      "call_to_action": "Shop Now",
      "engagement_score": 85
    }}
  ]
}}

CRITICAL TECHNICAL RULES:
- Return ONLY valid JSON, nothing else
- NO markdown code blocks (no ```json)
- NO trailing commas in arrays
- ALL hashtags MUST be inside the hashtags array
- Engagement score must be a NUMBER not string
- Create exactly 4 variations
- Each variation MUST use different psychological approach

PLATFORM-SPECIFIC:
- {"Instagram: More visual hooks, lifestyle focus, 8-15 hashtags" if "instagram" in platforms else ""}
- {"Facebook: Longer storytelling, community angle, conversational" if "facebook" in platforms else ""}
- {"LinkedIn: Professional value, thought leadership, B2B focus" if "linkedin" in platforms else ""}
- {"Twitter: Punchy hooks, urgency, trending topics" if "twitter" in platforms else ""}
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
                
            variations.append(PostVariation(
                text=text,
                hashtags=hashtags[:12],  # Limit to 12
                char_count=len(text),
                engagement_score=float(var.get('engagement_score', 70)) / 100.0,
                call_to_action=var.get('call_to_action', 'Learn more!')
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
