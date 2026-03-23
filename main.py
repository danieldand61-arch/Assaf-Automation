from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import google.generativeai as genai
import os
import logging
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import models from separate file (avoid circular imports)
from models import GenerateRequest, GeneratedContent, PostVariation, ImageVariation
from middleware.auth import get_current_user

# Configure logging FIRST
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Social Media Automation API",
    version="2.0",
    description="AI-powered social media content generation with multi-account support"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS must be FIRST!
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include content router AFTER app creation
logger.info("🔄 Attempting to import content router...")
try:
    from routers import content
    logger.info("✅ Content router imported successfully")
    
    logger.info("🔄 Registering content router endpoints...")
    app.include_router(content.router)
    logger.info("✅ Content router registered:")
    logger.info("   📝 POST /api/content/edit-text")
    logger.info("   📝 POST /api/content/regenerate-text")
    logger.info("   🖼️  POST /api/content/regenerate-image")
    logger.info("   🎯 POST /api/content/generate-google-ads")
except Exception as e:
    logger.error(f"❌ Content router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Editing features will NOT be available!")

# Try to load scheduling router
logger.info("🔄 Attempting to import scheduling router...")
try:
    from routers import scheduling
    logger.info("✅ Scheduling router imported successfully")
    
    logger.info("🔄 Registering scheduling router endpoints...")
    app.include_router(scheduling.router)
    logger.info("✅ Scheduling router registered")
except Exception as e:
    logger.error(f"❌ Scheduling router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Scheduling features will NOT be available!")

# Try to load auth router
logger.info("🔄 Attempting to import auth router...")
try:
    from routers import auth
    logger.info("✅ Auth router imported successfully")
    
    logger.info("🔄 Registering auth router endpoints...")
    app.include_router(auth.router)
    logger.info("✅ Auth router registered")
except Exception as e:
    logger.error(f"❌ Auth router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Auth features will NOT be available!")

# Try to load accounts router
logger.info("🔄 Attempting to import accounts router...")
try:
    from routers import accounts
    logger.info("✅ Accounts router imported successfully")
    
    logger.info("🔄 Registering accounts router endpoints...")
    app.include_router(accounts.router)
    logger.info("✅ Accounts router registered")
except Exception as e:
    logger.error(f"❌ Accounts router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Accounts features will NOT be available!")

# Try to load credits router
logger.info("🔄 Attempting to import credits router...")
try:
    from routers import credits
    logger.info("✅ Credits router imported successfully")
    
    logger.info("🔄 Registering credits router endpoints...")
    app.include_router(credits.router)
    logger.info("✅ Credits router registered")
except Exception as e:
    logger.error(f"❌ Credits router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Credits tracking will NOT be available!")

# Try to load admin router
logger.info("🔄 Attempting to import admin router...")
try:
    from routers import admin
    logger.info("✅ Admin router imported successfully")
    
    logger.info("🔄 Registering admin router endpoints...")
    app.include_router(admin.router)
    logger.info("✅ Admin router registered")
except Exception as e:
    logger.error(f"❌ Admin router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Admin features will NOT be available!")

# Try to load video translation router
logger.info("🔄 Attempting to import video translation router...")
try:
    from routers import video_translation
    logger.info("✅ Video translation router imported successfully")
    
    logger.info("🔄 Registering video translation router endpoints...")
    app.include_router(video_translation.router)
    logger.info("✅ Video translation router registered")
except Exception as e:
    logger.error(f"❌ Video translation router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Video translation features will NOT be available!")

# Try to load video generation router (Kling AI)
logger.info("🔄 Attempting to import video generation router...")
try:
    from routers import video_generation
    logger.info("✅ Video generation router imported successfully")
    
    logger.info("🔄 Registering video generation router endpoints...")
    app.include_router(video_generation.router)
    logger.info("✅ Video generation router registered")
    logger.info("   🎬 POST /api/video-gen/text-to-video")
    logger.info("   🎬 POST /api/video-gen/image-to-video")
    logger.info("   📊 GET /api/video-gen/status/{task_id}")
except Exception as e:
    logger.error(f"❌ Video generation router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Video generation features will NOT be available!")

