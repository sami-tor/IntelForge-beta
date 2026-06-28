# ================================================
# IntelForge - Ahmia Dark Web Scraper
# Searches https://ahmia.fi/ for indexed .onion sites
# Defensive OSINT only — all results stored locally
# ================================================
#
# HOW IT WORKS:
# Ahmia uses Django + Elasticsearch with a rolling 6-char CSRF token.
# Token formula (from their public GitHub source):
#   token = SHA1(SALT + ":" + current_unix_minute)[:6]
# We compute it locally using the public SALT, then bypass their
# anti-bot check without needing a headless browser.
# ================================================

import re
import time
import hashlib
import logging
import urllib.request
import urllib.parse
import urllib.error
import os

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [ahmia] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Ahmia's public SALT (from their GitHub repo: ahmia/example.env)
AHMIA_SALT = "ahmia-is-not-for-bad-use"

BASE_URL = "https://ahmia.fi"
SEARCH_URL = f"{BASE_URL}/search/"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
TIMEOUT_SECONDS = 20

DB_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "intelforge"),
    "user": os.getenv("POSTGRES_USER", "intelforge"),
    "password": os.getenv("POSTGRES_PASSWORD", ""),
}

# ---- Token computation (verified from Ahmia source) ----

def compute_token(minute_offset=0):
    """Compute Ahmia's 6-char rolling token. SHA1(SALT:minute)[:6]."""
    minute = int(time.time() // 60) + minute_offset
    raw = f"{AHMIA_SALT}:{minute}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:6]


def get_token_field_for_minute(minute_offset=0):
    """Get the token field name for a specific minute offset."""
    target_minute = int(time.time() // 60) + minute_offset
    return ["q_csrf_token", "csrf_token"][target_minute % 2]


# ---- Network fetching ----

def fetch_page(query, page, minute_offset):
    """Fetch Ahmia search page with token for a specific minute."""
    token = compute_token(minute_offset)
    token_field = get_token_field_for_minute(minute_offset)
    params = {"q": query, token_field: token, "page": page}
    url = f"{SEARCH_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return resp.read().decode("utf-8", errors="replace"), resp.status
    except urllib.error.HTTPError as e:
        return None, e.code
    except urllib.error.URLError as e:
        logger.error(f"URL error: {e.reason}")
        return None, -1
    except Exception as e:
        logger.error(f"Fetch error: {e}")
        return None, -1


def fetch_with_retry(query, page=0, max_offsets=8):
    """
    Try fetching with multiple recent minute offsets.
    Handles clock drift between client and Ahmia server.
    """
    for offset in range(-max_offsets, 1):
        html, status = fetch_page(query, page, minute_offset=offset)
        if status == 200 and html and is_search_page(html):
            return html, 200
        if status == 200 and html and ("Bad request" in html or "notTorBrowserWarning" in html):
            continue  # Token rejected, try next offset
    return None, -1


# ---- HTML parsing ----

ONION_PATTERN = re.compile(
    r'http://[a-z2-7]{16,56}\.onion[^\s<>"\')\]]*',
    re.IGNORECASE
)


def is_search_page(html):
    """Check if HTML contains actual search results (not just header)."""
    if not html:
        return False
    # Search results pages contain result links or onion URLs
    return bool(ONION_PATTERN.search(html)) or "search_results" in html


def parse_onion_results(html, query):
    """Extract all .onion URLs from Ahmia search HTML."""
    if not html:
        return []
    found = {}
    for match in ONION_PATTERN.finditer(html):
        url = match.group(0)
        url = url.rstrip("/").split("?")[0].split("#")[0].split("&")[0].strip()
        if url in found:
            continue
        try:
            domain = urllib.parse.urlparse(url).netloc
        except Exception:
            domain = url
        found[url] = {"url": url, "domain": domain}

    results = []
    for url, entry in found.items():
        results.append({
            "url": url,
            "domain": entry["domain"],
            "title": extract_title(html, url),
            "description": extract_description(html, url),
            "source": "ahmia",
            "query_used": query,
        })
    return results


def extract_title(html, url):
    """Extract title text near a .onion URL in HTML."""
    idx = html.find(url)
    if idx == -1:
        return ""
    snippet = html[idx: idx + 600]
    title_match = re.search(r'<b[^>]*>([^<]{3,150})</b>', snippet, re.IGNORECASE)
    if title_match:
        return re.sub(r'<[^>]+>', "", title_match.group(1)).strip()[:200]
    before = html[max(0, idx - 300): idx]
    text_match = re.search(r'<p[^>]*>([^<]+)<', before, re.IGNORECASE | re.DOTALL)
    if text_match:
        return re.sub(r'<[^>]+>', "", text_match.group(1)).strip()[:200]
    return ""


def extract_description(html, url):
    """Extract description text near a .onion URL."""
    idx = html.find(url)
    if idx == -1:
        return ""
    snippet = html[idx: idx + 1000]
    desc_match = re.search(r'</a>(.*?)</p>', snippet, re.IGNORECASE | re.DOTALL)
    if desc_match:
        text = re.sub(r'<[^>]+>', "", desc_match.group(1)).strip()
        return text[:300] if text else ""
    return ""


# ---- DB operations ----

def get_db_conn():
    """Get PostgreSQL connection using env vars or defaults."""
    try:
        import psycopg2
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        logger.warning(f"DB connection failed: {e}")
        return None


def init_ahmia_table():
    """Ensure the ahmia_scraped_onions table exists."""
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


def store_onions(onions):
    """Upsert scraped onion entries into the database."""
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


# ---- Main scraping logic ----

SCRAPE_QUERIES = [
    "ransomware", "data leak", "cyber attack", "dark web marketplace",
    "hacking forum", "stolen data", "breach database", "malware download",
    "credential dump", "phishing kit", "exploit kit", "zero-day",
    "targeted attack", "apt", "data breach", "private data",
]


def scrape_query(query, max_pages=3):
    """Scrape Ahmia for a single query across multiple pages."""
    all_onions = []
    for page in range(max_pages):
        html, status = fetch_with_retry(query, page=page)
        if not html:
            break
        if not is_search_page(html):
            break

        onions = parse_onion_results(html, query)
        if not onions:
            break

        all_onions.extend(onions)
        logger.info(f"  Page {page+1}: found {len(onions)} onion URLs for '{query}'")
        if len(onions) < 10:
            break
        time.sleep(1.5)

    return all_onions


def run_ahmia_scrape(queries=None):
    """
    Run the full Ahmia scraper.
    Returns: {found, stored, by_query}
    """
    if queries is None:
        queries = SCRAPE_QUERIES

    if not init_ahmia_table():
        logger.error("Cannot initialize DB")

    total_found = 0
    total_stored = 0
    results_by_query = {}

    logger.info(f"Ahmia scraper starting — {len(queries)} queries")

    for query in queries:
        logger.info(f"Query: '{query}'")
        onions = scrape_query(query)
        results_by_query[query] = len(onions)
        total_found += len(onions)

        if onions:
            s = store_onions(onions)
            total_stored += s
            logger.info(f"  Stored {s}/{len(onions)} onion entries")

        time.sleep(2)

    logger.info(f"Done! Found: {total_found} | Stored: {total_stored}")
    return {"found": total_found, "stored": total_stored, "by_query": results_by_query}


# ---- CLI ----

if __name__ == "__main__":
    import sys
    queries = sys.argv[1:] if len(sys.argv) > 1 else None
    result = run_ahmia_scrape(queries)
    for q, n in result["by_query"].items():
        print(f"  {q}: {n} onion URLs")
