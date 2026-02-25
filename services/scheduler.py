"""
Background scheduler for publishing scheduled posts
Uses APScheduler to check and publish posts at scheduled times
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timezone
import logging
import asyncio

from database.supabase_client import get_supabase

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler | None = None

async def check_and_publish_posts():
    """
    Check for posts that need to be published and publish them
    Runs every minute
    """
    try:
        logger.info("🔍 Checking for posts to publish...")
        
        supabase = get_supabase()
        
        # Get pending posts that are due
        now = datetime.now(timezone.utc)
        response = supabase.table("scheduled_posts")\
            .select("*")\
            .eq("status", "pending")\
            .lte("scheduled_time", now.isoformat())\
            .execute()
        
        posts_to_publish = response.data
        
        if not posts_to_publish:
            logger.info("✅ No posts to publish")
            return
        
        logger.info(f"📤 Found {len(posts_to_publish)} posts to publish")
        
        # Publish each post
        for post in posts_to_publish:
            await publish_post(post)
        
    except Exception as e:
        logger.error(f"❌ Error in check_and_publish_posts: {str(e)}")
        logger.exception("Full traceback:")

async def publish_post(post: dict):
    """
    Publish a single post to its platforms
    """
    try:
        post_id = post["id"]
        platforms = post["platforms"]
        
        # Build content from post data
        text = post.get("text", "")
        hashtags = post.get("hashtags", [])
        cta = post.get("call_to_action", "")
        
        # Format content with hashtags
        hashtag_text = " ".join([f"#{tag}" for tag in hashtags])
        content = f"{text}\n\n{hashtag_text}"
        if cta:
            content += f"\n\n{cta}"
        
        image_url = post.get("image_url")
        
        # If image_url is base64, upload to Supabase Storage first
        if image_url and image_url.startswith("data:"):
            try:
                import base64, uuid
                header, b64data = image_url.split(",", 1)
                image_bytes = base64.b64decode(b64data)
                supabase_tmp = get_supabase()
                filename = f"scheduled/{uuid.uuid4().hex}.jpg"
                bucket = "posts"
                try:
                    supabase_tmp.storage.from_(bucket).upload(
                        path=filename, file=image_bytes,
                        file_options={"content-type": "image/jpeg", "upsert": "true"}
                    )
                except Exception:
                    bucket = "products"
                    supabase_tmp.storage.from_(bucket).upload(
                        path=filename, file=image_bytes,
                        file_options={"content-type": "image/jpeg", "upsert": "true"}
                    )
                image_url = supabase_tmp.storage.from_(bucket).get_public_url(filename)
                logger.info(f"   Uploaded base64 image to {image_url[:80]}...")
            except Exception as upload_err:
                logger.warning(f"⚠️ Failed to upload base64 image: {upload_err}")
                image_url = None
        
        logger.info(f"📤 Publishing post {post_id} to {platforms}")
        
        supabase = get_supabase()
        
        # Update status to 'publishing'
        supabase.table("scheduled_posts")\
            .update({"status": "publishing"})\
            .eq("id", post_id)\
            .execute()
        
        # Get social connections for this account
        connections_response = supabase.table("account_connections")\
            .select("*")\
            .eq("account_id", post["account_id"])\
            .in_("platform", platforms)\
            .eq("is_connected", True)\
            .execute()
        
        connections = connections_response.data
        
        if not connections:
            logger.warning(f"⚠️ No active social connections found for post {post_id}")
            supabase.table("scheduled_posts")\
                .update({
                    "status": "failed",
                    "error_message": "No active social connections"
                })\
                .eq("id", post_id)\
                .execute()
            return
        
        # Publish to each platform
        published_count = 0
        errors = []
        successful_platforms = []  # Track which platforms succeeded
        
        for connection in connections:
            try:
                platform = connection["platform"]
                logger.info(f"  📱 Publishing to {platform}...")
                
                # Import platform-specific publisher
                if platform == "facebook":
                    from services.publishers.facebook import publish_to_facebook
                    result = await publish_to_facebook(connection, content, image_url)
                elif platform == "instagram":
                    from services.publishers.instagram import publish_to_instagram
                    result = await publish_to_instagram(connection, content, image_url)
                elif platform == "linkedin":
                    from services.publishers.linkedin import publish_to_linkedin
                    result = await publish_to_linkedin(connection, content, image_url)
                elif platform == "twitter":
                    from services.publishers.twitter import publish_to_twitter
                    result = await publish_to_twitter(connection, content, image_url)
                elif platform == "tiktok":
                    from services.publishers.tiktok import publish_to_tiktok
                    result = await publish_to_tiktok(connection, content, image_url)
                else:
                    logger.warning(f"⚠️ Unsupported platform: {platform}")
                    continue
                
                # Record successful publish
                published_count += 1
                successful_platforms.append(platform)
                logger.info(f"  ✅ Published to {platform}")
                
            except Exception as e:
                error_msg = f"{platform}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"  ❌ Failed to publish to {platform}: {str(e)}")
        
        # Update post status
        if published_count == len(connections):
            # All platforms succeeded
            supabase.table("scheduled_posts")\
                .update({
                    "status": "published",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "platforms": successful_platforms  # Update to show only successful platforms
                })\
                .eq("id", post_id)\
                .execute()
            logger.info(f"✅ Post {post_id} published successfully to all platforms")
        elif published_count > 0:
            # Some platforms succeeded
            supabase.table("scheduled_posts")\
                .update({
                    "status": "published",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "platforms": successful_platforms,  # Update to show only successful platforms
                    "error_message": f"Partial success. Failed: {'; '.join(errors)}"
                })\
                .eq("id", post_id)\
                .execute()
            logger.warning(f"⚠️ Post {post_id} partially published with errors")
        else:
            # All platforms failed
            supabase.table("scheduled_posts")\
                .update({
                    "status": "failed",
                    "error_message": "; ".join(errors)
                })\
                .eq("id", post_id)\
                .execute()
            logger.error(f"❌ Post {post_id} failed to publish to all platforms")
        
        # Handle recurring posts
        if post.get("is_recurring") and post.get("recurring_pattern"):
            await schedule_next_recurrence(post)
        
    except Exception as e:
        logger.error(f"❌ Error publishing post {post.get('id')}: {str(e)}")
        logger.exception("Full traceback:")
        
        # Mark as failed
        try:
            supabase = get_supabase()
            supabase.table("scheduled_posts")\
                .update({
                    "status": "failed",
                    "error_message": str(e)
                })\
                .eq("id", post["id"])\
                .execute()
        except:
            pass

async def schedule_next_recurrence(post: dict):
    """
    Create next scheduled post for recurring posts
    """
    try:
        from datetime import timedelta
        
        pattern = post["recurring_pattern"]
        current_time = datetime.fromisoformat(post["scheduled_at"])
        
        # Calculate next time based on pattern
        if pattern == "weekly":
            next_time = current_time + timedelta(weeks=1)
        elif pattern == "monthly":
            next_time = current_time + timedelta(days=30)
        else:
            logger.warning(f"⚠️ Unknown recurring pattern: {pattern}")
            return
        
        # Create new scheduled post
        supabase = get_supabase()
        supabase.table("scheduled_posts").insert({
            "account_id": post["account_id"],
            "user_id": post["user_id"],
            "platforms": post["platforms"],
            "text": post["text"],
            "hashtags": post.get("hashtags", []),
            "call_to_action": post.get("call_to_action", ""),
            "image_url": post.get("image_url"),
            "scheduled_time": next_time.isoformat(),
            "timezone": post.get("timezone", "UTC"),
            "status": "pending"
        }).execute()
        
        logger.info(f"✅ Next recurring post scheduled for {next_time}")
        
    except Exception as e:
        logger.error(f"❌ Error scheduling next recurrence: {str(e)}")

def start_scheduler():
    """
    Start the background scheduler
    """
    global scheduler
    
    if scheduler is not None:
        logger.warning("⚠️ Scheduler already running")
        return
    
    logger.info("🚀 Starting background scheduler...")
    
    scheduler = AsyncIOScheduler()
    
    # Check for posts to publish every minute
    scheduler.add_job(
        check_and_publish_posts,
        trigger=IntervalTrigger(minutes=1),
        id="check_posts",
        name="Check and publish scheduled posts",
        replace_existing=True
    )

    # Daily ad analytics sync (every 6 hours)
    scheduler.add_job(
        _daily_ad_sync,
        trigger=IntervalTrigger(hours=6),
        id="ad_sync",
        name="Sync ad analytics data",
        replace_existing=True
    )

    scheduler.start()
    logger.info("✅ Scheduler started successfully")


async def _daily_ad_sync():
    """Sync ad analytics for all active accounts."""
    try:
        from services.ad_sync import sync_google_ads, sync_meta_ads
        from datetime import timedelta

        sb = get_supabase()
        rows = sb.table("user_settings").select("user_id,active_account_id").execute()
        if not rows.data:
            return

        today = datetime.now(timezone.utc).date()
        date_from = today - timedelta(days=90)

        for row in rows.data:
            uid = row.get("user_id")
            aid = row.get("active_account_id")
            if not uid or not aid:
                continue
            try:
                await sync_google_ads(aid, uid, date_from, today)
                await sync_meta_ads(aid, uid, date_from, today)
            except Exception as e:
                logger.error(f"❌ Scheduled ad sync error for {aid}: {e}")
        logger.info(f"✅ Scheduled ad sync complete for {len(rows.data)} accounts")
    except Exception as e:
        logger.error(f"❌ Daily ad sync job error: {e}")

def stop_scheduler():
    """
    Stop the background scheduler
    """
    global scheduler
    
    if scheduler is None:
        return
    
    logger.info("🛑 Stopping scheduler...")
    scheduler.shutdown()
    scheduler = None
    logger.info("✅ Scheduler stopped")
