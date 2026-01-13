from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
import google.generativeai as genai
import os
import logging
from dotenv import load_dotenv

# Import routers
from routers import auth, accounts, content, scheduling, products, persons, designs, image_editor, team
from middleware.auth import get_optional_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI(
    title="Social Media Automation API",
    version="2.0",
    description="AI-powered social media content generation with multi-account support"
)

# CORS must be FIRST!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for now (we'll restrict later)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(content.router)
app.include_router(scheduling.router)
app.include_router(products.router)
app.include_router(persons.router)
app.include_router(designs.router)
app.include_router(image_editor.router)
app.include_router(team.router)

# Log all requests middleware (after CORS)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"📥 Incoming request: {request.method} {request.url.path}")
    logger.info(f"   Origin: {request.headers.get('origin', 'No origin')}")
    try:
        response = await call_next(request)
        logger.info(f"📤 Response status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"❌ Middleware error: {str(e)}")
        logger.exception("Full traceback:")
        raise

# Configure Google AI
api_key = os.getenv("GOOGLE_AI_API_KEY")
logger.info(f"🔍 DEBUG: Checking API key...")
logger.info(f"🔍 DEBUG: API key exists: {api_key is not None}")
if api_key:
    logger.info(f"🔍 DEBUG: API key length: {len(api_key)}")
    logger.info(f"🔍 DEBUG: API key starts with: {api_key[:10]}...")
    logger.info(f"🔍 DEBUG: API key ends with: ...{api_key[-5:]}")
    try:
        genai.configure(api_key=api_key)
        logger.info("✅ Google AI configured successfully")
    except Exception as e:
        logger.error(f"❌ Failed to configure Google AI: {str(e)}")
        logger.exception("Full traceback:")
else:
    logger.error("❌ GOOGLE_AI_API_KEY not found in environment variables!")
    logger.info("🔍 DEBUG: Available env vars: " + ", ".join([k for k in os.environ.keys() if 'KEY' in k or 'API' in k]))


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
    logger.info("✅ Root endpoint called")
    return {
        "status": "Social Media Automation API Running",
        "version": "1.0",
        "endpoints": {
            "generate": "/api/generate",
            "health": "/health"
        }
    }

@app.get("/health")
def health_check():
    api_key_set = bool(os.getenv("GOOGLE_AI_API_KEY"))
    return {
        "status": "healthy",
        "api_key_configured": api_key_set
    }


@app.post("/api/generate", response_model=GeneratedContent)
async def generate_content(
    request: GenerateRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Main endpoint for content generation (works both authenticated and anonymous)"""
    logger.info(f"🚀 Starting content generation for URL: {request.url}")
    logger.info(f"   Keywords: {request.keywords}")
    logger.info(f"   Platforms: {request.platforms}")
    logger.info(f"   Language: {request.language}")
    logger.info(f"   User: {current_user['email'] if current_user else 'Anonymous'}")
    
    try:
        # 1. Scrape website
        logger.info("📄 Step 1: Scraping website...")
        from services.scraper import scrape_website
        website_data = await scrape_website(str(request.url))
        logger.info(f"✅ Website scraped: {website_data.get('title', 'No title')}")
        
        # 2. Generate post texts
        logger.info("✍️  Step 2: Generating post texts...")
        from services.content_generator import generate_posts
        variations = await generate_posts(
            website_data=website_data,
            keywords=request.keywords,
            platforms=request.platforms,
            style=request.style,
            target_audience=request.target_audience,
            language=request.language,  # Pass language
            include_emojis=request.include_emojis
        )
        logger.info(f"✅ Generated {len(variations)} post variations")
        
        # 3. Generate images
        logger.info("🖼️  Step 3: Generating images...")
        from services.image_generator import generate_images
        images = await generate_images(
            website_data=website_data,
            variations=variations,
            platforms=request.platforms,
            image_size=request.image_size,
            include_logo=request.include_logo
        )
        logger.info(f"✅ Generated {len(images)} images")
        
        logger.info("🎉 Content generation completed successfully!")
        
        return GeneratedContent(
            variations=variations,
            images=images,
            brand_colors=website_data.get("colors", []),
            brand_voice=website_data.get("brand_voice", "professional")
        )
        
    except Exception as e:
        logger.error(f"❌ Error during content generation: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup"""
    logger.info("🚀 Application starting up...")
    try:
        from services.scheduler import start_scheduler
        start_scheduler()
        logger.info("✅ Background scheduler started")
    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {str(e)}")

@app.on_event("shutdown")
async def shutdown_event():
    """Stop background scheduler on app shutdown"""
    logger.info("🛑 Application shutting down...")
    try:
        from services.scheduler import stop_scheduler
        stop_scheduler()
        logger.info("✅ Background scheduler stopped")
    except Exception as e:
        logger.error(f"❌ Error stopping scheduler: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

