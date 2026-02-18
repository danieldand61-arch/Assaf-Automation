"""
TikTok publisher - publishes video content directly to TikTok
Uses Direct Post API (requires video.publish scope)
Falls back to Inbox API if direct post is not approved
Auto-refreshes expired OAuth tokens
"""
import httpx
import logging
import os
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

TIKTOK_CLIENT_KEY = os.getenv("TIKTOK_CLIENT_KEY")
TIKTOK_CLIENT_SECRET = os.getenv("TIKTOK_CLIENT_SECRET")


async def _refresh_tiktok_token(refresh_token: str) -> Optional[Dict[str, str]]:
    if not TIKTOK_CLIENT_KEY or not TIKTOK_CLIENT_SECRET or not refresh_token:
        return None
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            resp = await c.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": TIKTOK_CLIENT_KEY,
                    "client_secret": TIKTOK_CLIENT_SECRET,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
            )
        if resp.status_code == 200:
            data = resp.json()
            logger.info("✅ TikTok token refreshed")
            return {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token", refresh_token),
                "expires_in": data.get("expires_in", 86400),
            }
        logger.error(f"❌ TikTok token refresh failed: {resp.status_code} - {resp.text[:200]}")
    except Exception as e:
        logger.error(f"❌ TikTok token refresh error: {e}")
    return None


async def _update_token_in_db(connection_id: str, new_tokens: Dict[str, str]):
    try:
        from database.supabase_client import get_supabase
        supabase = get_supabase()
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(new_tokens.get("expires_in", 86400)))
        supabase.table("account_connections").update({
            "access_token": new_tokens["access_token"],
            "refresh_token": new_tokens["refresh_token"],
            "token_expires_at": expires_at.isoformat(),
        }).eq("id", connection_id).execute()
    except Exception as e:
        logger.error(f"❌ Failed to save refreshed TikTok token: {e}")


def _token_expired(connection: Dict[str, Any]) -> bool:
    expires_at = connection.get("token_expires_at")
    if not expires_at:
        return True
    try:
        exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= exp - timedelta(minutes=5)
    except Exception:
        return True


async def publish_to_tiktok(connection: Dict[str, Any], content: str, image_url: str) -> Dict[str, Any]:
    """
    Publish video to TikTok using Direct Post API.
    If direct post fails (scope not approved), falls back to Inbox API.
    """
    try:
        access_token = connection.get("access_token")
        open_id = connection.get("platform_user_id")
        platform_username = connection.get("platform_username", open_id)

        if not access_token or not open_id:
            raise Exception("Missing access token or user ID")

        # Auto-refresh if expired
        if _token_expired(connection):
            logger.info("🔄 TikTok token expired, refreshing...")
            new_tokens = await _refresh_tiktok_token(connection.get("refresh_token", ""))
            if new_tokens:
                access_token = new_tokens["access_token"]
                conn_id = connection.get("id")
                if conn_id:
                    await _update_token_in_db(conn_id, new_tokens)
            else:
                logger.warning("⚠️ TikTok token refresh failed, trying with existing token")

        logger.info(f"🎵 Publishing to TikTok: {open_id}")

        if not image_url:
            raise Exception("TikTok requires a video URL to publish")

        is_video = any([
            'video' in image_url.lower(),
            '.mp4' in image_url.lower(),
            '/video/' in image_url.lower(),
            '/download/' in image_url.lower(),
            '/api/video/' in image_url.lower(),
        ])

        if not is_video:
            raise Exception("TikTok requires video content. Use Video Dubbing to create TikTok videos.")

        async with httpx.AsyncClient(timeout=120.0) as client:
            # Download video
            video_response = await client.get(image_url)
            if video_response.status_code != 200:
                raise Exception(f"Failed to download video: HTTP {video_response.status_code}")
            video_data = video_response.content
            video_size = len(video_data)
            logger.info(f"📥 Downloaded video: {video_size} bytes")

            auth_headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }

            # Try Direct Post API first (auto-publishes)
            publish_id, upload_url = await _init_direct_post(client, auth_headers, video_size, content)

            if not publish_id:
                # Fallback to Inbox API
                logger.info("⚠️ Direct Post not available, falling back to Inbox API")
                publish_id, upload_url = await _init_inbox_post(client, auth_headers, video_size)

            # Upload video
            logger.info(f"⬆️ Uploading video ({video_size} bytes)...")
            upload_headers = {
                "Content-Type": "video/mp4",
                "Content-Range": f"bytes 0-{video_size - 1}/{video_size}"
            }
            upload_resp = await client.put(upload_url, headers=upload_headers, content=video_data, timeout=120.0)

            if upload_resp.status_code not in [200, 201, 204]:
                logger.error(f"❌ TikTok upload failed: {upload_resp.status_code} - {upload_resp.text[:300]}")
                raise Exception(f"TikTok upload failed: {upload_resp.status_code}")

            logger.info(f"✅ Video uploaded to TikTok: {publish_id}")

            return {
                "success": True,
                "post_id": publish_id,
                "post_url": f"https://www.tiktok.com/@{platform_username}"
            }

    except Exception as e:
        logger.error(f"❌ TikTok publishing error: {str(e)}")
        raise


async def _init_direct_post(client, headers, video_size: int, caption: str):
    """Try Direct Post API — publishes immediately without user action."""
    try:
        resp = await client.post(
            "https://open.tiktokapis.com/v2/post/publish/video/init/",
            headers=headers,
            json={
                "post_info": {
                    "title": caption[:150] if caption else "",
                    "privacy_level": "SELF_ONLY",
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": video_size,
                    "chunk_size": video_size,
                    "total_chunk_count": 1
                }
            }
        )
        if resp.status_code == 200:
            data = resp.json()
            if data.get("error", {}).get("code") == "ok" or "data" in data:
                d = data["data"]
                logger.info(f"✅ Direct Post init OK: publish_id={d['publish_id']}")
                return d["publish_id"], d["upload_url"]
        logger.warning(f"⚠️ Direct Post init: {resp.status_code} - {resp.text[:200]}")
        return None, None
    except Exception as e:
        logger.warning(f"⚠️ Direct Post init failed: {e}")
        return None, None


async def _init_inbox_post(client, headers, video_size: int):
    """Fallback: Inbox API — uploads to drafts, user publishes manually."""
    resp = await client.post(
        "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",
        headers=headers,
        json={
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": video_size,
                "chunk_size": video_size,
                "total_chunk_count": 1
            }
        }
    )
    if resp.status_code != 200:
        raise Exception(f"TikTok inbox init failed: {resp.status_code} - {resp.text[:200]}")
    data = resp.json()["data"]
    logger.info(f"📥 Inbox init OK: publish_id={data['publish_id']}")
    return data["publish_id"], data["upload_url"]
