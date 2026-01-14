"""
Pydantic models for API requests and responses
"""
from pydantic import BaseModel, HttpUrl
from typing import List, Optional


class PostVariation(BaseModel):
    text: str
    hashtags: List[str]
    char_count: int
    engagement_score: float
    call_to_action: str


class ImageVariation(BaseModel):
    url: str
    size: str  # "square", "landscape", "story"
    dimensions: str  # "1080x1080"


class GeneratedContent(BaseModel):
    variations: List[PostVariation]
    images: List[ImageVariation]
    brand_colors: List[str]
    brand_voice: str


class GenerateRequest(BaseModel):
    url: HttpUrl
    keywords: str
    platforms: List[str]  # ["facebook", "instagram"]
    image_size: str = "1080x1080"  # Image dimensions
    style: str
    target_audience: str
    language: str = "en"  # Language: "en", "he", "es", "pt"
    include_emojis: bool = True
    include_logo: bool = False
    account_id: Optional[str] = None  # For authenticated users
