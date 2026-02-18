"""
Twitter/X publisher - publishes content to Twitter
Auto-refreshes expired OAuth 2.0 tokens
"""
import httpx
import logging
import os
import base64
from typing import Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

TWITTER_CLIENT_ID = os.getenv("TWITTER_CLIENT_ID")
TWITTER_CLIENT_SECRET = os.getenv("TWITTER_CLIENT_SECRET")


async def _refresh_access_token(refresh_token: str) -> Optional[Dict[str, str]]:
    """Refresh an expired Twitter OAuth 2.0 token. Returns new tokens or None."""
    if not TWITTER_CLIENT_ID or not TWITTER_CLIENT_SECRET or not refresh_token:
        return None
    try:
        auth_b64 = base64.b64encode(f"{TWITTER_CLIENT_ID}:{TWITTER_CLIENT_SECRET}".encode()).decode()
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(
                "https://api.twitter.com/2/oauth2/token",
                headers={"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {auth_b64}"},
                data={"grant_type": "refresh_token", "refresh_token": refresh_token},
            )
        if resp.status_code == 200:
            data = resp.json()
            logger.info("✅ Twitter token refreshed successfully")
            return {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token", refresh_token),
                "expires_in": data.get("expires_in", 7200),
            }
        logger.error(f"❌ Twitter token refresh failed: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        logger.error(f"❌ Twitter token refresh error: {e}")
    return None


async def _update_token_in_db(connection_id: str, new_tokens: Dict[str, str]):
    """Persist refreshed tokens to account_connections table."""
    try:
        from database.supabase_client import get_supabase
        from datetime import timedelta
        supabase = get_supabase()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(new_tokens.get("expires_in", 7200)))
        supabase.table("account_connections").update({
            "access_token": new_tokens["access_token"],
            "refresh_token": new_tokens["refresh_token"],
            "token_expires_at": expires_at.isoformat(),
        }).eq("id", connection_id).execute()
        logger.info(f"✅ Token saved to DB, expires at {expires_at}")
    except Exception as e:
        logger.error(f"❌ Failed to save refreshed token: {e}")


def _token_expired(connection: Dict[str, Any]) -> bool:
    """Check if access_token is expired or about to expire (5 min buffer)."""
    expires_at = connection.get("token_expires_at")
    if not expires_at:
        return True
    try:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        from datetime import timedelta
        return datetime.now(timezone.utc) >= exp - timedelta(minutes=5)
    except Exception:
        return True


async def publish_to_twitter(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """Publish content to Twitter/X with auto token refresh."""
    try:
        access_token = connection.get("access_token")
        username = connection.get("platform_username", "").replace("@", "")

        if not access_token:
            raise Exception("Missing access token")

        # Auto-refresh if expired
        if _token_expired(connection):
            logger.info("🔄 Twitter token expired, refreshing...")
            new_tokens = await _refresh_access_token(connection.get("refresh_token", ""))
            if new_tokens:
                access_token = new_tokens["access_token"]
                conn_id = connection.get("id")
                if conn_id:
                    await _update_token_in_db(conn_id, new_tokens)
            else:
                logger.warning("⚠️ Token refresh failed, trying with existing token anyway")

        logger.info(f"🐦 Publishing to Twitter: @{username}")

        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            media_id = None

            if image_url:
                image_data = None
                if image_url.startswith("data:"):
                    try:
                        _, b64data = image_url.split(",", 1)
                        image_data = base64.b64decode(b64data)
                        logger.info(f"📷 Decoded base64 image: {len(image_data)} bytes")
                    except Exception as e:
                        logger.error(f"❌ Failed to decode base64 image: {e}")
                elif image_url.startswith("http"):
                    img_response = await client.get(image_url)
                    if img_response.status_code == 200:
                        image_data = img_response.content
                        logger.info(f"📷 Downloaded image: {len(image_data)} bytes")

                if image_data:
                    media_response = await client.post(
                        "https://upload.twitter.com/1.1/media/upload.json",
                        headers={"Authorization": f"Bearer {access_token}"},
                        files={"media": image_data}
                    )
                    if media_response.status_code == 200:
                        media_id = media_response.json().get("media_id_string")
                        logger.info(f"✅ Image uploaded: {media_id}")
                    else:
                        logger.warning(f"⚠️ Image upload failed: {media_response.status_code} - {media_response.text[:200]}")

            if len(content) > 280:
                content = content[:277] + "..."

            tweet_payload: dict = {"text": content}
            if media_id:
                tweet_payload["media"] = {"media_ids": [media_id]}

            response = await client.post(
                "https://api.twitter.com/2/tweets",
                headers=headers,
                json=tweet_payload
            )

            if response.status_code not in [200, 201]:
                error_text = response.text
                logger.error(f"❌ Twitter publish failed: {error_text}")
                raise Exception(f"Twitter publish failed: {error_text}")

            data = response.json()
            tweet_id = data.get("data", {}).get("id")
            logger.info(f"✅ Published to Twitter: {tweet_id}")

            return {
                "success": True,
                "post_id": tweet_id,
                "post_url": f"https://twitter.com/{username}/status/{tweet_id}"
            }

    except Exception as e:
        logger.error(f"❌ Twitter publishing error: {str(e)}")
        raise
