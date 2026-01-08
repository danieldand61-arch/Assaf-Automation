from typing import List, Dict
import google.generativeai as genai
import json
from backend.main import PostVariation


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
    
    # Build prompt for Gemini
    prompt = _build_prompt(
        website_data, keywords, platforms, style, 
        target_audience, industry, include_emojis
    )
    
    # Use Gemini 1.5 Pro for high-quality creative content
    model = genai.GenerativeModel('gemini-1.5-pro')
    
    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.8,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 2048,
        }
    )
    
    content = response.text
    
    # Parse response
    variations = _parse_gemini_response(content, platforms)
    
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

RESPONSE FORMAT (strict JSON):
{{
  "variations": [
    {{
      "text": "Full post text",
      "hashtags": ["hashtag1", "hashtag2", ...],
      "call_to_action": "Call to action",
      "engagement_score": 85
    }},
    ...
  ]
}}

IMPORTANT:
- {"For Instagram: more hashtags, visual focus" if "instagram" in platforms else ""}
- {"For Facebook: longer text, focus on storytelling" if "facebook" in platforms else ""}
- First line must GRAB attention
- Each variation should be unique in approach
"""
    
    return prompt


def _parse_gemini_response(content: str, platforms: List[str]) -> List[PostVariation]:
    """Parses Gemini response and creates PostVariation objects"""
    
    try:
        # Extract JSON from response
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        json_str = content[json_start:json_end]
        
        data = json.loads(json_str)
        
        variations = []
        for var in data.get('variations', []):
            text = var['text']
            variations.append(PostVariation(
                text=text,
                hashtags=var.get('hashtags', []),
                char_count=len(text),
                engagement_score=var.get('engagement_score', 70) / 100.0,
                call_to_action=var.get('call_to_action', 'Learn more!')
            ))
        
        return variations
        
    except Exception as e:
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
