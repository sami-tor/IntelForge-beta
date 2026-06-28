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

query = 'ransomware'
url = f'{SEARCH_URL}?q={urllib.parse.quote(query)}&{token_field}={token}'
print('Request URL (first 120 chars):', url[:120])

req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='replace')
        print('HTTP Status:', resp.status)
        print('HTML length:', len(html))

        # Find onion URLs
        pattern = r'http://[a-z2-7]{16,56}\.onion[^\s<>"\']*'
        onions = re.findall(pattern, html, re.IGNORECASE)
        seen = []
        for o in onions:
            clean = o.rstrip('/').split('?')[0].split('#')[0]
            if clean not in seen:
                seen.append(clean)

        print('Unique onion URLs found:', len(seen))
        for o in seen[:8]:
            print(' ', o)

        if len(seen) == 0:
            print('No onion URLs found. Checking page content...')
            # Check if we got a redirect or token error
            if 'Bad request' in html or 'token' in html.lower():
                print('Token may have been rejected')
            elif 'rate' in html.lower():
                print('Rate limit hit')
            print('HTML snippet:', html[500:800])

except Exception as e:
    print('Error:', type(e).__name__, str(e))
