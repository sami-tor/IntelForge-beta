"""
Debug - use HTML Accept for homepage, then switch for API
"""
import requests
import json
import re

session = requests.Session()

# Step 1: Get homepage with HTML accept
print("Step 1: Fetching homepage...")
homepage_headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

resp = session.get('https://www.threads.net/', headers=homepage_headers, timeout=30)
print(f"Status: {resp.status_code}")
print(f"Cookies: {dict(session.cookies)}")

# Extract LSD
lsd_match = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', resp.text)
if not lsd_match:
    # Try alternative pattern
    lsd_match = re.search(r'"token":"([^"]+)".*?"LSD"', resp.text)
if not lsd_match:
    # Search in script tags
    print("Searching for LSD in different patterns...")
    print(f"Response has 'LSD': {'LSD' in resp.text}")
    print(f"Response has 'token': {'token' in resp.text}")
    # Print around LSD
    idx = resp.text.find('LSD')
    if idx > 0:
        print(f"Context around LSD: {resp.text[idx-50:idx+100]}")
    exit(1)

lsd = lsd_match.group(1)
print(f"LSD token: {lsd}")

csrf = session.cookies.get('csrftoken', '')
print(f"CSRF: {csrf}")

# Step 2: Call GraphQL with XHR-like headers
print("\nStep 2: Calling GraphQL...")

api_headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-FB-LSD': lsd,
    'X-IG-App-ID': '238260118697367',
    'X-CSRFToken': csrf,
    'Origin': 'https://www.threads.net',
    'Referer': 'https://www.threads.net/@arzanyaaann',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
}

data = {
    'lsd': lsd,
    'variables': json.dumps({'userID': '63437026463'}),
    'doc_id': '6232751443445612',
}

resp = session.post('https://www.threads.net/api/graphql', headers=api_headers, data=data, timeout=30)

print(f"Status: {resp.status_code}")
print(f"Length: {len(resp.text)}")
print(f"Content-Type: {resp.headers.get('content-type')}")
print(f"First 300 chars: {resp.text[:300]}")

# Check for JSON
if resp.text.startswith('{'):
    print("\nStarts with { - trying JSON parse...")
    result = resp.json()
    print("JSON OK!")
elif resp.text.startswith('for (;;);'):
    print("\nHas for(;;) prefix - stripping...")
    result = json.loads(resp.text[9:])
    print("JSON OK after strip!")
else:
    print("\nNot JSON - it's HTML")
