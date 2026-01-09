from typing import List, Dict
import google.generativeai as genai
import json
from main import PostVariation


async def generate_posts(
    website_data: Dict,
    keywords: str,
    platforms: List[str],
    style: str,
    target_audience: str,
    industry: str,
    include_emojis: bool
) -> List[PostVariation]:
    """Generates social media post variations using Gemini 2.5 Pro"""
    
    import logging
    logger = logging.getLogger(__name__)
    
    # Build prompt for Gemini
    prompt = _build_prompt(
        website_data, keywords, platforms, style, 
        target_audience, industry, include_emojis
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
    industry: str,
    include_emojis: bool
) -> str:
    """Builds prompt for Gemini 2.5 Pro"""
    
    emoji_instruction = "Use emojis for more emotional impact." if include_emojis else "Don't use emojis."
    
    platforms_str = " and ".join(platforms)
    
    prompt = f"""
Create 4 post variations for {platforms_str} based on the following information:

BRAND INFORMATION:
- Name: {website_data.get('title', 'N/A')}
- Description: {website_data.get('description', 'N/A')}
- Main content: {website_data.get('content', 'N/A')[:500]}
- Brand voice: {website_data.get('brand_voice', 'professional')}
- Products/services: {', '.join(website_data.get('products', []))}
- Key features: {', '.join(website_data.get('key_features', []))}

POST REQUIREMENTS:
- Keywords: {keywords}
- Style: {style}
- Target audience: {target_audience}
- Industry: {industry}
- {emoji_instruction}

FOR EACH VARIATION CREATE:
1. Main post text (hook + message + CTA)
2. 8-12 relevant hashtags
3. Strong call-to-action (CTA)
4. Estimated engagement score (0-100)

RESPONSE FORMAT - STRICT JSON (NO MARKDOWN, NO EXTRA TEXT):
{{
  "variations": [
    {{
      "text": "Full post text here",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
      "call_to_action": "Shop Now",
      "engagement_score": 85
    }}
  ]
}}

CRITICAL RULES:
- Return ONLY valid JSON, nothing else
- NO markdown code blocks (no ```json)
- NO trailing commas in arrays
- ALL hashtags MUST be inside the hashtags array
- Engagement score must be a NUMBER not string
- Create exactly 4 variations

IMPORTANT:
- {"For Instagram: more hashtags, visual focus" if "instagram" in platforms else ""}
- {"For Facebook: longer text, focus on storytelling" if "facebook" in platforms else ""}
- First line must GRAB attention
- Each variation should be unique in approach
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
