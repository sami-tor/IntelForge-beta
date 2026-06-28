"""Quick end-to-end test of Ahmia scraper."""
import sys, time
sys.path.insert(0, '.')

from ahmia import (
    compute_token, get_token_field_for_minute,
    fetch_with_retry, is_search_page, parse_onion_results,
    SCRAPE_QUERIES, run_ahmia_scrape
)

print("=== Ahmia Scraper Verification ===")
print(f"Current minute: {int(time.time() // 60)}")
print()

# Show rolling tokens
print("Rolling tokens (prev 8 to current):")
for i in range(-8, 1):
    t = compute_token(i)
    f = get_token_field_for_minute(i)
    print(f"  {i:+3d} min: field={f:15s} token={t}")

print()

# Test a single query
print("Testing single query: 'ransomware'")
html, status = fetch_with_retry("ransomware", page=0, max_offsets=8)
if html:
    print(f"  Status: {status}, HTML length: {len(html)} bytes")
    print(f"  Is search page: {is_search_page(html)}")
    onions = parse_onion_results(html, "ransomware")
    print(f"  Onion URLs found: {len(onions)}")
    for o in onions[:5]:
        print(f"    {o['domain']}: {o['title'][:60]}")
else:
    print(f"  Failed (status: {status})")

print()

# Test DB table initialization
print("Testing DB initialization...")
from ahmia import init_ahmia_table, get_db_conn
conn = get_db_conn()
if conn:
    print("  DB connection: OK")
    init_ahmia_table()
    conn.close()
else:
    print("  DB connection: FAILED (Docker not running?)")

print()
print("=== Full scrape test (3 queries) ===")
result = run_ahmia_scrape(queries=["ransomware", "data breach", "malware"])
print(f"Result: found={result['found']}, stored={result['stored']}")
