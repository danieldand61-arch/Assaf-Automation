"""
Chat Tools - Function declarations for Gemini AI
Defines all available tools/functions that Gemini can call
Compatible with google-generativeai SDK
"""
from typing import List
import google.generativeai as genai

def get_available_tools() -> List:
    """
    Returns all available tools for Gemini function calling
    Uses proper FunctionDeclaration format
    """
    
    # Define functions using dictionary format (compatible with all SDK versions)
    tools = [
        {
            "name": "get_google_ads_campaigns",
            "description": "Get list of Google Ads campaigns with performance metrics",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_range": {
                        "type": "string",
                        "description": "Date range: TODAY, LAST_7_DAYS, LAST_30_DAYS",
                        "enum": ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS"]
                    }
                }
            }
        },
        {
            "name": "generate_google_ads_content",
            "description": "Generate Google Ads headlines and descriptions using AI. ALWAYS use this function when user asks to create or generate Google Ads. This is a REQUIRED tool call for ad generation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "keywords": {
                        "type": "string",
                        "description": "Keywords or topic for the ads (e.g., 'кофейня', 'coffee shop', 'веломагазин')"
                    },
                    "website_url": {
                        "type": "string",
                        "description": "Website URL if available (optional)"
                    },
                    "language": {
                        "type": "string",
                        "description": "Language code (en, ru, he, etc). Default: en"
                    }
                },
                "required": ["keywords"]
            }
        },
        {
            "name": "generate_social_media_posts",
            "description": "Generate social media posts for multiple platforms",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {
                        "type": "string",
                        "description": "Topic or keywords for posts"
                    },
                    "platforms": {
                        "type": "array",
                        "description": "Target platforms",
                        "items": {
                            "type": "string",
                            "enum": ["instagram", "facebook", "linkedin", "twitter", "tiktok"]
                        }
                    }
                },
                "required": ["topic"]
            }
        }
    ]
    
    return tools


# Tool descriptions for system prompt
TOOLS_DESCRIPTION = """
You have access to the following tools:

GOOGLE ADS TOOLS:
- get_google_ads_campaigns: Get campaigns with performance data
- generate_google_ads_content: Generate AI-powered ad headlines & descriptions

CONTENT GENERATION:
- generate_social_media_posts: Generate posts for Instagram, Facebook, LinkedIn, Twitter, TikTok

IMPORTANT USAGE RULES:
1. Use tools to provide real data, not assumptions
2. If user asks about campaigns, use get_google_ads_campaigns
3. If user wants to create ads, use generate_google_ads_content
4. Be proactive - suggest relevant tools
5. Explain what you're doing when using tools
"""
