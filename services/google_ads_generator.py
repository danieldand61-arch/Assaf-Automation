"""
Google Ads RSA Generator - Creates optimized Responsive Search Ads
"""
from typing import List, Dict
import google.generativeai as genai
import json
import logging

logger = logging.getLogger(__name__)


async def generate_google_ads(
    website_data: Dict,
    keywords: str,
    target_location: str = "",
    language: str = "en"
) -> Dict:
    """
    Generates complete Google Responsive Search Ads package
    Returns: 15 headlines, 4 descriptions, extensions
    """
    
    logger.info("🎯 Generating Google Ads RSA with MAXIMUM assets")
    
    # Build comprehensive prompt
    prompt = _build_google_ads_prompt(
        website_data, keywords, target_location, language
    )
    
    # Use Gemini 2.5 Flash
    model_name = 'gemini-2.5-flash'
    logger.info(f"🔍 Using model: {model_name}")
    
    try:
        model = genai.GenerativeModel(model_name)
        
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 8192,
            }
        )
        
        content = response.text
        logger.info(f"✅ Received Google Ads response")
        
        # Parse response
        ads_package = _parse_google_ads_response(content)
        logger.info(f"✅ Parsed Google Ads package with {len(ads_package['headlines'])} headlines")
        
        return ads_package
        
    except Exception as e:
        logger.error(f"❌ Google Ads generation error: {str(e)}")
        raise


def _build_google_ads_prompt(
    website_data: Dict,
    keywords: str,
    target_location: str,
    language: str
) -> str:
    """Builds comprehensive prompt for Google Ads RSA"""
    
    language_names = {
        "en": "English",
        "he": "Hebrew",
        "es": "Spanish",
        "pt": "Portuguese"
    }
    language_name = language_names.get(language, "English")
    
    location_context = f"Target location: {target_location}" if target_location else "Targeting: Online audience"
    
    prompt = f"""
You are a GOOGLE ADS EXPERT creating MAXIMUM PERFORMANCE Responsive Search Ads (RSA).

═══════════════════════════════════════════════════════════════
📊 BUSINESS INFORMATION:
═══════════════════════════════════════════════════════════════
- Brand: {website_data.get('title', 'N/A')}
- Description: {website_data.get('description', 'N/A')}
- Products/Services: {', '.join(website_data.get('products', []))}
- Key Features: {', '.join(website_data.get('key_features', []))}
- Industry: {website_data.get('industry', 'general')}

═══════════════════════════════════════════════════════════════
🎯 CAMPAIGN TARGETING:
═══════════════════════════════════════════════════════════════
- Keywords: {keywords}
- {location_context}
- Language: {language_name}

═══════════════════════════════════════════════════════════════
📏 GOOGLE ADS TECHNICAL REQUIREMENTS (CRITICAL):
═══════════════════════════════════════════════════════════════

CHARACTER LIMITS (MUST FOLLOW EXACTLY):
- Each headline: 30 characters MAXIMUM
- Each description: 90 characters MAXIMUM
- Display path: 15 characters MAXIMUM

MANDATORY ASSET COUNTS (ALWAYS CREATE MAXIMUM):
✅ EXACTLY 15 headlines (not 10, not 12 - EXACTLY 15)
✅ EXACTLY 4 descriptions (use all 4 slots)
✅ 10-12 callout extensions (25 characters each)
✅ 8-10 sitelinks (25 character text + 35 char descriptions)
✅ 8-10 structured snippet values (25 characters each)

POLICY REQUIREMENTS (STRICT):
❌ Maximum 1 exclamation point per headline/description
❌ NO ALL CAPS words (except acronyms like LA, 24/7, CEO, ROI)
❌ NO excessive punctuation (!!!, ???, ***)
❌ NO repetitive words across headlines
❌ NO misleading claims
✅ Professional capitalization (First Letter Of Each Word OR First word of sentence)
✅ Clear, honest value propositions
✅ Unique messaging in each asset

═══════════════════════════════════════════════════════════════
🎯 HEADLINES DIVERSITY REQUIREMENTS (15 TOTAL):
═══════════════════════════════════════════════════════════════
1-3: Primary keywords focus ("Water Damage Repair LA")
4-6: Benefits/Value props ("Fast 24/7 Emergency Service")
7-9: Strong CTAs ("Call Now For Free Quote")
10-12: Unique selling points ("IICRC Certified Experts")
13-14: Urgency/Scarcity ("Limited Time Offer")
15: Social proof/Trust ("5-Star Rated Company")

Each headline MUST:
- Be under 30 characters (including spaces)
- Be meaningfully different from others
- Not repeat exact phrases
- Follow Google Ads policies

═══════════════════════════════════════════════════════════════
📝 DESCRIPTIONS REQUIREMENTS (4 TOTAL):
═══════════════════════════════════════════════════════════════
D1: Primary UVP (why choose you) - 90 chars max
D2: Service details (what you offer) - 90 chars max
D3: Process/Education (how it works) - 90 chars max
D4: Strong CTA with urgency (why act now) - 90 chars max

All must be unique, non-repetitive, and follow policies.

═══════════════════════════════════════════════════════════════
🔧 AD EXTENSIONS (MAXIMIZE AD REAL ESTATE):
═══════════════════════════════════════════════════════════════

CALLOUT EXTENSIONS (10-12 required):
- 25 characters maximum each
- Highlight key benefits/features
- Examples: "24/7 Emergency Service", "Licensed & Insured", "Free Estimates"

SITELINKS (8-10 required):
- Link text: 25 characters max
- Description 1: 35 characters max
- Description 2: 35 characters max
- Examples: "Emergency Services", "Service Areas", "Customer Reviews"

STRUCTURED SNIPPETS (8-10 values):
- Choose 1-2 headers (Services, Types, Brands, Amenities)
- Each value: 25 characters max
- Examples under "Services": "Water Extraction", "Mold Removal", "Flood Cleanup"

═══════════════════════════════════════════════════════════════
🏆 QUALITY & PERFORMANCE OPTIMIZATION:
═══════════════════════════════════════════════════════════════
- Ad Strength Target: EXCELLENT (requires 10-15 headlines, 4 descriptions, extensions)
- Include primary keywords in at least 3-4 headlines
- Vary messaging: emotional, rational, urgent, educational
- Front-load benefits in character limits
- Use power words: Free, Fast, Certified, Guaranteed, Expert, Proven
- Mobile-friendly: Short, punchy phrases
- Include location in 1-2 headlines if local business

═══════════════════════════════════════════════════════════════
📤 RESPONSE FORMAT - STRICT JSON (NO MARKDOWN):
═══════════════════════════════════════════════════════════════
{{
  "headlines": [
    "Headline 1 text here (under 30 chars)",
    ...exactly 15 headlines
  ],
  "descriptions": [
    "Description 1 text here (under 90 chars)",
    ...exactly 4 descriptions
  ],
  "display_paths": ["Path1", "Path2"],
  "callouts": ["Callout 1", "Callout 2", ...10-12 callouts],
  "sitelinks": [
    {{
      "text": "Link Text",
      "description1": "First line desc",
      "description2": "Second line desc"
    }},
    ...8-10 sitelinks
  ],
  "structured_snippets": {{
    "Services": ["Value 1", "Value 2", ...8-10 values]
  }}
}}

CRITICAL VALIDATION RULES:
✅ Return ONLY valid JSON (no markdown, no ```json)
✅ Exactly 15 headlines (count them!)
✅ Exactly 4 descriptions
✅ All headlines under 30 characters
✅ All descriptions under 90 characters
✅ No more than 1 exclamation point per text
✅ No ALL CAPS words (except acronyms)
✅ All callouts/sitelinks/values under their limits
✅ No repetitive phrases across assets

═══════════════════════════════════════════════════════════════
🎯 CREATE THE MAXIMUM PERFORMANCE AD PACKAGE NOW:
═══════════════════════════════════════════════════════════════
- Focus on conversions and Quality Score
- Use psychological triggers (urgency, social proof, scarcity)
- Front-load benefits in limited characters
- Ensure diversity for Google's AI testing
- Prioritize mobile-friendly, action-oriented copy
- Include location/service keywords naturally

BEGIN JSON OUTPUT:
"""
    
    return prompt.strip()


