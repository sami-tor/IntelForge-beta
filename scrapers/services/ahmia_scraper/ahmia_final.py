# ================================================================
# IntelForge - Ahmia Dark Web Scraper (Production Version)
# ================================================================
#
# LIMITATION DISCOVERED AFTER EXTENSIVE TESTING:
#   Ahmia.fi uses a CSS-based anti-bot that detects non-Tor browsers.
#   The token bypass (HTTP 200) works, but search results are
#   JavaScript-rendered AND blocked by CSS overlay for non-Tor IPs.
#
#   - Token computation: WORKS (confirmed: HTTP 200 from all offsets)
#   - JavaScript rendering: REQUIRED (no server-side fallback)
#   - Tor browser detection: BLOCKS (CSS overlay on non-Tor IPs)
#   - Headless Chromium: DETECTED (only returns warning page)
#
# SOLUTION OPTIONS:
#   1. Tor SOCKS proxy (recommended) — routes requests through Tor
#   2. Residential proxy — makes requests appear to come from real browsers
#   3. Pre-scraped datasets — use onion-scan / darkweb-sites datasets
#
# SETUP FOR OPTIMAL RESULTS:
#   Install Tor:   pip installpysocks  (or use system Tor)
#   Then run:      tor  (or connect to existing Tor daemon on 9050)
#   The scraper will auto-detect Tor proxy at SOCKS5://127.0.0.1:9050
#
# ================================================================

import re
import time
import hashlib
import logging
import os
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import List, Dict, Optional

# Optional: try to import psycopg2 for DB
try:
    import psycopg2
    HAS_PG = True
except ImportError:
    HAS_PG = False

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [ahmia] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# ---- Token computation (verified from Ahmia GitHub source) ----

AHMIA_SALT = "ahmia-is-not-for-bad-use"
BASE_URL = "https://ahmia.fi"
SEARCH_URL = f"{BASE_URL}/search/"
TOR_PROXY = "socks5://127.0.0.1:9050"  # Default Tor daemon

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "intelforge"),
    "user": os.getenv("POSTGRES_USER", "intelforge"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}


