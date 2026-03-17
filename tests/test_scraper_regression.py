"""
Scraper regression tests — validates that scrape_website() returns
meaningful data for a configurable list of URLs.

Run:  pytest tests/test_scraper_regression.py -v -s
The -s flag prints all logs to stdout so you see full scraper output.
"""
import json
import sys
import os
import asyncio
import logging
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.scraper import scrape_website

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s: %(message)s")
logger = logging.getLogger("scraper_regression")

URLS_FILE = Path(__file__).parent / "scraper_urls.json"


def _load_urls():
    with open(URLS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


TEST_URLS = _load_urls()


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.mark.parametrize("entry", TEST_URLS, ids=[e["label"] for e in TEST_URLS])
@pytest.mark.asyncio
async def test_scrape_url(entry):
    url = entry["url"]
    label = entry["label"]

    logger.info("=" * 60)
    logger.info(f"🧪 TESTING: {label}")
    logger.info(f"   URL: {url}")
    logger.info("=" * 60)

    result = await scrape_website(url)

    logger.info("-" * 40)
    logger.info(f"📋 RESULTS for {label}:")
    logger.info(f"   title:       '{result.get('title', '')[:80]}'")
    logger.info(f"   description: '{result.get('description', '')[:120]}'")
    logger.info(f"   content len: {len(result.get('content', ''))}")
    logger.info(f"   colors:      {result.get('colors', [])}")
    logger.info(f"   logo_url:    {'yes' if result.get('logo_url') else 'no'}")
    logger.info(f"   brand_voice: {result.get('brand_voice', '')}")
    logger.info(f"   products:    {len(result.get('products', []))} items")
    logger.info(f"   key_features:{len(result.get('key_features', []))} items")
    logger.info(f"   industry:    '{result.get('industry', '')}'")
    logger.info("-" * 40)

    if entry.get("expect_title"):
        title = result.get("title", "")
        assert title and len(title) > 1, f"[{label}] title is empty or too short: '{title}'"
        logger.info(f"   ✅ title OK")

    if entry.get("expect_description"):
        desc = result.get("description", "")
        assert desc and len(desc) > 5, f"[{label}] description is empty or too short: '{desc}'"
        generic_markers = ["login", "log in", "sign up", "create an account"]
        desc_lower = desc.lower()
        is_generic = any(m in desc_lower for m in generic_markers) and len(desc) < 100
        assert not is_generic, f"[{label}] description looks generic (login page?): '{desc[:100]}'"
        logger.info(f"   ✅ description OK")

    min_len = entry.get("min_content_length", 0)
    if min_len > 0:
        content = result.get("content", "")
        assert len(content) >= min_len, f"[{label}] content too short: {len(content)} < {min_len}"
        logger.info(f"   ✅ content length OK ({len(content)} >= {min_len})")

    logger.info(f"🎉 PASSED: {label}")
