# ================================================
# IntelForge - Ahmia Dark Web Scraper (Playwright)
# Uses headless Chromium to render JavaScript results
# ================================================

import time
import hashlib
import logging
import re
import os
from typing import List, Dict

logger = logging.getLogger(__name__)

AHMIA_SALT = "ahmia-is-not-for-bad-use"
BASE_URL = "https://ahmia.fi"
SEARCH_URL = f"{BASE_URL}/search/"
HEADLESS_URL = "https://ahmia.fi/ahmiafi.onion/"


def compute_token(minute_offset=0):
    minute = int(time.time() // 60) + minute_offset
    raw = f"{AHMIA_SALT}:{minute}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:6]


def get_token_field(minute_offset=0):
    target_minute = int(time.time() // 60) + minute_offset
    return ["q_csrf_token", "csrf_token"][target_minute % 2]


def scrape_with_playwright(query: str, max_pages: int = 3) -> List[Dict]:
    """
    Use Playwright headless browser to scrape Ahmia.
    Returns list of onion entries with url, domain, title, description.
    """
    from playwright.sync_api import sync_playwright

    all_onions = []

    with sync_playwright() as p:
        # Launch headless Chromium with Tor-like headers
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="en-US",
            timezone_id="UTC",
            viewport={"width": 1920, "height": 1080},
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            }
        )

        page = context.new_page()

        for page_num in range(max_pages):
            token = compute_token(page_num)
            token_field = get_token_field(page_num)
            params = f"q={query}&{token_field}={token}&page={page_num}"
            url = f"{SEARCH_URL}?{params}"

            logger.info(f"  Loading page {page_num + 1}: {url[:80]}...")

            try:
                response = page.goto(url, timeout=30000, wait_until="networkidle")
                if response is None or response.status != 200:
                    logger.warning(f"  Page {page_num + 1}: no valid response")
                    break

                # Wait for search results to render (JavaScript loads them)
                # Look for the results container or onion links
                try:
                    page.wait_for_selector("a[href*='.onion']", timeout=8000)
                except Exception:
                    logger.warning(f"  Page {page_num + 1}: no onion links found after waiting")
                    # Check if we got a blank page or warning
                    page_content = page.content()
                    if "notTorBrowserWarning" in page_content or "man-in-the-middle" in page_content:
                        logger.warning(f"  Page {page_num + 1}: anti-bot warning detected")
                    break

                # Wait a bit more for any lazy-loaded results
                page.wait_for_timeout(2000)

                # Extract .onion URLs from the rendered page
                onion_links = page.query_selector_all("a[href*='.onion']")
                logger.info(f"  Page {page_num + 1}: found {len(onion_links)} onion links")

                if not onion_links:
                    break

                for link in onion_links:
                    href = link.get_attribute("href") or ""
                    if not href.startswith("http://") or ".onion" not in href:
                        continue

                    # Clean URL
                    url_clean = href.rstrip("/").split("?")[0].split("#")[0].strip()

                    # Get title from the link text
                    title = (link.inner_text() or "").strip()[:200]
                    if not title or title == url_clean:
                        # Try parent container for context
                        try:
                            parent = link.evaluate_handle(
                                "el => el.closest('li, .result, .search-result, div')"
                            )
                            if parent:
                                parent_text = parent.inner_text()[:200] if parent else ""
                                title = parent_text.split("\n")[0][:200] if parent_text else title
                        except Exception:
                            pass

                    # Get description from nearby paragraph
                    description = ""
                    try:
                        desc_el = page.query_selector(f"a[href='{href}'] ~ p, a[href='{href}'] + p")
                        if desc_el:
                            description = desc_el.inner_text()[:300].strip()
                    except Exception:
                        pass

                    domain = url_clean.replace("http://", "").split(".onion")[0] + ".onion"

                    all_onions.append({
                        "url": url_clean,
                        "domain": domain,
                        "title": title[:200] if title else "",
                        "description": description[:300] if description else "",
                        "source": "ahmia",
                        "query_used": query,
                    })

                # Check if there's a next page
                next_button = page.query_selector("a.next, .pagination a:last-child")
                if not next_button or len(onion_links) < 10:
                    break

                time.sleep(2)  # Be polite between pages

            except Exception as e:
                logger.error(f"  Page {page_num + 1} error: {e}")
                break

        browser.close()

    # Deduplicate by URL
    seen = {}
    for onion in all_onions:
        if onion["url"] not in seen:
            seen[onion["url"]] = onion
    return list(seen.values())


def test_playwright():
    """Quick test with 'ransomware' query"""
    logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s')

    print("Testing Playwright scraper with 'ransomware' query...")
    results = scrape_with_playwright("ransomware", max_pages=1)

    print(f"\nResults: {len(results)} unique .onion URLs found")
    for r in results[:5]:
        print(f"  URL: {r['url']}")
        print(f"  Title: {r['title'][:80]}")
        print(f"  Description: {r['description'][:80]}")
        print()


if __name__ == "__main__":
    test_playwright()
