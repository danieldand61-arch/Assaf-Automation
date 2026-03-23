import httpx
from bs4 import BeautifulSoup
from typing import Dict, List, Optional
import re
import json
from urllib.parse import urljoin, urlparse
import colorthief
import io
import base64
import logging
import asyncio

logger = logging.getLogger(__name__)

SOCIAL_DOMAINS = {
    'instagram.com': 'instagram',
    'www.instagram.com': 'instagram',
    'facebook.com': 'facebook',
    'www.facebook.com': 'facebook',
    'tiktok.com': 'tiktok',
    'www.tiktok.com': 'tiktok',
}


def _detect_social_platform(url: str) -> Optional[str]:
    host = urlparse(url).hostname or ''
    return SOCIAL_DOMAINS.get(host.lower())


async def _scrape_social_profile(url: str, platform: str) -> Dict:
    """Extract brand info from social media profiles via multiple strategies."""
    parsed = urlparse(url)
    path_parts = [p for p in parsed.path.strip('/').split('/') if p]
    username = path_parts[0] if path_parts else 'brand'

    logger.info(f"{'='*60}")
    logger.info(f"📱 SOCIAL PROFILE SCRAPE START: @{username} on {platform}")
    logger.info(f"📱 URL: {url}")
    logger.info(f"{'='*60}")

    title = username
    description = ''
    logo_url = ''

    # ── Strategy 1: OG Meta Tags ──
    logger.info(f"── STRATEGY 1: OG Meta Tags (trying 3 User-Agents) ──")
    user_agents = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ]

    html = None
    got_429 = False
    for idx, ua in enumerate(user_agents):
        ua_label = ['Googlebot', 'FacebookBot', 'Chrome'][idx]
        headers = {'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9'}
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                logger.info(f"  [{ua_label}] HTTP {resp.status_code}, body={len(resp.text)} bytes")
                if resp.status_code == 200 and len(resp.text) > 1000:
                    html = resp.text
                    logger.info(f"  ✅ Got HTML with {ua_label}")
                    break
                elif resp.status_code == 429:
                    got_429 = True
                    logger.info(f"  ⚠️ Rate limited (429), will retry after delay")
                else:
                    logger.info(f"  ⏭️ Skipped (status={resp.status_code}, too short={len(resp.text) <= 1000})")
        except Exception as e:
            logger.warning(f"  ❌ [{ua_label}] failed: {e}")
        await asyncio.sleep(1)

    # Fallback: try Google Cache or Wayback Machine when Instagram blocks us
    if not html and got_429 and platform == 'instagram':
        logger.info(f"  🔄 Instagram blocked (429). Trying Google Cache...")
        try:
            cache_url = f"https://webcache.googleusercontent.com/search?q=cache:instagram.com/{username}"
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
                resp = await client.get(cache_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                })
                logger.info(f"  [GoogleCache] HTTP {resp.status_code}, body={len(resp.text)} bytes")
                if resp.status_code == 200 and len(resp.text) > 1000:
                    html = resp.text
                    logger.info(f"  ✅ Got HTML from Google Cache")
        except Exception as e:
            logger.info(f"  ❌ Google Cache failed: {e}")

    if not html and got_429 and platform == 'instagram':
        logger.info(f"  🔄 Trying Wayback Machine...")
        try:
            wb_api = f"https://archive.org/wayback/available?url=instagram.com/{username}"
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                wb_resp = await client.get(wb_api)
                if wb_resp.status_code == 200:
                    wb_data = wb_resp.json()
                    snapshot = wb_data.get("archived_snapshots", {}).get("closest", {})
                    if snapshot.get("available") and snapshot.get("url"):
                        snap_url = snapshot["url"]
                        logger.info(f"  Wayback snapshot found: {snap_url}")
                        resp = await client.get(snap_url, headers={'User-Agent': 'Mozilla/5.0'})
                        if resp.status_code == 200 and len(resp.text) > 1000:
                            html = resp.text
                            logger.info(f"  ✅ Got HTML from Wayback ({len(html)} bytes)")
                    else:
                        logger.info(f"  ❌ No Wayback snapshot available")
        except Exception as e:
            logger.info(f"  ❌ Wayback failed: {e}")

    if html:
        soup = BeautifulSoup(html, 'html.parser')
        og_title = soup.find('meta', attrs={'property': 'og:title'})
        og_desc = soup.find('meta', attrs={'property': 'og:description'})
        og_img = soup.find('meta', attrs={'property': 'og:image'})
        meta_desc = soup.find('meta', attrs={'name': 'description'})

        logger.info(f"  og:title = {og_title['content'][:80] if og_title and og_title.get('content') else '(empty)'}")
        logger.info(f"  og:description = {og_desc['content'][:120] if og_desc and og_desc.get('content') else '(empty)'}")
        logger.info(f"  meta description = {meta_desc['content'][:120] if meta_desc and meta_desc.get('content') else '(empty)'}")
        logger.info(f"  og:image = {'found' if og_img and og_img.get('content') else '(empty)'}")

        if og_title and og_title.get('content'):
            title = og_title['content'].strip()
        # Prefer meta description over og:description — it often has the real bio in quotes
        meta_desc_text = meta_desc['content'].strip() if meta_desc and meta_desc.get('content') else ''
        og_desc_text = og_desc['content'].strip() if og_desc and og_desc.get('content') else ''
        raw_desc = meta_desc_text or og_desc_text
        # Extract quoted bio: '... on Instagram: "The place where everyone are happy"'
        bio_quote = re.search(r':\s*["\u201c](.{3,}?)["\u201d]\s*$', raw_desc)
        if bio_quote:
            description = bio_quote.group(1).strip()
            logger.info(f"  ✅ Extracted bio from quotes: '{description[:80]}'")
        else:
            description = raw_desc
        if og_img and og_img.get('content'):
            logo_url = og_img['content'].strip()

        is_generic = _is_generic_description(description, username, platform) if description else True
        logger.info(f"  RESULT: title='{title[:60]}', desc='{description[:80]}...', generic={is_generic}")
    else:
        logger.warning(f"  ❌ Strategy 1 FAILED: no HTML received from any User-Agent")

    # ── Strategy 1.5: Extract embedded JSON from HTML (bio, posts, images) ──
    ig_data: Dict = {"bio": "", "full_name": "", "post_urls": [], "post_images": [], "post_captions": [], "profile_pic": ""}
    if html and platform == 'instagram':
        logger.info(f"── STRATEGY 1.5: Extract embedded JSON from HTML ({len(html)} bytes) ──")
        ig_data = _extract_ig_data_from_html(html, username)
        if ig_data.get("bio"):
            description = ig_data["bio"]
            logger.info(f"  ✅ Got bio from embedded JSON: '{description[:80]}'")
        if ig_data.get("full_name"):
            title = ig_data["full_name"]
            logger.info(f"  ✅ Got full_name: '{title}'")
        if ig_data.get("profile_pic"):
            logo_url = ig_data["profile_pic"]
        logger.info(f"  Posts found: {len(ig_data['post_urls'])}, Images: {len(ig_data['post_images'])}, Captions: {len(ig_data['post_captions'])}")
    elif html:
        logger.info(f"── STRATEGY 1.5: SKIPPED (not Instagram) ──")

    # ── Strategy 2: Instagram web_profile_info API ──
    if platform == 'instagram' and (not ig_data.get("post_images") or not description or _is_generic_description(description, username, platform)):
        logger.info(f"── STRATEGY 2: Instagram web_profile_info API ──")
        try:
            api_url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(api_url, headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'X-IG-App-ID': '936619743392459',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': '*/*',
                    'Referer': f'https://www.instagram.com/{username}/',
                    'X-ASBD-ID': '129477',
                })
                logger.info(f"  HTTP {resp.status_code}, body={len(resp.text)} bytes")
                if resp.status_code == 200 and resp.text.strip().startswith('{'):
                    data = resp.json()
                    user_data = data.get('data', {}).get('user', {})
                    if user_data:
                        bio = user_data.get('biography', '')
                        fname = user_data.get('full_name', '')
                        if bio and (not description or _is_generic_description(description, username, platform)):
                            description = bio
                            logger.info(f"  ✅ Got bio: '{bio[:80]}'")
                        if fname:
                            title = fname
                            logger.info(f"  ✅ Got name: '{fname}'")
                        pic = user_data.get('profile_pic_url_hd') or user_data.get('profile_pic_url', '')
                        if pic:
                            logo_url = pic
                        # Extract posts
                        edges = user_data.get('edge_owner_to_timeline_media', {}).get('edges', [])
                        if edges and not ig_data.get("post_images"):
                            for edge in edges[:6]:
                                node = edge.get('node', {})
                                sc = node.get('shortcode', '')
                                if sc:
                                    ig_data["post_urls"].append(f"https://www.instagram.com/p/{sc}/")
                                img = node.get('display_url', '') or node.get('thumbnail_src', '')
                                if img:
                                    ig_data["post_images"].append(img)
                                cap_edges = node.get('edge_media_to_caption', {}).get('edges', [])
                                cap = cap_edges[0].get('node', {}).get('text', '') if cap_edges else ''
                                ig_data["post_captions"].append(cap)
                            logger.info(f"  ✅ Got {len(ig_data['post_images'])} post images, {len([c for c in ig_data['post_captions'] if c])} captions")
                        elif edges:
                            logger.info(f"  ℹ️ API has {len(edges)} posts but already have images from Strategy 1.5")
                    else:
                        logger.info(f"  ⚠️ JSON parsed but no data.user found")
                else:
                    logger.info(f"  ⚠️ Non-200 or non-JSON response, skipping")
        except Exception as e:
            logger.warning(f"  ❌ Strategy 2 FAILED: {e}")
    elif platform == 'instagram':
        logger.info(f"── STRATEGY 2: SKIPPED (have description + images) ──")

    # ── Strategy 3: Google Search ──
    if not description or _is_generic_description(description, username, platform):
        logger.info(f"── STRATEGY 3: Google Search for cached profile info ──")
        logger.info(f"  Reason: description is {'empty' if not description else 'generic (login/signup text)'}")
        google_desc = await _google_search_profile(username, platform)
        if google_desc:
            description = google_desc
            logger.info(f"  ✅ Google found: '{description[:120]}...'")
        else:
            logger.info(f"  ❌ Google returned nothing useful")
    else:
        logger.info(f"── STRATEGY 3: SKIPPED (have good description: '{description[:60]}...') ──")

    # ── Strategy 4: Gemini Vision on recent posts (always try for Instagram) ──
    vision_analysis = ''
    has_images = bool(ig_data.get("post_images"))
    if platform == 'instagram' or has_images or not description or _is_generic_description(description, username, platform):
        logger.info(f"── STRATEGY 4: Gemini Vision (analyzing recent post images) ──")
        vision_analysis = await _vision_analyze_recent_posts(username, platform, html, ig_data)
        if vision_analysis:
            logger.info(f"  ✅ Vision result: '{vision_analysis[:150]}...'")
        else:
            logger.info(f"  ❌ Vision analysis returned nothing")
    else:
        logger.info(f"── STRATEGY 4: SKIPPED (no images and have good description) ──")

    # ── Strategy 5: Playwright screenshot + Gemini Vision + avatar extraction ──
    if not vision_analysis and platform == 'instagram':
        logger.info(f"── STRATEGY 5: Playwright headless browser screenshot ──")
        logger.info(f"  Reason: all prior strategies failed to get post images")
        pw_result = await _playwright_screenshot_and_analyze(username)
        if pw_result:
            vision_analysis = pw_result
            logger.info(f"  ✅ Playwright+Vision result: '{vision_analysis[:150]}...'")
        else:
            logger.info(f"  ❌ Playwright analysis returned nothing")

    # ── Strategy 5b: Extract avatar via Playwright if logo_url is still empty/generic ──
    is_likely_avatar = logo_url and ('profile_pic' in logo_url or '/t51.2885-19/' in logo_url)
    if platform == 'instagram' and not is_likely_avatar:
        logger.info(f"── STRATEGY 5b: Playwright avatar extraction for @{username} ──")
        pw_avatar = await _extract_ig_avatar_via_playwright(username)
        if pw_avatar:
            logo_url = pw_avatar
            logger.info(f"  ✅ Avatar found: {logo_url[:80]}")
        else:
            logger.info(f"  ❌ Could not extract avatar via Playwright")

    if not description or _is_generic_description(description, username, platform):
        description = vision_analysis or f"@{username} on {platform.capitalize()}"
        logger.info(f"  Final fallback description: '{description[:80]}'")

    combined_content = "\n".join(filter(None, [description, vision_analysis]))

    logger.info(f"{'='*60}")
    logger.info(f"📱 SOCIAL PROFILE SCRAPE COMPLETE: @{username}")
    logger.info(f"  title: {title[:60]}")
    logger.info(f"  description: {description[:120]}")
    logger.info(f"  logo_url: {'yes' if logo_url else 'no'}")
    logger.info(f"  vision_analysis: {'yes' if vision_analysis else 'no'}")
    logger.info(f"  combined_content length: {len(combined_content)} chars")
    logger.info(f"{'='*60}")

    return {
        "url": url,
        "title": title,
        "description": description,
        "content": combined_content or description,
        "colors": [],
        "logo_url": logo_url,
        "brand_voice": "casual",
        "products": [],
        "key_features": [],
        "industry": f"{platform.capitalize()} profile",
    }


def _is_generic_description(desc: str, username: str, platform: str) -> bool:
    """Check if description is just a generic Instagram/social login page text."""
    if not desc:
        return True
    low = desc.lower()
    # If it has quoted bio text like: on Instagram: "actual bio here" — not generic
    if re.search(r':\s*["\u201c].{5,}["\u201d]', desc):
        return False
    generic_markers = [
        'login', 'log in', 'sign up', 'sign in', 'create an account',
        'see photos and videos from', 'see instagram photos',
    ]
    if any(m in low for m in generic_markers):
        return True
    # "N Followers, N Following, N Posts" without any extra info
    if re.match(r'^\d+\s+followers?,\s*\d+\s+following,\s*\d+\s+posts?\s*$', low.strip(' -.')):
        return True
    return False


async def _google_search_profile(username: str, platform: str) -> str:
    """Search Google for cached social profile info (bio, description)."""
    queries = [
        f"site:{platform}.com {username}",
        f'"{username}" {platform} bio',
        f'instagram.com/{username}',
    ]
    google_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    all_snippets: List[str] = []
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            for query in queries:
                if all_snippets:
                    break
                search_url = f"https://www.google.com/search?q={query}&hl=en&num=10"
                logger.info(f"  Google query: '{query}'")
                resp = await client.get(search_url, headers=google_headers)
                logger.info(f"  Google HTTP {resp.status_code}, body={len(resp.text)} bytes")
                if resp.status_code != 200:
                    continue
                soup = BeautifulSoup(resp.text, 'html.parser')
                # Broad selector: all text blocks in search results
                for el in soup.find_all(['div', 'span']):
                    cls = ' '.join(el.get('class', []))
                    # Google snippet classes (various versions)
                    if re.search(r'VwiC3b|IsZvec|aCOpRe|s3v9rd|BNeawe|yDYNvb|lEBKkf', cls):
                        text = el.get_text(strip=True)
                        if text and len(text) > 15:
                            low = text.lower()
                            if any(skip in low for skip in ['login', 'sign up', 'create an account', 'see photos and videos']):
                                continue
                            if text not in all_snippets:
                                all_snippets.append(text)

                # Also extract meta descriptions from result links
                for cite in soup.find_all('span', class_=re.compile(r'VuuXrf|qLRx3b|hgKElc')):
                    text = cite.get_text(strip=True)
                    if text and len(text) > 20 and text not in all_snippets:
                        all_snippets.append(text)

                logger.info(f"  Snippets found: {len(all_snippets)}")
                for i, s in enumerate(all_snippets[:3]):
                    logger.info(f"    snippet[{i}]: '{s[:120]}'")
                await asyncio.sleep(0.5)
    except Exception as e:
        logger.warning(f"  ❌ Google search failed: {e}")

    if all_snippets:
        return ' '.join(all_snippets[:4])[:600]
    return ''


def _extract_ig_data_from_html(html: str, username: str) -> Dict:
    """Extract bio, posts, images from Instagram's embedded JSON in HTML."""
    result: Dict = {"bio": "", "full_name": "", "post_urls": [], "post_images": [], "post_captions": [], "profile_pic": ""}
    if not html:
        return result

    import json as _json

    # Method 1: window._sharedData JSON
    shared_match = re.search(r'window\._sharedData\s*=\s*({.+?});</script>', html)
    if shared_match:
        try:
            shared = _json.loads(shared_match.group(1))
            user_data = shared.get("entry_data", {}).get("ProfilePage", [{}])[0].get("graphql", {}).get("user", {})
            if user_data:
                result["bio"] = user_data.get("biography", "")
                result["full_name"] = user_data.get("full_name", "")
                result["profile_pic"] = user_data.get("profile_pic_url_hd", "") or user_data.get("profile_pic_url", "")
                edges = user_data.get("edge_owner_to_timeline_media", {}).get("edges", [])
                for edge in edges[:6]:
                    node = edge.get("node", {})
                    sc = node.get("shortcode", "")
                    if sc:
                        result["post_urls"].append(f"https://www.instagram.com/p/{sc}/")
                    img = node.get("display_url", "") or node.get("thumbnail_src", "")
                    if img:
                        result["post_images"].append(img)
                    caption_edges = node.get("edge_media_to_caption", {}).get("edges", [])
                    cap = caption_edges[0].get("node", {}).get("text", "") if caption_edges else ""
                    result["post_captions"].append(cap)
                logger.info(f"    _sharedData: bio='{result['bio'][:60]}', posts={len(result['post_urls'])}, images={len(result['post_images'])}")
                return result
        except Exception as e:
            logger.info(f"    _sharedData parse failed: {e}")

    # Method 2: __additionalDataLoaded or require("relay")
    additional_matches = re.findall(r'window\.__additionalDataLoaded\([^,]+,\s*({.+?})\);</script>', html)
    for match_str in additional_matches:
        try:
            data = _json.loads(match_str)
            user_data = data.get("graphql", {}).get("user", {})
            if not user_data:
                for key in data:
                    if isinstance(data[key], dict) and "biography" in str(data[key])[:200]:
                        user_data = data[key]
                        break
            if user_data and isinstance(user_data, dict):
                result["bio"] = user_data.get("biography", "") or result["bio"]
                result["full_name"] = user_data.get("full_name", "") or result["full_name"]
                edges = user_data.get("edge_owner_to_timeline_media", {}).get("edges", [])
                for edge in edges[:6]:
                    node = edge.get("node", {})
                    sc = node.get("shortcode", "")
                    if sc:
                        result["post_urls"].append(f"https://www.instagram.com/p/{sc}/")
                    img = node.get("display_url", "") or node.get("thumbnail_src", "")
                    if img:
                        result["post_images"].append(img)
                    caption_edges = node.get("edge_media_to_caption", {}).get("edges", [])
                    cap = caption_edges[0].get("node", {}).get("text", "") if caption_edges else ""
                    result["post_captions"].append(cap)
                if result["post_urls"]:
                    logger.info(f"    __additionalData: bio='{result['bio'][:60]}', posts={len(result['post_urls'])}")
                    return result
        except Exception:
            pass

    # Method 3: Regex fallback — find display_url and shortcodes in raw HTML/JSON
    display_urls = re.findall(r'"display_url"\s*:\s*"(https?://[^"]+)"', html)
    shortcodes = re.findall(r'"shortcode"\s*:\s*"([A-Za-z0-9_-]{6,})"', html)
    captions = re.findall(r'"text"\s*:\s*"([^"]{10,200})"', html)

    seen_sc = set()
    for sc in shortcodes:
        if sc not in seen_sc:
            seen_sc.add(sc)
            result["post_urls"].append(f"https://www.instagram.com/p/{sc}/")

    for du in display_urls[:6]:
        clean = du.replace("\\u0026", "&").replace("\\/", "/")
        result["post_images"].append(clean)

    # Filter captions: skip generic/short ones
    for cap in captions[:6]:
        decoded = cap.encode().decode('unicode_escape', errors='ignore')
        if len(decoded) > 10 and 'login' not in decoded.lower():
            result["post_captions"].append(decoded)

    # Bio from meta description fallback
    bio_match = re.search(r'"biography"\s*:\s*"([^"]*)"', html)
    if bio_match:
        result["bio"] = bio_match.group(1).encode().decode('unicode_escape', errors='ignore')

    name_match = re.search(r'"full_name"\s*:\s*"([^"]*)"', html)
    if name_match:
        result["full_name"] = name_match.group(1).encode().decode('unicode_escape', errors='ignore')

    logger.info(f"    Regex fallback: bio='{result['bio'][:60]}', shortcodes={len(result['post_urls'])}, display_urls={len(result['post_images'])}, captions={len(result['post_captions'])}")
    return result


async def _get_post_urls_from_google(username: str, platform: str) -> List[str]:
    """Find recent post URLs via Google search."""
    try:
        query = f"site:{platform}.com/p/ {username}"
        search_url = f"https://www.google.com/search?q={query}&hl=en&num=6"
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(search_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            })
            if resp.status_code != 200:
                return []
        soup = BeautifulSoup(resp.text, 'html.parser')
        urls = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            match = re.search(rf'https?://(?:www\.)?{platform}\.com/p/[A-Za-z0-9_-]+', href)
            if match and match.group() not in urls:
                urls.append(match.group() + '/')
        return urls[:6]
    except Exception as e:
        logger.warning(f"⚠️ Google post search failed: {e}")
        return []


async def _fetch_post_image_and_caption(post_url: str) -> Optional[Dict]:
    """Fetch og:image and og:description from an Instagram post URL."""
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.get(post_url, headers={
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                'Accept': 'text/html',
            })
            if resp.status_code != 200 or len(resp.text) < 500:
                return None
        soup = BeautifulSoup(resp.text, 'html.parser')
        og_img = soup.find('meta', attrs={'property': 'og:image'})
        og_desc = soup.find('meta', attrs={'property': 'og:description'})
        image_url = og_img['content'].strip() if og_img and og_img.get('content') else ''
        caption = og_desc['content'].strip() if og_desc and og_desc.get('content') else ''
        if not image_url:
            return None
        return {"image_url": image_url, "caption": caption}
    except Exception as e:
        logger.warning(f"⚠️ Post fetch failed {post_url}: {e}")
        return None


async def _vision_analyze_recent_posts(username: str, platform: str, html: str = None, ig_data: Dict = None) -> str:
    """Fetch recent post images + captions and analyze with Gemini Vision."""
    try:
        import google.generativeai as genai
        import os

        api_key = os.getenv("GOOGLE_AI_API_KEY")
        if not api_key:
            logger.warning(f"  ❌ GOOGLE_AI_API_KEY not set, skipping vision")
            return ''

        image_parts = []
        captions = []

        # Priority: use pre-extracted images from ig_data (embedded JSON)
        if ig_data and ig_data.get("post_images"):
            logger.info(f"  Using {len(ig_data['post_images'])} images from embedded HTML JSON (Strategy 1.5)")
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                for j, img_url in enumerate(ig_data["post_images"][:3]):
                    try:
                        resp = await client.get(img_url)
                        if resp.status_code == 200 and len(resp.content) > 1000:
                            ct = resp.headers.get('content-type', 'image/jpeg').split(';')[0].strip()
                            if ct not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
                                ct = 'image/jpeg'
                            image_parts.append({"mime_type": ct, "data": resp.content})
                            logger.info(f"    image[{j}]: ✅ downloaded {len(resp.content)} bytes ({ct})")
                        else:
                            logger.info(f"    image[{j}]: ⚠️ HTTP {resp.status_code}, size={len(resp.content)}")
                    except Exception as e:
                        logger.info(f"    image[{j}]: ❌ download failed: {e}")
            captions = [c for c in (ig_data.get("post_captions") or [])[:3] if c]
            logger.info(f"    Captions from embedded data: {len(captions)}")

        # Fallback: find posts via shortcodes in HTML + Google
        if not image_parts:
            logger.info(f"  No embedded images, trying shortcode/Google fallback...")

            post_urls: List[str] = []
            shortcodes = re.findall(r'/p/([A-Za-z0-9_-]{6,})', html or '')
            seen = set()
            for sc in shortcodes:
                if sc not in seen:
                    seen.add(sc)
                    post_urls.append(f"https://www.instagram.com/p/{sc}/")
            logger.info(f"    From HTML shortcodes: {len(post_urls)}")

            if len(post_urls) < 3:
                google_urls = await _get_post_urls_from_google(username, platform)
                logger.info(f"    From Google: {len(google_urls)}")
                for u in google_urls:
                    if u not in seen:
                        post_urls.append(u)
                        seen.add(u)
            post_urls = post_urls[:6]

            if post_urls:
                logger.info(f"    Fetching og:image from {len(post_urls)} post URLs...")
                tasks = [_fetch_post_image_and_caption(u) for u in post_urls]
                results = await asyncio.gather(*tasks)
                posts = [r for r in results if r]
                logger.info(f"    Got {len(posts)}/{len(post_urls)} posts with images")

                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    for j, post in enumerate(posts[:3]):
                        try:
                            resp = await client.get(post["image_url"])
                            if resp.status_code == 200 and len(resp.content) > 1000:
                                ct = resp.headers.get('content-type', 'image/jpeg').split(';')[0].strip()
                                if ct not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
                                    ct = 'image/jpeg'
                                image_parts.append({"mime_type": ct, "data": resp.content})
                                if post.get("caption"):
                                    captions.append(post["caption"])
                                logger.info(f"    image[{j}]: ✅ downloaded {len(resp.content)} bytes")
                            else:
                                logger.info(f"    image[{j}]: ⚠️ HTTP {resp.status_code}")
                        except Exception as e:
                            logger.info(f"    image[{j}]: ❌ {e}")

        # Last resort: Google Image Search for profile-related images
        if not image_parts:
            logger.info(f"  Trying Google Image Search for @{username}...")
            try:
                gimg_url = f"https://www.google.com/search?q=instagram.com/{username}+posts&tbm=isch&hl=en"
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    resp = await client.get(gimg_url, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    })
                    if resp.status_code == 200:
                        img_urls = re.findall(r'\["(https?://[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"', resp.text)
                        # Filter out tiny Google UI images
                        img_urls = [u for u in img_urls if 'gstatic.com' not in u and 'google.com' not in u][:5]
                        logger.info(f"    Google Images found: {len(img_urls)} candidate URLs")
                        for j, iu in enumerate(img_urls[:3]):
                            try:
                                r = await client.get(iu, timeout=8.0)
                                ct = r.headers.get('content-type', 'image/jpeg').split(';')[0].strip()
                                logger.info(f"    gimg[{j}]: HTTP {r.status_code}, {len(r.content)} bytes, ct={ct}")
                                if r.status_code == 200 and len(r.content) > 1000:
                                    if not ct.startswith('image/'):
                                        ct = 'image/jpeg'
                                    image_parts.append({"mime_type": ct, "data": r.content})
                                    logger.info(f"    gimg[{j}]: ✅ added")
                            except Exception as e:
                                logger.info(f"    gimg[{j}]: ❌ {e}")
            except Exception as e:
                logger.info(f"    Google Image Search failed: {e}")

        if not image_parts:
            logger.info(f"  ❌ No images available for vision analysis")
            return ''

        logger.info(f"  Sending {len(image_parts)} images + {len(captions)} captions to Gemini Vision...")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        captions_text = "\n".join(f"- {c}" for c in captions) if captions else "No captions available."
        logger.info(f"    Captions sent to AI: {captions_text[:200]}")

        prompt = f"""These are {len(image_parts)} recent post images from @{username} on {platform.capitalize()}.
Post captions:
{captions_text}

Based on the images and captions, determine:
1. What kind of business/brand is this?
2. What products or services do they offer?
3. What industry are they in?

Provide a concise 2-3 sentence description of the business. If you truly cannot determine anything, respond with just "UNKNOWN"."""

        content_parts = [prompt] + image_parts
        response = model.generate_content(content_parts)
        text = response.text.strip()
        logger.info(f"    Gemini Vision response: '{text[:200]}'")
        if text.upper() == 'UNKNOWN' or len(text) < 10:
            logger.info(f"  ❌ Vision returned UNKNOWN or too short")
            return ''
        logger.info(f"  ✅ Vision analysis complete ({len(text)} chars)")
        return text
    except Exception as e:
        logger.warning(f"  ❌ Vision analysis failed: {e}")
        return ''


async def _extract_ig_avatar_via_playwright(username: str) -> str:
    """Open Instagram profile in Playwright and extract the profile picture URL from DOM."""
    try:
        from playwright.async_api import async_playwright
        import shutil

        async with async_playwright() as p:
            chromium_path = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
            launch_kwargs = {
                'headless': True,
                'args': ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                         '--disable-gpu', '--single-process', '--no-zygote'],
            }
            if chromium_path:
                launch_kwargs['executable_path'] = chromium_path

            browser = await p.chromium.launch(**launch_kwargs)
            try:
                ctx = await browser.new_context(
                    viewport={'width': 1280, 'height': 1200},
                    user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
                )
                page = await ctx.new_page()
                url = f"https://www.instagram.com/{username}/"
                try:
                    await page.goto(url, wait_until='domcontentloaded', timeout=15000)
                except Exception:
                    pass
                await asyncio.sleep(3)

                for sel in ['button:has-text("Not Now")', 'button:has-text("Not now")', '[aria-label="Close"]']:
                    try:
                        btn = page.locator(sel).first
                        if await btn.is_visible(timeout=1000):
                            await btn.click()
                            await asyncio.sleep(0.5)
                    except Exception:
                        pass

                # Instagram avatar: img[alt*="profile picture"] or header img with scontent URL
                avatar_url = await page.evaluate("""() => {
                    const imgs = document.querySelectorAll('img');
                    for (const img of imgs) {
                        const alt = (img.alt || '').toLowerCase();
                        const src = img.src || '';
                        if (alt.includes('profile picture') && src.includes('scontent')) return src;
                    }
                    // Fallback: first scontent img in header area that's small (avatar)
                    for (const img of imgs) {
                        const src = img.src || '';
                        const w = img.naturalWidth || img.width || 0;
                        if (src.includes('scontent') && w > 0 && w <= 300) return src;
                    }
                    return '';
                }""")

                if avatar_url:
                    logger.info(f"  ✅ Playwright found IG avatar: {avatar_url[:80]}")
                    return avatar_url
            finally:
                await browser.close()
    except Exception as e:
        logger.warning(f"  Playwright IG avatar extraction failed: {e}")
    return ""


async def _playwright_screenshot_and_analyze(username: str) -> str:
    """Take screenshots of Instagram profile with headless browser, send to Gemini Vision."""
    try:
        import google.generativeai as genai
        import os

        api_key = os.getenv("GOOGLE_AI_API_KEY")
        if not api_key:
            logger.warning(f"  ❌ GOOGLE_AI_API_KEY not set")
            return ''

        from playwright.async_api import async_playwright
        import shutil

        screenshots = []
        browser = None
        async with async_playwright() as p:
            try:
                chromium_path = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
                chrome_args = [
                    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                    '--disable-gpu', '--single-process', '--no-zygote',
                    '--disable-extensions', '--disable-background-networking',
                    '--disable-default-apps', '--disable-sync', '--no-first-run',
                ]
                launch_kwargs = {'headless': True, 'args': chrome_args}
                if chromium_path:
                    launch_kwargs['executable_path'] = chromium_path
                    logger.info(f"  Using system Chromium: {chromium_path}")
                browser = await p.chromium.launch(**launch_kwargs)
                context = await browser.new_context(
                    viewport={'width': 1280, 'height': 1200},
                    user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                    locale='en-US',
                    java_script_enabled=True,
                )
                page = await context.new_page()

                url = f"https://www.instagram.com/{username}/"
                logger.info(f"  Opening {url} in headless browser...")
                try:
                    await page.goto(url, wait_until='domcontentloaded', timeout=20000)
                except Exception as nav_err:
                    logger.info(f"  Navigation warning: {nav_err}")

                await asyncio.sleep(3)

                current_url = page.url
                logger.info(f"  Current URL: {current_url}")

                # Dismiss any popups/modals
                for sel in ['button:has-text("Not Now")', 'button:has-text("Not now")', '[aria-label="Close"]', 'button:has-text("Decline")', 'button:has-text("Accept")', 'button:has-text("Allow")']:
                    try:
                        btn = page.locator(sel).first
                        if await btn.is_visible(timeout=1000):
                            await btn.click()
                            await asyncio.sleep(0.3)
                            logger.info(f"  Dismissed popup: {sel}")
                    except Exception:
                        pass

                # Take screenshots
                for i, scroll_y in enumerate([0, 600, 1200]):
                    try:
                        if scroll_y > 0:
                            await page.evaluate(f'window.scrollTo(0, {scroll_y})')
                            await asyncio.sleep(1.5)
                        ss = await page.screenshot(type='jpeg', quality=80, full_page=False)
                        if len(ss) > 5000:
                            screenshots.append(ss)
                            logger.info(f"    Screenshot {i+1} (scroll={scroll_y}): {len(ss)} bytes")
                    except Exception as ss_err:
                        logger.info(f"    Screenshot {i+1} failed: {ss_err}")
                        break

            except Exception as browser_err:
                logger.warning(f"  ❌ Browser error: {browser_err}")
            finally:
                if browser:
                    try:
                        await browser.close()
                    except Exception:
                        pass

        if not screenshots:
            logger.info(f"  ❌ No screenshots captured")
            return ''

        logger.info(f"  Sending {len(screenshots)} screenshots to Gemini Vision...")
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = f"""These are {len(screenshots)} screenshots of the Instagram profile @{username}.
The screenshots may show: profile header (name, bio, avatar, follower count), posts grid with thumbnails, or a login page with profile content partially visible behind it.

IMPORTANT: Even if there's a login popup/overlay, look at ANY visible content behind it — profile picture, name, bio text, post thumbnails in the background.

Based on everything visible:
1. What is this person/brand/business about?
2. What products, services, or content do they offer?
3. What industry or niche are they in?
4. Read any visible bio text, name, and describe visible post thumbnails.

Provide a concise 2-3 sentence description. Make your best guess based on visual clues. Only respond "UNKNOWN" if the screenshots are completely blank or unreadable."""

        content_parts = [prompt] + [{"mime_type": "image/jpeg", "data": ss} for ss in screenshots]
        response = model.generate_content(content_parts)
        text = response.text.strip()
        logger.info(f"    Gemini response: '{text[:200]}'")

        if text.upper() == 'UNKNOWN' or len(text) < 10:
            return ''
        return text
    except ImportError:
        logger.warning(f"  ❌ Playwright not installed, skipping Strategy 5")
        return ''
    except Exception as e:
        logger.warning(f"  ❌ Playwright screenshot failed: {e}")
        return ''


async def scrape_website(url: str) -> Dict:
    """Analyzes website and extracts brand information"""

    social = _detect_social_platform(url)
    if social:
        logger.info(f"📱 Detected {social} URL, using social scraper")
        return await _scrape_social_profile(url, social)
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
    }
    
    logger.info(f"🔍 Starting scrape of {url}")
    
    async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
        try:
            response = await client.get(url, headers=headers)
        except httpx.TimeoutException:
            logger.error(f"⏱️ Timeout scraping {url}")
            raise ValueError(f"Website took too long to respond (>45s)")
        except httpx.ConnectError as e:
            logger.error(f"🔌 Connection error scraping {url}: {e}")
            raise ValueError(f"Could not connect to website: {e}")
        
        logger.info(f"📡 Response: {response.status_code}, content-type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code != 200:
            raise ValueError(f"Failed to fetch website: HTTP {response.status_code}")
        
        try:
            html = response.text
        except Exception as e:
            logger.error(f"Failed to decode response as text: {e}")
            html = response.content.decode('utf-8', errors='ignore')
    
    logger.info(f"🔍 Scraped {url} → Status: {response.status_code}, Size: {len(html)} bytes")
    
    # Check if we got valid content
    if len(html) < 500:
        raise ValueError(f"Website returned too little content ({len(html)} bytes)")
    
    # Try different parsers in case html.parser fails
    try:
        soup = BeautifulSoup(html, 'html.parser')
    except Exception as e:
        logger.warning(f"html.parser failed, trying lxml: {e}")
        try:
            soup = BeautifulSoup(html, 'lxml')
        except Exception as e2:
            logger.warning(f"lxml failed, trying html5lib: {e2}")
            soup = BeautifulSoup(html, 'html5lib')
    
    # Extract non-destructive data FIRST (before _extract_main_content mutates soup)
    title = _extract_title(soup)
    description = _extract_description(soup)
    colors = await _extract_colors(soup, url)
    logo_url = _extract_logo(soup, url)

    # SPA fallback: if no logo found (or only favicon), try Playwright rendered HTML
    if not logo_url or '/favicon' in logo_url:
        logger.info("🔄 Logo not found via static HTML, trying Playwright fallback...")
        pw_logo = await _extract_logo_via_playwright(url)
        if pw_logo:
            logo_url = pw_logo
            logger.info(f"✅ Playwright found logo: {logo_url[:80]}")
        else:
            logger.info("⚠️ Playwright also could not find logo")

    brand_voice = _analyze_brand_voice(soup)
    products = _extract_products(soup)
    key_features = _extract_key_features(soup)

    # This call uses decompose() — must be last
    content = _extract_main_content(soup)
    
    logger.info(f"📄 Extracted - Title: '{title[:80]}'")
    logger.info(f"📄 Description: '{description[:100]}'")
    logger.info(f"📄 Colors: {colors}")
    logger.info(f"📄 Content preview: '{content[:150]}...'")
    
    return {
        "url": url,
        "title": title,
        "description": description,
        "content": content,
        "colors": colors,
        "logo_url": logo_url,
        "brand_voice": brand_voice,
        "products": products,
        "key_features": key_features
    }


def _extract_title(soup: BeautifulSoup) -> str:
    """Extracts page title"""
    title = soup.find('title')
    if title:
        return title.get_text().strip()
    
    h1 = soup.find('h1')
    if h1:
        return h1.get_text().strip()
    
    return ""


def _extract_description(soup: BeautifulSoup) -> str:
    """Extracts description from meta tags"""
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc and meta_desc.get('content'):
        return meta_desc['content'].strip()
    
    meta_og = soup.find('meta', attrs={'property': 'og:description'})
    if meta_og and meta_og.get('content'):
        return meta_og['content'].strip()
    
    return ""


def _extract_main_content(soup: BeautifulSoup) -> str:
    """Extracts main text content"""
    # Remove unnecessary elements
    for element in soup(['script', 'style', 'nav', 'footer', 'header']):
        element.decompose()
    
    # Find main content
    main = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile('content|main'))
    
    if main:
        text = main.get_text(separator=' ', strip=True)
    else:
        text = soup.get_text(separator=' ', strip=True)
    
    # Clean and limit length
    text = re.sub(r'\s+', ' ', text)
    return text[:2000]  # First 2000 characters


async def _extract_colors(soup: BeautifulSoup, base_url: str) -> List[str]:
    """Extracts website color palette from meta tags, CSS variables, inline styles, and external stylesheets."""
    raw: List[str] = []

    # 1. Meta theme-color / msapplication-TileColor (most reliable)
    for attr in [{'name': 'theme-color'}, {'name': 'msapplication-TileColor'}, {'name': 'msapplication-navbutton-color'}]:
        tag = soup.find('meta', attrs=attr)
        if tag and tag.get('content'):
            val = tag['content'].strip()
            if re.match(r'^#(?:[0-9a-fA-F]{3}){1,2}$', val):
                raw.append(val.lower())

    # 2. Inline <style> blocks — CSS custom properties and color/background declarations
    for style_tag in soup.find_all('style'):
        css = style_tag.string or ''
        raw.extend(re.findall(r'#(?:[0-9a-fA-F]{6})\b', css))
        raw.extend(re.findall(r'#(?:[0-9a-fA-F]{3})\b', css))

    # 3. Inline style attributes on elements
    for tag in soup.find_all(style=True):
        raw.extend(re.findall(r'#(?:[0-9a-fA-F]{6})\b', tag['style']))

    # 4. Try fetching main external stylesheet for more colors
    link = soup.find('link', rel='stylesheet')
    if link and link.get('href'):
        css_url = urljoin(base_url, link['href'])
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                css_resp = await client.get(css_url)
                if css_resp.status_code == 200:
                    css_text = css_resp.text[:50000]
                    raw.extend(re.findall(r'#(?:[0-9a-fA-F]{6})\b', css_text))
        except Exception:
            pass

    # Normalize to lowercase 6-char hex
    normalized = []
    for c in raw:
        c = c.lower()
        if len(c) == 4:
            c = f'#{c[1]*2}{c[2]*2}{c[3]*2}'
        normalized.append(c)

    # Filter out non-brand colors (pure white, near-white, pure black, grays)
    skip = {'#ffffff', '#fff', '#000000', '#000', '#f5f5f5', '#fafafa', '#eeeeee',
            '#e5e5e5', '#cccccc', '#999999', '#666666', '#333333', '#111111',
            '#f0f0f0', '#e0e0e0', '#d0d0d0', '#c0c0c0', '#b0b0b0', '#a0a0a0',
            '#808080', '#transparent', '#none', '#inherit'}
    filtered = []
    seen = set()
    for c in normalized:
        if c in skip or c in seen:
            continue
        # Also skip near-gray: R≈G≈B within 15
        if len(c) == 7:
            try:
                r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
                if max(r, g, b) - min(r, g, b) < 20:
                    continue
            except ValueError:
                continue
        seen.add(c)
        filtered.append(c)

    # Count occurrences for ranking — more used = more likely brand color
    from collections import Counter
    counts = Counter(normalized)
    filtered.sort(key=lambda c: counts.get(c, 0), reverse=True)

    return filtered[:6] if filtered else []


async def _extract_logo_via_playwright(url: str) -> str:
    """Fallback: render page with Playwright, then run _extract_logo on rendered HTML."""
    try:
        from playwright.async_api import async_playwright
        import shutil

        async with async_playwright() as p:
            chromium_path = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
            launch_kwargs = {
                'headless': True,
                'args': ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                         '--disable-gpu', '--single-process', '--no-zygote'],
            }
            if chromium_path:
                launch_kwargs['executable_path'] = chromium_path

            browser = await p.chromium.launch(**launch_kwargs)
            try:
                page = await browser.new_page()
                await page.goto(url, wait_until='networkidle', timeout=15000)
                await asyncio.sleep(2)
                html = await page.content()
            finally:
                await browser.close()

        soup = BeautifulSoup(html, 'html.parser')
        return _extract_logo(soup, url)
    except Exception as e:
        logger.warning(f"Playwright logo fallback failed: {e}")
        return ""


def _extract_logo(soup: BeautifulSoup, base_url: str) -> str:
    """
    Finds website logo with high confidence.
    Priority: header/nav logo img → any logo-named img → SVG in header →
              JSON-LD logo → apple-touch-icon → favicon.
    NEVER falls back to og:image (that is a social share image, not a logo).
    """

    def _resolve(src: str) -> str:
        return urljoin(base_url, src) if src else ""

    def _is_plausible_logo_size(tag) -> bool:
        """Reject images that are clearly too large to be a logo (hero/product shots)."""
        for attr in ("width", "height"):
            val = tag.get(attr, "")
            try:
                px = int(str(val).replace("px", "").strip())
                if px > 400:
                    return False
            except (ValueError, TypeError):
                pass
        return True

    # ── 1. Look inside <header> / <nav> / common header wrappers first ──
    header_containers = soup.find_all(
        ["header", "nav"],
        limit=5,
    ) + soup.find_all(
        True,
        class_=re.compile(r'\b(header|navbar|nav-bar|site-header|top-bar)\b', re.I),
        limit=5,
    )

    first_header_img = None  # track first small img in header as fallback

    for container in header_containers:
        # img with logo in class/id/alt/src
        for img in container.find_all("img", limit=10):
            classes = " ".join(img.get("class", []))
            id_val  = img.get("id", "")
            alt_val = img.get("alt", "")
            src     = img.get("src", "") or img.get("data-src", "") or img.get("data-lazy-src", "")
            if not src:
                continue
            haystack = f"{classes} {id_val} {alt_val} {src}"
            if re.search(r'logo', haystack, re.I) and _is_plausible_logo_size(img):
                return _resolve(src)
            # remember first plausible img in header as fallback
            if first_header_img is None and _is_plausible_logo_size(img):
                first_header_img = _resolve(src)

        # Any img inside an <a> that links to homepage (logo pattern)
        for a in container.find_all("a", href=True, limit=10):
            href = a["href"]
            if href in ("/", base_url, "#", ""):
                img = a.find("img")
                if img:
                    src = img.get("src", "") or img.get("data-src", "")
                    if src and _is_plausible_logo_size(img):
                        return _resolve(src)

        # SVG logo inside header
        for svg in container.find_all("svg", limit=5):
            classes = " ".join(svg.get("class", []))
            if re.search(r'logo', classes, re.I):
                pass

    # ── 2. Any <img> with "logo" in class / id / alt anywhere on page ──
    for attr, pattern in [("class", re.compile(r'logo', re.I)),
                           ("id",    re.compile(r'logo', re.I))]:
        img = soup.find("img", attrs={attr: pattern})
        if img:
            src = img.get("src", "") or img.get("data-src", "")
            if src and _is_plausible_logo_size(img):
                return _resolve(src)

    img = soup.find("img", alt=re.compile(r'logo', re.I))
    if img:
        src = img.get("src", "") or img.get("data-src", "")
        if src and _is_plausible_logo_size(img):
            return _resolve(src)

    # ── 3. JSON-LD schema.org logo ──
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            # Handle both object and list
            items = data if isinstance(data, list) else [data]
            for item in items:
                logo_field = item.get("logo")
                if isinstance(logo_field, str) and logo_field.startswith("http"):
                    return logo_field
                if isinstance(logo_field, dict):
                    url_val = logo_field.get("url", "")
                    if url_val:
                        return _resolve(url_val)
        except Exception:
            pass

    # ── 4. First small image found in header/nav (very common logo pattern) ──
    if first_header_img:
        return first_header_img

    # ── 5. <link rel="apple-touch-icon"> (reliable, always a logo/icon) ──
    for rel_val in ("apple-touch-icon", "apple-touch-icon-precomposed"):
        link = soup.find("link", rel=re.compile(rel_val, re.I))
        if link and link.get("href"):
            return _resolve(link["href"])

    # ── 6. Largest favicon as last resort ──
    best_icon = ""
    best_size = 0
    for link in soup.find_all("link", rel=re.compile(r'icon', re.I)):
        href = link.get("href", "")
        if not href:
            continue
        sizes = link.get("sizes", "0x0")
        try:
            w = int(sizes.split("x")[0])
        except (ValueError, AttributeError):
            w = 16
        if w > best_size:
            best_size = w
            best_icon = href

    if best_icon:
        return _resolve(best_icon)

    # ── No logo found — return empty string, never og:image ──
    return ""


def _analyze_brand_voice(soup: BeautifulSoup) -> str:
    """Analyzes content tone (professional, casual, etc.)"""
    text = soup.get_text()[:1000].lower()
    
    # Simple keyword analysis
    casual_indicators = ['hey', 'awesome', 'cool', 'yeah', 'gonna', 'wanna']
    formal_indicators = ['pursuant', 'therefore', 'hereby', 'enterprise', 'solutions']
    
    casual_score = sum(1 for word in casual_indicators if word in text)
    formal_score = sum(1 for word in formal_indicators if word in text)
    
    if casual_score > formal_score:
        return "casual"
    elif formal_score > casual_score:
        return "professional"
    else:
        return "balanced"


def _extract_products(soup: BeautifulSoup) -> List[str]:
    """Extracts product/service names from headings and structured data."""
    products = []
    seen = set()

    # 1. JSON-LD structured data
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            import json
            data = json.loads(script.string or '')
            items = data if isinstance(data, list) else [data]
            for item in items:
                name = item.get('name', '')
                if name and name not in seen:
                    products.append(name)
                    seen.add(name)
        except Exception:
            pass

    # 2. All h1/h2/h3 — take short, meaningful headings (likely product/section names)
    for tag in soup.find_all(['h1', 'h2', 'h3']):
        text = tag.get_text(strip=True)
        # Skip navigation, empty, or very long headings
        if 5 < len(text) < 80 and text not in seen:
            # Skip common non-product headings
            skip = ['menu', 'footer', 'header', 'nav', 'cookie', 'privacy', 'copyright']
            if not any(s in text.lower() for s in skip):
                products.append(text)
                seen.add(text)

    # 3. og:title as fallback
    og = soup.find('meta', attrs={'property': 'og:title'})
    if og and og.get('content') and og['content'] not in seen:
        products.append(og['content'])

    return products[:10]


def _extract_key_features(soup: BeautifulSoup) -> List[str]:
    """Extracts key features/benefits from lists and meta content."""
    features = []
    seen = set()

    # 1. Meta keywords
    meta_kw = soup.find('meta', attrs={'name': 'keywords'})
    if meta_kw and meta_kw.get('content'):
        for kw in meta_kw['content'].split(','):
            kw = kw.strip()
            if kw and kw not in seen:
                features.append(kw)
                seen.add(kw)

    # 2. Short list items from main content area
    main = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile('content|main'))
    search_area = main or soup

    for ul in search_area.find_all(['ul', 'ol']):
        # Skip navigation lists (inside nav/header/footer)
        if ul.find_parent(['nav', 'header', 'footer']):
            continue
        for item in ul.find_all('li'):
            text = item.get_text(strip=True)
            if 10 < len(text) < 120 and text not in seen:
                features.append(text)
                seen.add(text)
                if len(features) >= 8:
                    return features

    return features[:8]