def _parse_google_ads_response(content: str) -> Dict:
    """Parses Gemini response and validates Google Ads requirements"""
    
    try:
        # Remove markdown if present
        content = content.replace('```json', '').replace('```', '').strip()
        
        # Extract JSON
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        
        if json_start == -1 or json_end == 0:
            raise ValueError("No JSON in response")
        
        json_str = content[json_start:json_end]
        data = json.loads(json_str)
        
        # Validate requirements
        headlines = data.get('headlines', [])
        descriptions = data.get('descriptions', [])
        
        if len(headlines) != 15:
            logger.warning(f"⚠️ Expected 15 headlines, got {len(headlines)}")
        
        if len(descriptions) != 4:
            logger.warning(f"⚠️ Expected 4 descriptions, got {len(descriptions)}")
        
        # Validate character limits
        for i, h in enumerate(headlines):
            if len(h) > 30:
                logger.warning(f"⚠️ Headline {i+1} exceeds 30 chars: {len(h)}")
                headlines[i] = h[:30]  # Truncate
        
        for i, d in enumerate(descriptions):
            if len(d) > 90:
                logger.warning(f"⚠️ Description {i+1} exceeds 90 chars: {len(d)}")
                descriptions[i] = d[:90]  # Truncate
        
        # Ensure we return exactly what's required
        return {
            "headlines": headlines[:15],  # Ensure max 15
            "descriptions": descriptions[:4],  # Ensure max 4
            "display_paths": data.get('display_paths', []),
            "callouts": data.get('callouts', [])[:12],  # Max 12
            "sitelinks": data.get('sitelinks', [])[:10],  # Max 10
            "structured_snippets": data.get('structured_snippets', {})
        }
        
    except Exception as e:
        logger.error(f"❌ Error parsing Google Ads response: {str(e)}")
        logger.error(f"Response content: {content[:500]}")
        raise ValueError(f"Failed to parse Google Ads response: {str(e)}")
