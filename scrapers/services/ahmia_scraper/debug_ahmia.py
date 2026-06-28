import sys, time, hashlib, hmac, urllib.request, urllib.parse, re

AHMIA_SALT = 'ahmia-is-not-for-bad-use'
SEARCH_URL = 'https://ahmia.fi/search/'
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

def compute_token():
    minute = int(time.time() // 60)
    return hmac.new(AHMIA_SALT.encode(), str(minute).encode(), hashlib.sha256).hexdigest()[:6].lower()

token = compute_token()
minute = int(time.time() // 60)
token_field = ['q_csrf_token', 'csrf_token'][minute % 2]

print(f"Minute: {minute}, Field: {token_field}, Token: {token}")

# Try a few queries
for query in ['ransomware', 'data breach', 'cyber']:
    url = f'{SEARCH_URL}?q={urllib.parse.quote(query)}&{token_field}={token}'
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
            print(f'\n=== Query: {query} | Status: {resp.status} | HTML: {len(html)} bytes ===')

            # Print first 2000 chars of HTML to see structure
            print(html[:2000])

    except Exception as e:
        print(f'Error for {query}: {e}')

    time.sleep(1)
