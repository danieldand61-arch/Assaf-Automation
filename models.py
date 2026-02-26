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
    platform: str = ""
    variant_type: str = ""  # "storyteller" or "closer"


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
    url: str = ""
    keywords: str = ""
    platforms: List[str] = ["facebook", "instagram"]
    image_size: str = "1080x1080"
    style: str = "professional"
    target_audience: str = "b2c"
    language: str = "en"
    include_emojis: bool = True
    include_logo: bool = False
    account_id: Optional[str] = None
    skip_image_generation: bool = False
    user_media_url: Optional[str] = None
    use_custom_url: bool = False
    include_people: bool = False