# Try to load billing router (Stripe)
logger.info("🔄 Attempting to import billing router...")
try:
    from routers import billing
    logger.info("✅ Billing router imported successfully")
    app.include_router(billing.router)
    logger.info("✅ Billing router registered")
except Exception as e:
    logger.error(f"❌ Billing router failed to load: {str(e)}")
    logger.warning("⚠️ Billing features will NOT be available!")

# Try to load social connections router
logger.info("🔄 Attempting to import social connections router...")
try:
    from routers import social
    logger.info("✅ Social connections router imported successfully")
    
    logger.info("🔄 Registering social connections router endpoints...")
    app.include_router(social.router)
    logger.info("✅ Social connections router registered")
except Exception as e:
    logger.error(f"❌ Social connections router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Social connections features will NOT be available!")

# Try to load TikTok upload router
logger.info("🔄 Attempting to import TikTok upload router...")
try:
    from routers import tiktok_upload
    logger.info("✅ TikTok upload router imported successfully")
    
    logger.info("🔄 Registering TikTok upload router endpoints...")
    app.include_router(tiktok_upload.router)
    logger.info("✅ TikTok upload router registered")
except Exception as e:
    logger.error(f"❌ TikTok upload router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ TikTok upload features will NOT be available!")

# Try to load social post router
logger.info("🔄 Attempting to import social post router...")
try:
    from routers import social_post
    logger.info("✅ Social post router imported successfully")
    
    logger.info("🔄 Registering social post router endpoints...")
    app.include_router(social_post.router)
    logger.info("✅ Social post router registered")
except Exception as e:
    logger.error(f"❌ Social post router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Social posting features will NOT be available!")

# Try to load Google Ads router
logger.info("🔄 Attempting to import Google Ads router...")
try:
    from routers import google_ads
    logger.info("✅ Google Ads router imported successfully")
    
    logger.info("🔄 Registering Google Ads router endpoints...")
    app.include_router(google_ads.router)
    logger.info("✅ Google Ads router registered")
    logger.info("   🔗 POST /api/google-ads/connect")
    logger.info("   📊 GET /api/google-ads/campaigns")
    logger.info("   📝 POST /api/google-ads/create-rsa")
except Exception as e:
    logger.error(f"❌ Google Ads router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Google Ads features will NOT be available!")

# Try to load saved posts router
logger.info("🔄 Attempting to import saved posts router...")
try:
    from routers import saved_posts
    logger.info("✅ Saved posts router imported successfully")
    
    logger.info("🔄 Registering saved posts router endpoints...")
    app.include_router(saved_posts.router)
    logger.info("✅ Saved posts router registered")
except Exception as e:
    logger.error(f"❌ Saved posts router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Saved posts features will NOT be available!")

# Try to load chats router
logger.info("🔄 Attempting to import chats router...")
try:
    from routers import chats
    logger.info("✅ Chats router imported successfully")
    
    logger.info("🔄 Registering chats router endpoints...")
    app.include_router(chats.router)
    logger.info("✅ Chats router registered")
except Exception as e:
    logger.error(f"❌ Chats router failed to load: {str(e)}")
    logger.exception("Full import/registration traceback:")
    logger.warning("⚠️ Chat features will NOT be available!")

try:
    from routers import analytics
    app.include_router(analytics.router)
    logger.info("✅ Analytics router registered")
except Exception as e:
    logger.error(f"❌ Analytics router failed to load: {str(e)}")
    logger.warning("⚠️ Ad analytics features will NOT be available!")

try:
    from routers import graphic_gen
    app.include_router(graphic_gen.router)
    logger.info("✅ Graphic gen router registered")
except Exception as e:
    logger.error(f"❌ Graphic gen router failed to load: {str(e)}")
    logger.warning("⚠️ Graphic text generation will NOT be available!")

try:
    from routers import creative_gen
    app.include_router(creative_gen.router)
    logger.info("✅ Creative gen router registered")
except Exception as e:
    logger.error(f"❌ Creative gen router failed to load: {str(e)}")
    logger.warning("⚠️ Creative generation will NOT be available!")

