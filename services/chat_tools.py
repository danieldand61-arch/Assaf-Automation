"""
Chat Tools - Function declarations for Gemini AI
Defines all available tools/functions that Gemini can call
Compatible with google-generativeai 0.8.3
"""
from typing import List, Dict

def get_available_tools() -> List[Dict]:
    """
    Returns all available tools for Gemini function calling
    Format for google-generativeai 0.8.3
    """
    
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
            "description": "Generate Google Ads headlines and descriptions using AI",
            "parameters": {
                "type": "object",
                "properties": {
                    "keywords": {
                        "type": "string",
                        "description": "Keywords or topic for the ads"
                    },
                    "website_url": {
                        "type": "string",
                        "description": "Website URL (optional)"
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
