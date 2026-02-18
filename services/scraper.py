import httpx
from bs4 import BeautifulSoup
from typing import Dict, List
import re
from urllib.parse import urljoin, urlparse
import colorthief
import io
import base64
import logging

logger = logging.getLogger(__name__)


async def scrape_website(url: str) -> Dict:
    """Analyzes website and extracts brand information"""
    
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