try:
    from routers import subtitles
    app.include_router(subtitles.router)
    logger.info("✅ Subtitles router registered")
except Exception as e:
    logger.error(f"❌ Subtitles router failed to load: {str(e)}")
    logger.warning("⚠️ Subtitle generation will NOT be available!")

logger.info("ℹ️ All routers loaded successfully!")

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
if api_key:
    try:
        genai.configure(api_key=api_key)
        logger.info("✅ Google AI configured successfully")
    except Exception as e:
        logger.error(f"❌ Failed to configure Google AI: {e}")
else:
    logger.error("❌ GOOGLE_AI_API_KEY not found in environment variables!")


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


@app.post("/api/generate")
async def generate_content(request: GenerateRequest, current_user: dict = Depends(get_current_user)):
    """Main endpoint for content generation"""
    logger.info(f"🚀 Starting content generation for URL: {request.url}")
    logger.info(f"   User: {current_user.get('user_id', 'unknown')}")
    
    # Credit balance check
    from services.credits_service import check_balance
    balance = await check_balance(current_user["user_id"], min_credits=25.0)
    if not balance["ok"]:
        raise HTTPException(status_code=402, detail=f"Not enough credits. You have {balance['remaining']:.0f}, need at least {balance['needed']:.0f}. Please top up your balance.")
    
    try:
        # 1. Get website data: Brand Kit first for default URL, scrape for custom URL
        logger.info("📄 Step 1: Getting website data...")
        url_str = str(request.url).strip()
        website_data = None

        if not request.use_custom_url:
            # Default mode: load Brand Kit from DB, fall back to scraping
            try:
                from database.supabase_client import get_supabase
                supabase = get_supabase()
                uid = current_user.get("user_id")
                acct = supabase.table("accounts").select("brand_voice, logo_url, brand_colors, metadata, industry, description, name").eq("user_id", uid).eq("is_active", True).limit(1).execute()
                if acct.data:
                    a = acct.data[0]
                    bk = (a.get("metadata") or {}).get("brand_kit") or {}
                    bk_name = bk.get("business_name") or a.get("name") or ""
                    bk_desc = bk.get("description") or a.get("description") or ""
                    bk_products = bk.get("products") or []
                    if bk_name and (bk_desc or bk_products):
                        website_data = {
                            "url": bk.get("website_url") or (a.get("metadata") or {}).get("website_url") or url_str or "",
                            "title": bk_name,
                            "description": bk_desc,
                            "content": bk.get("content_preview") or bk_desc,
                            "colors": bk.get("brand_colors") or a.get("brand_colors") or [],
                            "logo_url": bk.get("logo_url") or a.get("logo_url") or "",
                            "brand_voice": bk.get("brand_voice") or a.get("brand_voice") or "professional",
                            "products": bk_products,
                            "key_features": bk.get("key_features") or [],
                            "industry": bk.get("industry") or a.get("industry") or "",
                        }
                        logger.info(f"✅ Using Brand Kit: {bk_name}")
            except Exception as bk_err:
                logger.warning(f"⚠️ Could not load Brand Kit: {bk_err}")

        if website_data is None:
            # Custom URL mode or Brand Kit empty: scrape
            if url_str and url_str != 'None':
                from services.scraper import scrape_website
                try:
                    website_data = await scrape_website(url_str)
                    logger.info(f"✅ Website scraped: {website_data.get('title', 'No title')}")
                except Exception as scrape_err:
                    logger.warning(f"⚠️ Scrape failed ({scrape_err}), using keywords")
                    website_data = {
                        "url": url_str, "title": "Brand", "description": request.keywords,
                        "content": request.keywords, "colors": [], "logo_url": "",
                        "brand_voice": "professional", "products": [], "key_features": [],
                    }
            else:
                website_data = {
                    "url": "", "title": "Brand", "description": request.keywords,
                    "content": request.keywords, "colors": [], "logo_url": "",
                    "brand_voice": "professional", "products": [], "key_features": [],
                }
                logger.info("ℹ️ No URL provided, using keywords as context")

        # 2. Generate post texts (with tracking)
        logger.info("✍️  Step 2: Generating post texts...")
        from services.content_generator import generate_posts
        variations = await generate_posts(
            website_data=website_data,
            keywords=request.keywords,
            platforms=request.platforms,
            style=request.style,
            target_audience=request.target_audience,
            language=request.language,
            include_emojis=request.include_emojis,
            user_id=current_user.get("user_id"),
            user_media_url=request.user_media_url
        )
        logger.info(f"✅ Generated {len(variations)} post variations")
        
        # 3. Generate images (skip when user provided their own media)
        if request.skip_image_generation:
            logger.info("🖼️  Step 3: Skipped — user provided their own media")
            images = []
        elif request.graphic_mode:
            logger.info("🎨 Step 3: Generating GRAPHIC DESIGNS...")
            from services.graphic_designer import generate_graphic_designs
            images = await generate_graphic_designs(
                website_data={**website_data, "language": request.language},
                variations=variations,
                platforms=request.platforms,
                image_size=request.image_size,
                user_id=current_user.get("user_id"),
            )
            logger.info(f"✅ Generated {len(images)} graphic designs")
        else:
            logger.info("🖼️  Step 3: Generating images...")
            from services.image_generator import generate_images
            images = await generate_images(
                website_data=website_data,
                variations=variations,
                platforms=request.platforms,
                image_size=request.image_size,
                include_logo=request.include_logo,
                user_id=current_user.get("user_id"),
                include_people=request.include_people,
                reference_image=request.reference_image
            )
            logger.info(f"✅ Generated {len(images)} images")
        
        logger.info("🎉 Content generation completed successfully!")
        
        result = {
            "variations": [v.dict() for v in variations],
            "images": [i.dict() for i in images],
            "brand_colors": website_data.get("colors", []),
            "brand_voice": website_data.get("brand_voice", "professional"),
            "website_data": website_data,  # Include for editing
            "request_params": {
                "url": str(request.url),
                "keywords": request.keywords,
                "platforms": request.platforms,
                "language": request.language,
                "style": request.style,
                "image_size": request.image_size,
                "include_logo": request.include_logo
            }
        }
        
        logger.info(f"📦 Returning result with {len(variations)} variations and {len(images)} images")
        return result
        
    except Exception as e:
        logger.error(f"❌ Error during content generation: {str(e)}")
        logger.exception("Full traceback:")
        msg = str(e).lower()
        if '429' in str(e) or 'rate limit' in msg or 'resource has been exhausted' in msg:
            raise HTTPException(status_code=429, detail="AI service is temporarily overloaded. Please wait a moment and try again.")
        if 'timeout' in msg or 'timed out' in msg:
            raise HTTPException(status_code=504, detail="Generation took too long. Please try again.")
        if 'quota' in msg or 'billing' in msg:
            raise HTTPException(status_code=402, detail="AI service quota reached. Please contact support.")
        if 'blocked' in msg or 'safety' in msg:
            raise HTTPException(status_code=400, detail="Content was blocked by AI safety filters. Try adjusting your prompt.")
        raise HTTPException(status_code=500, detail="Something went wrong during generation. Please try again.")


@app.on_event("startup")
async def startup_event():
    """Start background scheduler on app startup"""
    logger.info("🚀 Application starting up...")
    
    # Check API key
    api_key = os.getenv("GOOGLE_AI_API_KEY")
    if api_key:
        logger.info("✅ Google AI API key found")
    else:
        logger.warning("⚠️ GOOGLE_AI_API_KEY not set - generation will fail!")
    
    # Start background scheduler for scheduled posts
    try:
        from services.scheduler import start_scheduler
        start_scheduler()
        logger.info("✅ Background scheduler started")
    except Exception as e:
        logger.error(f"❌ Failed to start scheduler: {str(e)}")
        logger.warning("⚠️ Scheduled posts will NOT be published automatically!")
    
    logger.info("✅ Application startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """App shutdown"""
    logger.info("🛑 Application shutting down...")
    
    # Stop scheduler
    try:
        from services.scheduler import stop_scheduler
        stop_scheduler()
        logger.info("✅ Scheduler stopped")
    except:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

