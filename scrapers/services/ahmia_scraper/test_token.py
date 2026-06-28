import sys, time, hashlib
sys.path.insert(0, '.')

# Verify token formula
AHMIA_SALT = "ahmia-is-not-for-bad-use"

def compute_token(minute_offset=0):
    minute = int(time.time() // 60) + minute_offset
    raw = f"{AHMIA_SALT}:{minute}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:6]

print(f"Current minute: {int(time.time() // 60)}")
print(f"Token field: {['q_csrf_token','csrf_token'][int(time.time()//60)%2]}")
print(f"Token now: {compute_token()}")
print()

# Verify rolling window (show 5 minutes of tokens)
print("Rolling tokens (prev 5 to next 2):")
for i in range(-5, 3):
    print(f"  offset {i:+d}: {compute_token(i)}")

print()
print("Testing query...")

import urllib.request, urllib.parse, re

SEARCH_URL = "https://ahmia.fi/search/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

token = compute_token()
token_field = ["q_csrf_token", "csrf_token"][int(time.time() // 60) % 2]
query = "ransomware"
url = f"{SEARCH_URL}?q={urllib.parse.quote(query)}&{token_field}={token}"

req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
with urllib.request.urlopen(req, timeout=15) as resp:
    html = resp.read().decode("utf-8", errors="replace")
    print(f"HTTP Status: {resp.status}")
    print(f"HTML length: {len(html)} bytes")

ONION_PATTERN = re.compile(r'http://[a-z2-7]{16,56}\.onion[^\s<>"\')\]]*', re.IGNORECASE)
onions = list({m.group(0).rstrip("/").split("?")[0]: None for m in ONION_PATTERN.finditer(html)}.keys())
print(f"Unique onion URLs: {len(onions)}")
for o in onions[:10]:
    print(f"  {o}")
