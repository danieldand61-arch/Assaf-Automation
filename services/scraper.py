import httpx
from bs4 import BeautifulSoup
from typing import Dict, List, Optional
import re
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
                else:
                    logger.info(f"  ⏭️ Skipped (status={resp.status_code}, too short={len(resp.text) <= 1000})")
        except Exception as e:
            logger.warning(f"  ❌ [{ua_label}] failed: {e}")
        await asyncio.sleep(1)

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
        if og_desc and og_desc.get('content'):
            description = og_desc['content'].strip()
        elif meta_desc and meta_desc.get('content'):
            description = meta_desc['content'].strip()
        if og_img and og_img.get('content'):
            logo_url = og_img['content'].strip()

        is_generic = _is_generic_description(description, username, platform) if description else True
        logger.info(f"  RESULT: title='{title[:60]}', desc='{description[:80]}...', generic={is_generic}")
    else:
        logger.warning(f"  ❌ Strategy 1 FAILED: no HTML received from any User-Agent")

    # ── Strategy 2: Instagram JSON API ──
    if platform == 'instagram' and not description:
        logger.info(f"── STRATEGY 2: Instagram ?__a=1 JSON API ──")
        try:
            api_url = f"https://www.instagram.com/{username}/?__a=1&__d=dis"
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(api_url, headers={
                    'User-Agent': 'Instagram 275.0.0.27.98 Android',
                    'Accept': 'application/json',
                })
                logger.info(f"  HTTP {resp.status_code}, body={len(resp.text)} bytes")
                if resp.status_code == 200:
                    import json
                    data = resp.json()
                    user_data = data.get('graphql', {}).get('user', {})
                    if user_data:
                        title = user_data.get('full_name') or username
                        description = user_data.get('biography', '')
                        logo_url = user_data.get('profile_pic_url_hd') or user_data.get('profile_pic_url', '')
                        logger.info(f"  ✅ Got data: name='{title}', bio='{description[:80]}', avatar={'yes' if logo_url else 'no'}")
                    else:
                        logger.info(f"  ⚠️ JSON parsed but no graphql.user data found")
                else:
                    logger.info(f"  ⚠️ Non-200 response, skipping")
        except Exception as e:
            logger.warning(f"  ❌ Strategy 2 FAILED: {e}")
    elif platform == 'instagram' and description:
        logger.info(f"── STRATEGY 2: SKIPPED (already have description from Strategy 1) ──")

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

    # ── Strategy 4: Gemini Vision on recent posts ──
    vision_analysis = ''
    if not description or _is_generic_description(description, username, platform):
        logger.info(f"── STRATEGY 4: Gemini Vision (analyzing recent post images) ──")
        logger.info(f"  Reason: description is {'empty' if not description else 'generic'}")
        vision_analysis = await _vision_analyze_recent_posts(username, platform, html)
        if vision_analysis:
            logger.info(f"  ✅ Vision result: '{vision_analysis[:150]}...'")
        else:
            logger.info(f"  ❌ Vision analysis returned nothing")
    else:
        logger.info(f"── STRATEGY 4: SKIPPED (have good description) ──")

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
    generic_markers = [
        'login', 'log in', 'sign up', 'sign in', 'create an account',
        'see photos and videos from', 'instagram', 'see instagram photos',
        f'@{username} on {platform}',
    ]
    return any(m in low for m in generic_markers) and len(desc) < 200


async def _google_search_profile(username: str, platform: str) -> str:
    """Search Google for cached social profile info (bio, description)."""
    try:
        query = f"site:{platform}.com {username}"
        search_url = f"https://www.google.com/search?q={query}&hl=en"
        logger.info(f"  Google query: '{query}'")
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(search_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            })
            logger.info(f"  Google HTTP {resp.status_code}, body={len(resp.text)} bytes")
            if resp.status_code != 200:
                return ''
            soup = BeautifulSoup(resp.text, 'html.parser')
            snippets = []
            for div in soup.find_all(['div', 'span'], class_=re.compile(r'VwiC3b|IsZvec|aCOpRe|s3v9rd')):
                text = div.get_text(strip=True)
                if text and len(text) > 20 and 'login' not in text.lower() and 'sign up' not in text.lower():
                    snippets.append(text)
            logger.info(f"  Google snippets found: {len(snippets)}")
            for i, s in enumerate(snippets[:3]):
                logger.info(f"    snippet[{i}]: '{s[:100]}'")
            if snippets:
                return ' '.join(snippets[:3])[:500]
    except Exception as e:
        logger.warning(f"  ❌ Google search failed: {e}")
    return ''


