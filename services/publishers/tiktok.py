"""
TikTok publisher - publishes video content directly to TikTok
Uses Direct Post API (requires video.publish scope)
Falls back to Inbox API if direct post is not approved
"""
import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


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
