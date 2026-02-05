"""
Chat Tools - Function declarations for Gemini AI
Defines all available tools/functions that Gemini can call
"""
import google.generativeai as genai
from typing import List

def get_available_tools() -> List[genai.Tool]:
    """
    Returns all available tools for Gemini function calling
    """
    
    return [
        genai.Tool(
            function_declarations=[
                # ==========================================
                # GOOGLE ADS TOOLS
                # ==========================================
                
                genai.FunctionDeclaration(
                    name="get_google_ads_campaigns",
                    description="Get list of Google Ads campaigns with performance metrics. Use this when user asks about campaigns, performance, stats, or wants to see their Google Ads data.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "date_range": {
                                "type": "string",
                                "description": "Date range for metrics. Options: TODAY, YESTERDAY, LAST_7_DAYS, LAST_30_DAYS, THIS_MONTH, LAST_MONTH",
                                "enum": ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"]
                            },
                            "status": {
                                "type": "string",
                                "description": "Campaign status filter",
                                "enum": ["ENABLED", "PAUSED", "ALL"],
                                "default": "ALL"
                            }
                        }
                    }
                ),
                
                genai.FunctionDeclaration(
                    name="get_google_ads_connection_status",
                    description="Check if user has connected their Google Ads account. Use this first before attempting any Google Ads operations.",
                    parameters={
                        "type": "object",
                        "properties": {}
                    }
                ),
                
                genai.FunctionDeclaration(
                    name="create_google_ads_rsa",
                    description="Create a Responsive Search Ad (RSA) in Google Ads. Use this when user wants to create a new ad with headlines and descriptions.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "ad_group_id": {
                                "type": "integer",
                                "description": "The ad group ID where the ad will be created"
                            },
                            "headlines": {
                                "type": "array",
                                "description": "List of 3-15 headlines (max 30 characters each)",
                                "items": {"type": "string"},
                                "minItems": 3,
                                "maxItems": 15
                            },
                            "descriptions": {
                                "type": "array",
                                "description": "List of 2-4 descriptions (max 90 characters each)",
                                "items": {"type": "string"},
                                "minItems": 2,
                                "maxItems": 4
                            },
                            "final_url": {
                                "type": "string",
                                "description": "Landing page URL for the ad"
                            }
                        },
                        "required": ["ad_group_id", "headlines", "descriptions", "final_url"]
                    }
                ),
                
                genai.FunctionDeclaration(
                    name="generate_google_ads_content",
                    description="Generate optimized Google Ads RSA copy (headlines + descriptions) using AI. Use this when user wants to create ad content or needs ideas for their ads.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "website_url": {
                                "type": "string",
                                "description": "Website URL to analyze for ad content"
                            },
                            "keywords": {
                                "type": "string",
                                "description": "Target keywords for the ad campaign"
                            },
                            "target_location": {
                                "type": "string",
                                "description": "Target location/region for ads (optional)",
                                "default": ""
                            },
                            "language": {
                                "type": "string",
                                "description": "Language for ad copy (en, ru, he, etc.)",
                                "default": "en"
                            }
                        },
                        "required": ["website_url", "keywords"]
                    }
                ),
                
                # ==========================================
                # CONTENT GENERATION TOOLS
                # ==========================================
                
                genai.FunctionDeclaration(
                    name="generate_social_media_posts",
                    description="Generate social media post variations for multiple platforms (Instagram, Facebook, LinkedIn, Twitter, TikTok). Use this when user wants to create social media content.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "website_url": {
                                "type": "string",
                                "description": "Website URL to analyze for content generation"
                            },
                            "keywords": {
                                "type": "string",
                                "description": "Keywords or topics for the posts"
                            },
                            "platforms": {
                                "type": "array",
                                "description": "Target social media platforms",
                                "items": {
                                    "type": "string",
                                    "enum": ["instagram", "facebook", "linkedin", "twitter", "tiktok"]
                                }
                            },
                            "style": {
                                "type": "string",
                                "description": "Content style",
                                "enum": ["professional", "casual", "creative", "educational", "promotional"],
                                "default": "professional"
                            },
                            "target_audience": {
                                "type": "string",
                                "description": "Target audience description",
                                "default": "general audience"
                            },
                            "language": {
                                "type": "string",
                                "description": "Language for posts (en, ru, he, etc.)",
                                "default": "en"
                            },
                            "include_emojis": {
                                "type": "boolean",
                                "description": "Include emojis in posts",
                                "default": True
                            }
                        },
                        "required": ["website_url", "keywords", "platforms"]
                    }
                ),
                
                # ==========================================
                # SCHEDULING TOOLS
                # ==========================================
                
                genai.FunctionDeclaration(
                    name="get_scheduled_posts",
                    description="Get list of scheduled social media posts. Use this when user asks about their scheduled content or posting calendar.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "status": {
                                "type": "string",
                                "description": "Filter by post status",
                                "enum": ["pending", "published", "failed", "all"],
                                "default": "all"
                            },
                            "platform": {
                                "type": "string",
                                "description": "Filter by platform (optional)",
                                "enum": ["instagram", "facebook", "linkedin", "twitter", "tiktok", "all"],
                                "default": "all"
                            }
                        }
                    }
                ),
                
                # ==========================================
                # SOCIAL CONNECTIONS TOOLS
                # ==========================================
                
                genai.FunctionDeclaration(
                    name="get_social_connections_status",
                    description="Check which social media accounts are connected (Instagram, Facebook, LinkedIn, Twitter, TikTok). Use this when user asks about their connected accounts.",
                    parameters={
                        "type": "object",
                        "properties": {}
                    }
                ),
                
                # ==========================================
                # ANALYSIS TOOLS
                # ==========================================
                
                genai.FunctionDeclaration(
                    name="analyze_campaign_performance",
                    description="Analyze Google Ads campaign performance and provide insights, recommendations. Use this when user wants analysis or optimization suggestions.",
                    parameters={
                        "type": "object",
                        "properties": {
                            "campaign_ids": {
                                "type": "array",
                                "description": "List of campaign IDs to analyze (optional - if not provided, analyzes all)",
                                "items": {"type": "string"}
                            },
                            "date_range": {
                                "type": "string",
                                "description": "Date range for analysis",
                                "enum": ["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"],
                                "default": "LAST_30_DAYS"
                            }
                        }
                    }
                ),
            ]
        )
    ]


# Tool descriptions for system prompt
TOOLS_DESCRIPTION = """
You have access to the following tools:

GOOGLE ADS TOOLS:
- get_google_ads_campaigns: Get campaigns with performance data
- get_google_ads_connection_status: Check if Google Ads is connected
- create_google_ads_rsa: Create Responsive Search Ad
- generate_google_ads_content: Generate AI-powered ad copy

CONTENT GENERATION:
- generate_social_media_posts: Generate posts for Instagram, Facebook, LinkedIn, Twitter, TikTok

SCHEDULING:
- get_scheduled_posts: View scheduled posts calendar

SOCIAL CONNECTIONS:
- get_social_connections_status: Check connected social accounts

ANALYSIS:
- analyze_campaign_performance: Analyze and optimize Google Ads campaigns

IMPORTANT USAGE RULES:
1. Always check connection status BEFORE attempting operations (use get_google_ads_connection_status, get_social_connections_status)
2. If account not connected, guide user to connect in Settings
3. When generating content, ask for website URL and keywords
4. For campaign analysis, pull data first, then provide insights
5. Be proactive - suggest relevant tools based on user's question
"""
