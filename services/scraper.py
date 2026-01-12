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
    
    # Headers to bypass bot detection
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        html = response.text
    
    logger.info(f"🔍 Scraped {url} → Status: {response.status_code}, Size: {len(html)} bytes")
    
    # Check if we got valid content
    if response.status_code != 200:
        raise ValueError(f"Failed to fetch website: HTTP {response.status_code}")
    
    if len(html) < 500:
        raise ValueError(f"Website returned too little content ({len(html)} bytes)")
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Extract main information
    title = _extract_title(soup)
    description = _extract_description(soup)
    content = _extract_main_content(soup)
    
    logger.info(f"📄 Extracted - Title: '{title[:80]}'")
    logger.info(f"📄 Description: '{description[:100]}'")
    logger.info(f"📄 Content preview: '{content[:150]}...'")
    
    data = {
        "url": url,
        "title": title,
        "description": description,
        "content": content,
        "colors": await _extract_colors(soup, url),
        "logo_url": _extract_logo(soup, url),
        "brand_voice": _analyze_brand_voice(soup),
        "products": _extract_products(soup),
        "key_features": _extract_key_features(soup)
    }
    
    return data


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
    """Extracts website color palette"""
    colors = []
    
    # Find CSS color variables
    for style_tag in soup.find_all('style'):
        content = style_tag.string
        if content:
            color_matches = re.findall(r'#(?:[0-9a-fA-F]{3}){1,2}', content)
            colors.extend(color_matches[:5])
    
    # Extract inline styles
    for tag in soup.find_all(style=True):
        style = tag['style']
        color_matches = re.findall(r'#(?:[0-9a-fA-F]{3}){1,2}', style)
        colors.extend(color_matches)
    
    # Remove duplicates and limit
    unique_colors = list(dict.fromkeys(colors))
    return unique_colors[:5] if unique_colors else ["#1877f2", "#000000"]


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
    """Extracts product/service information"""
    products = []
    
    # Find structured data
    product_tags = soup.find_all(['h2', 'h3'], string=re.compile('product|service', re.I))
    
    for tag in product_tags[:5]:
        products.append(tag.get_text().strip())
    
    return products


def _extract_key_features(soup: BeautifulSoup) -> List[str]:
    """Extracts key features/benefits"""
    features = []
    
    # Find benefit lists
    feature_lists = soup.find_all(['ul', 'ol'])
    
    for ul in feature_lists[:3]:
        items = ul.find_all('li')
        for item in items[:3]:
            text = item.get_text().strip()
            if len(text) < 100 and len(text) > 10:
                features.append(text)
    
    return features[:5]