def compute_token(minute_offset: int = 0) -> str:
    """Compute Ahmia's 6-char rolling token. SHA1(SALT:minute)[:6]"""
    minute = int(time.time() // 60) + minute_offset
    raw = f"{AHMIA_SALT}:{minute}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:6]


def get_token_field(minute_offset: int = 0) -> str:
    """Get the token field name for a specific minute offset"""
    target_minute = int(time.time() // 60) + minute_offset
    return ["q_csrf_token", "csrf_token"][target_minute % 2]


# ---- DB operations ----

def get_db_conn():
    if not HAS_PG:
        return None
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
        return None


def init_ahmia_table() -> bool:
    conn = get_db_conn()
    if not conn:
        return False
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ahmia_scraped_onions (
                id SERIAL PRIMARY KEY,
                onion_url VARCHAR(500) UNIQUE NOT NULL,
                domain VARCHAR(255) NOT NULL,
                title TEXT,
                description TEXT,
                query_used VARCHAR(255),
                discovered_at TIMESTAMP DEFAULT NOW(),
                last_seen TIMESTAMP DEFAULT NOW(),
                scrape_count INTEGER DEFAULT 1
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ahmia_domain ON ahmia_scraped_onions(domain)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ahmia_last_seen ON ahmia_scraped_onions(last_seen DESC)")
        conn.commit()
        cur.close()
        conn.close()
        logger.info("Ahmia table initialized")
        return True
    except Exception as e:
        logger.error(f"Failed to init ahmia table: {e}")
        return False


def store_onions(onions: List[Dict]) -> int:
    conn = get_db_conn()
    if not conn:
        return 0
    stored = 0
    try:
        cur = conn.cursor()
        for entry in onions:
            cur.execute("""
                INSERT INTO ahmia_scraped_onions
                    (onion_url, domain, title, description, query_used, last_seen, scrape_count)
                VALUES (%s,%s,%s,%s,%s,NOW(),1)
                ON CONFLICT (onion_url) DO UPDATE SET
                    last_seen = NOW(),
                    scrape_count = ahmia_scraped_onions.scrape_count + 1,
                    title = COALESCE(NULLIF(EXCLUDED.title,''), ahmia_scraped_onions.title),
                    description = COALESCE(NULLIF(EXCLUDED.description,''), ahmia_scraped_onions.description)
            """, (entry["url"], entry["domain"], entry.get("title",""),
                  entry.get("description",""), entry.get("query_used","")))
            stored += 1
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to store onions: {e}")
    return stored


# ---- HTTP-based scraper (token bypass, no JS rendering) ----

def build_search_url(query: str, page: int = 0) -> str:
    """Build search URL with token bypass"""
    token = compute_token(0)
    token_field = get_token_field(0)
    params = {"q": query, token_field: token, "page": page}
    return f"{SEARCH_URL}?{urllib.parse.urlencode(params)}"


def fetch_page_http(query: str, page: int = 0) -> Optional[str]:
    """Fetch Ahmia page using HTTP (no JS rendering)"""
    import urllib.request, urllib.parse, urllib.error

    url = build_search_url(query, page)
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    })

    # Try Tor proxy if available
    try:
        import socks
        proxy = urllib.request.ProxyHandler({
            "http": TOR_PROXY,
            "https": TOR_PROXY,
        })
        opener = urllib.request.build_opener(proxy)
        with opener.open(req, timeout=20) as resp:
            return resp.read().decode("utf-8", errors="replace"), resp.status
    except (ImportError, Exception) as e:
        # No Tor, try direct
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return resp.read().decode("utf-8", errors="replace"), resp.status
        except Exception:
            return None, -1


def parse_onion_results(html: str, query: str) -> List[Dict]:
    """Parse .onion URLs from HTML"""
    if not html:
        return []

    onion_pattern = re.compile(r"http://[a-z2-7]{16,56}\.onion[^\s<>\"\')\]]*", re.IGNORECASE)
    found = {}

    for match in onion_pattern.finditer(html):
        url = match.group(0).rstrip("/").split("?")[0].split("#")[0].strip()
        if url in found:
            continue

        domain = re.sub(r"^http://", "", url).split("/")[0]
        title = ""
        description = ""

        # Try to extract title/description near the URL
        idx = html.find(url)
        if idx > 0:
            snippet = html[max(0, idx - 500):idx + 600]
            title_match = re.search(r"<b[^>]*>([^<]{3,150})</b>", snippet, re.IGNORECASE)
            if title_match:
                title = re.sub(r"<[^>]+>", "", title_match.group(1)).strip()[:200]

        found[url] = {
            "url": url,
            "domain": domain,
            "title": title,
            "description": description,
            "source": "ahmia",
            "query_used": query,
        }

    return list(found.values())


def is_warning_page(html: str) -> bool:
    """Check if we got the anti-bot warning page instead of results"""
    if not html:
        return True
    # The warning page is ~4.7KB with a fixed pattern
    if len(html) < 5000 and ("notTorBrowserWarning" in html or "man-in-the-middle" in html):
        return True
    # Check if actual search results are present
    if "result" in html.lower() or "search_result" in html.lower():
        return False
    # Check for onion links beyond just Ahmia's own
    onions = re.findall(r"http://[a-z2-7]{16,56}\.onion", html, re.IGNORECASE)
    if len(onions) <= 1:  # Only Ahmia's own onion = warning page
        return True
    return False


# ---- Playwright-based scraper (JS rendering) ----

def scrape_with_playwright(query: str, max_pages: int = 3,
                           tor_proxy: Optional[str] = None) -> List[Dict]:
    """
    Use Playwright headless browser to scrape Ahmia.
    If tor_proxy is provided, route through Tor SOCKS proxy.
    Returns list of onion entries.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.error("Playwright not installed. Run: pip install playwright && python -m playwright install chromium")
        return []

    all_onions = []

    with sync_playwright() as p:
        browser_kwargs = {"headless": True}

        # Configure proxy if provided
        if tor_proxy:
            browser_kwargs["proxy"] = {"server": tor_proxy, "type": "socks5"}

        browser = p.chromium.launch(**browser_kwargs)
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

            logger.info(f"  Loading page {page_num + 1}...")

            try:
                response = page.goto(url, timeout=30000, wait_until="networkidle")
                if response is None or response.status != 200:
                    logger.warning(f"  Page {page_num + 1}: no valid response")
                    break

                # Wait for search results to render
                page.wait_for_timeout(3000)

                # Extract .onion URLs from rendered page
                onion_links = page.query_selector_all("a[href*='.onion']")

                if not onion_links:
                    logger.warning(f"  Page {page_num + 1}: no onion links found")
                    break

                logger.info(f"  Page {page_num + 1}: found {len(onion_links)} onion links")

                for link in onion_links:
                    href = link.get_attribute("href") or ""
                    if not href.startswith("http://") or ".onion" not in href:
                        continue

                    url_clean = href.rstrip("/").split("?")[0].split("#")[0].strip()
                    title = (link.inner_text() or "").strip()[:200]
                    if not title or title == url_clean:
                        title = f" onion site"

                    domain = url_clean.replace("http://", "").split(".onion")[0] + ".onion"

                    all_onions.append({
                        "url": url_clean,
                        "domain": domain,
                        "title": title,
                        "description": "",
                        "source": "ahmia",
                        "query_used": query,
                    })

                if len(onion_links) < 10:
                    break

                time.sleep(2)

            except Exception as e:
                logger.error(f"  Page {page_num + 1} error: {e}")
                break

        browser.close()

    # Deduplicate
    seen = {}
    for onion in all_onions:
        if onion["url"] not in seen:
            seen[onion["url"]] = onion
    return list(seen.values())


# ---- Main scraper orchestration ----

SCRAPE_QUERIES = [
    "ransomware", "data leak", "cyber attack", "dark web marketplace",
    "hacking forum", "stolen data", "breach database", "malware download",
    "credential dump", "phishing kit", "exploit kit", "zero-day",
    "targeted attack", "apt", "data breach", "private data",
]


def detect_tor() -> bool:
    """Check if Tor daemon is running"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect(("127.0.0.1", 9050))
        s.close()
        return True
    except Exception:
        return False


def run_scrape(queries: Optional[List[str]] = None, use_playwright: bool = True):
    """
    Run the full Ahmia scraper.

    If Tor is detected (SOCKS5 on port 9050), uses Tor proxy for requests.
    Otherwise falls back to direct connection.

    Args:
        queries: List of search queries (default: SCRAPE_QUERIES)
        use_playwright: Use Playwright for JS rendering (recommended, requires installation)
    """
    if queries is None:
        queries = SCRAPE_QUERIES

    if not init_ahmia_table():
        logger.error("Cannot initialize DB - will continue without DB storage")

    tor_available = detect_tor()
    if tor_available:
        logger.info("Tor daemon detected on port 9050 - using Tor SOCKS proxy")
        proxy = TOR_PROXY
    else:
        logger.warning("Tor NOT detected on port 9050 - using direct connection (results may be limited)")
        proxy = None

    total_found = 0
    total_stored = 0
    results_by_query = {}

    logger.info(f"Ahmia scraper starting — {len(queries)} queries (playwright={use_playwright})")

    for query in queries:
        logger.info(f"Query: '{query}'")

        if use_playwright:
            onions = scrape_with_playwright(query, max_pages=3, tor_proxy=proxy)
        else:
            # HTTP-based fallback (limited - no JS rendering)
            html, status = fetch_page_http(query)
            if is_warning_page(html):
                logger.warning(f"  Warning page detected - results may be incomplete (Tor recommended)")
                onions = parse_onion_results(html or "", query)
            else:
                onions = parse_onion_results(html or "", query)

        results_by_query[query] = len(onions)
        total_found += len(onions)

        if onions:
            stored = store_onions(onions)
            total_stored += stored
            logger.info(f"  Found {len(onions)} | Stored {stored}")
        else:
            logger.info(f"  No results found")

        time.sleep(2)

    logger.info(f"Done! Found: {total_found} | Stored: {total_stored}")
    return {
        "found": total_found,
        "stored": total_stored,
        "by_query": results_by_query,
        "tor_used": tor_available,
        "playwright_used": use_playwright,
    }


# ---- CLI ----

if __name__ == "__main__":
    queries = sys.argv[1:] if len(sys.argv) > 1 else None
    use_pw = "--http" not in sys.argv
    result = run_scrape(queries, use_playwright=use_pw)
    print(f"\nSummary:")
    print(f"  Tor proxy used: {result['tor_used']}")
    print(f"  Playwright used: {result['playwright_used']}")
    print(f"  Total found: {result['found']}")
    print(f"  Total stored: {result['stored']}")
    for q, n in result["by_query"].items():
        print(f"  {q}: {n} onion URLs")
