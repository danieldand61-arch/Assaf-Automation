from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Social Media Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://*.vercel.app",  # Vercel preview deployments
        os.getenv("FRONTEND_URL", "*")  # Production frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Google AI
genai.configure(api_key=os.getenv("GOOGLE_AI_API_KEY"))


class GenerateRequest(BaseModel):
    url: HttpUrl
    keywords: str
    platforms: List[str]  # ["facebook", "instagram"]
    style: str
    target_audience: str
    industry: str
    include_emojis: bool = True
    include_logo: bool = False


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


@app.get("/")
def read_root():
    return {"status": "Social Media Automation API Running"}


@app.post("/api/generate", response_model=GeneratedContent)
async def generate_content(request: GenerateRequest):
    """Main endpoint for content generation"""
    try:
        # 1. Scrape website
        from services.scraper import scrape_website
        website_data = await scrape_website(str(request.url))
        
        # 2. Generate post texts
        from services.content_generator import generate_posts
        variations = await generate_posts(
            website_data=website_data,
            keywords=request.keywords,
            platforms=request.platforms,
            style=request.style,
            target_audience=request.target_audience,
            industry=request.industry,
            include_emojis=request.include_emojis
        )
        
        # 3. Generate images
        from services.image_generator import generate_images
        images = await generate_images(
            website_data=website_data,
            variations=variations,
            platforms=request.platforms,
            include_logo=request.include_logo
        )
        
        return GeneratedContent(
            variations=variations,
            images=images,
            brand_colors=website_data.get("colors", []),
            brand_voice=website_data.get("brand_voice", "professional")
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

