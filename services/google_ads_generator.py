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
    
    logger.info("🎯 ===== GOOGLE ADS SERVICE START =====")
    logger.info(f"🎯 Website data: {website_data.get('title', 'N/A') if website_data else 'No URL provided'}")
    logger.info(f"🎯 Keywords: {keywords}")
    logger.info(f"🎯 Location: {target_location}")
    
    # Build comprehensive prompt
    try:
        logger.info("🎯 Building prompt...")
        prompt = _build_google_ads_prompt(
            website_data, keywords, target_location, language
        )
        logger.info(f"✅ Prompt built (length: {len(prompt)} chars)")
    except Exception as e:
        logger.error(f"❌ Error building prompt: {str(e)}")
        raise
    
    # Use Gemini 2.5 Flash
    model_name = 'gemini-3-flash-preview'
    logger.info(f"🔍 Using model: {model_name}")
    
    try:
        logger.info("🎯 Creating Gemini model...")
        model = genai.GenerativeModel(model_name)
        logger.info("✅ Model created")
        
        logger.info("🎯 Calling Gemini API...")
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.7,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": 8192,
            }
        )
        logger.info("✅ Gemini API responded")
        
        content = response.text
        logger.info(f"✅ Received response (length: {len(content)} chars)")
        logger.info(f"🎯 Response preview: {content[:200]}...")
        
        # Parse response
        logger.info("🎯 Parsing response...")
        ads_package = _parse_google_ads_response(content)
        logger.info(f"✅ Parsed: {len(ads_package['headlines'])} headlines, {len(ads_package['descriptions'])} descriptions")
        logger.info("🎯 ===== GOOGLE ADS SERVICE SUCCESS =====")
        
        return ads_package
        
    except Exception as e:
        logger.error(f"❌ ===== GOOGLE ADS SERVICE FAILED =====")
        logger.error(f"❌ Error type: {type(e).__name__}")
        logger.error(f"❌ Error message: {str(e)}")
        logger.exception("❌ Full traceback:")
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
        "pt": "Portuguese",
        "ru": "Russian"
    }
    language_name = language_names.get(language, "English")
    
    location_context = f"Target location: {target_location}" if target_location else "Targeting: Online audience"
    
    # Handle case when website_data is None
    if website_data:
        brand = website_data.get('title', 'N/A')
        description = website_data.get('description', 'N/A')
        products = ', '.join(website_data.get('products', []))
        features = ', '.join(website_data.get('key_features', []))
        industry = website_data.get('industry', 'general')
    else:
        brand = 'Based on keywords'
        description = f'Business related to: {keywords}'
        products = 'See keywords'
        features = 'See keywords'
        industry = 'general'
    
    prompt = f"""
You are a GOOGLE ADS EXPERT creating MAXIMUM PERFORMANCE Responsive Search Ads (RSA).

═══════════════════════════════════════════════════════════════
📊 BUSINESS INFORMATION:
═══════════════════════════════════════════════════════════════
- Brand: {brand}
- Description: {description}
- Products/Services: {products}
- Key Features: {features}
- Industry: {industry}

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
1-3: Primary keywords focus ("Water Damage Repair LA") - 25-30 chars
4-6: Benefits/Value props ("Fast 24/7 Emergency Service") - 25-30 chars
7-9: Strong CTAs ("Call Now For Free Quote") - 20-28 chars
10-12: Unique selling points ("IICRC Certified Experts") - 22-28 chars
13-14: Urgency/Scarcity ("Limited Time Offer") - 18-25 chars
15: Social proof/Trust ("5-Star Rated Company") - 20-28 chars

Each headline MUST:
- Be EXACTLY 30 characters or less (including spaces) - AIM FOR 25-29 for safety
- Be meaningfully different from others
- Not repeat exact phrases
- Follow Google Ads policies
- Be a complete phrase (no cut-off words)

═══════════════════════════════════════════════════════════════
📝 DESCRIPTIONS REQUIREMENTS (4 TOTAL):
═══════════════════════════════════════════════════════════════
D1: Primary UVP (why choose you) - 85-90 chars (aim for 85-88)
D2: Service details (what you offer) - 85-90 chars (aim for 85-88)
D3: Process/Education (how it works) - 85-90 chars (aim for 85-88)
D4: Strong CTA with urgency (why act now) - 85-90 chars (aim for 85-88)

CRITICAL: Each description MUST be a COMPLETE sentence with proper ending.
Do NOT exceed 90 characters. Aim for 85-88 to ensure clean endings.
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
        
        # Validate character limits - smart truncation at word boundaries
        for i, h in enumerate(headlines):
            if len(h) > 30:
                logger.warning(f"⚠️ Headline {i+1} exceeds 30 chars: {len(h)}")
                # Find last space before 30 chars
                truncated = h[:30]
                last_space = truncated.rfind(' ')
                if last_space > 20:  # Only if space is reasonably close
                    headlines[i] = h[:last_space].rstrip()
                else:
                    headlines[i] = h[:30].rstrip()
        
        for i, d in enumerate(descriptions):
            if len(d) > 90:
                logger.warning(f"⚠️ Description {i+1} exceeds 90 chars: {len(d)}")
                # Find last space before 90 chars to avoid cutting mid-word
                truncated = d[:90]
                last_space = truncated.rfind(' ')
                if last_space > 75:  # Only if space is reasonably close (within 15 chars)
                    descriptions[i] = d[:last_space].rstrip()
                else:
                    descriptions[i] = d[:90].rstrip()
        
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