async def _get_post_urls_from_html(html: str, username: str) -> List[str]:
    """Extract Instagram post URLs from scraped HTML (shared_data / links)."""
    urls = []
    if not html:
        return urls
    # Instagram sometimes embeds post shortcodes in the HTML
    shortcodes = re.findall(r'/p/([A-Za-z0-9_-]{6,})', html)
    seen = set()
    for sc in shortcodes:
        if sc not in seen:
            seen.add(sc)
            urls.append(f"https://www.instagram.com/p/{sc}/")
    return urls[:6]


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


async def _vision_analyze_recent_posts(username: str, platform: str, html: str = None) -> str:
    """Fetch recent post images + captions and analyze with Gemini Vision."""
    try:
        import google.generativeai as genai
        import os

        api_key = os.getenv("GOOGLE_AI_API_KEY")
        if not api_key:
            logger.warning(f"  ❌ GOOGLE_AI_API_KEY not set, skipping vision")
            return ''

        # Step 1: Find post URLs
        logger.info(f"  Step 1: Finding post URLs...")
        post_urls = await _get_post_urls_from_html(html, username)
        logger.info(f"    From HTML shortcodes: {len(post_urls)} posts found")
        for u in post_urls[:3]:
            logger.info(f"      {u}")

        if len(post_urls) < 3:
            logger.info(f"    Not enough from HTML, trying Google...")
            google_urls = await _get_post_urls_from_google(username, platform)
            logger.info(f"    From Google: {len(google_urls)} posts found")
            seen = set(post_urls)
            for u in google_urls:
                if u not in seen:
                    post_urls.append(u)
                    seen.add(u)
        post_urls = post_urls[:6]
        logger.info(f"    Total post URLs: {len(post_urls)}")

        if not post_urls:
            logger.info(f"  ❌ No post URLs found, cannot do vision analysis")
            return ''

        # Step 2: Fetch og:image + caption from each post
        logger.info(f"  Step 2: Fetching og:image + captions from {len(post_urls)} posts...")
        tasks = [_fetch_post_image_and_caption(u) for u in post_urls]
        results = await asyncio.gather(*tasks)
        posts = [r for r in results if r]
        logger.info(f"    Successfully fetched: {len(posts)}/{len(post_urls)} posts")
        for i, p in enumerate(posts[:3]):
            logger.info(f"      post[{i}]: image={'yes' if p.get('image_url') else 'no'}, caption='{(p.get('caption',''))[:60]}'")

        if not posts:
            logger.info(f"  ❌ No post images could be fetched")
            return ''

        # Step 3: Download up to 3 images
        logger.info(f"  Step 3: Downloading up to 3 post images...")
        image_parts = []
        captions = []
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
                        logger.info(f"    image[{j}]: ✅ downloaded {len(resp.content)} bytes ({ct})")
                    else:
                        logger.info(f"    image[{j}]: ⚠️ HTTP {resp.status_code}, size={len(resp.content)}")
                except Exception as e:
                    logger.info(f"    image[{j}]: ❌ download failed: {e}")

        if not image_parts:
            logger.info(f"  ❌ No images downloaded successfully")
            return ''

        logger.info(f"  Step 4: Sending {len(image_parts)} images + {len(captions)} captions to Gemini Vision...")

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


def _extract_logo(soup: BeautifulSoup, base_url: str) -> str:
    """Finds website logo"""
    # Search in different places
    logo = (
        soup.find('img', class_=re.compile('logo', re.I)) or
        soup.find('img', id=re.compile('logo', re.I)) or
        soup.find('img', alt=re.compile('logo', re.I))
    )
    
    if logo and logo.get('src'):
        return urljoin(base_url, logo['src'])
    
    # Search in meta
    meta_logo = soup.find('meta', attrs={'property': 'og:image'})
    if meta_logo and meta_logo.get('content'):
        return urljoin(base_url, meta_logo['content'])
    
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

