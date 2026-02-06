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
    
    tools = [
        genai.protos.FunctionDeclaration(
            name="get_google_ads_campaigns",
            description="Get list of Google Ads campaigns with performance metrics",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "date_range": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Date range: TODAY, LAST_7_DAYS, LAST_30_DAYS",
                        enum=["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS"]
                    )
                }
            )
        ),
        genai.protos.FunctionDeclaration(
            name="generate_google_ads_content",
            description="Generate Google Ads headlines and descriptions using AI. Use this when user asks to create or generate Google Ads.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "keywords": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Keywords or topic for the ads"
                    ),
                    "website_url": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Website URL (optional)"
                    ),
                    "language": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Language code (en, ru, etc). Default: en"
                    )
                },
                required=["keywords"]
            )
        ),
        genai.protos.FunctionDeclaration(
            name="generate_social_media_posts",
            description="Generate social media posts for multiple platforms",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "topic": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Topic or keywords for posts"
                    ),
                    "platforms": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        description="Target platforms",
                        items=genai.protos.Schema(
                            type=genai.protos.Type.STRING,
                            enum=["instagram", "facebook", "linkedin", "twitter", "tiktok"]
                        )
                    )
                },
                required=["topic"]
            )
        )
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
