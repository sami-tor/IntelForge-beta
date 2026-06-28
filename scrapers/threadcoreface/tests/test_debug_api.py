"""
Debug the GraphQL API call to see what's different
"""
import requests
import json
import re

# Create fresh session
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
})

# Step 1: Get homepage to get cookies and LSD token
print("Step 1: Fetching homepage...")
resp = session.get('https://www.threads.net/', timeout=30)
print(f"Status: {resp.status_code}")
print(f"Cookies after homepage: {dict(session.cookies)}")

# Extract LSD
lsd_match = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', resp.text)
if not lsd_match:
    print("ERROR: No LSD token found!")
    exit(1)
lsd = lsd_match.group(1)
print(f"LSD token: {lsd[:20]}...")

# Step 2: Call GraphQL API
print("\nStep 2: Calling GraphQL API...")

api_url = 'https://www.threads.net/api/graphql'
user_id = '63437026463'  # bellame.10

headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-FB-LSD': lsd,
    'X-IG-App-ID': '238260118697367',
    'Origin': 'https://www.threads.net',
    'Referer': 'https://www.threads.net/',
}

data = {
    'lsd': lsd,
    'variables': json.dumps({'userID': user_id}),
    'doc_id': '6232751443445612',
}

print(f"Request headers: {headers}")
print(f"Request data: {data}")
print(f"Cookies being sent: {dict(session.cookies)}")

resp = session.post(api_url, headers=headers, data=data, timeout=30)

print(f"\nResponse status: {resp.status_code}")
print(f"Response length: {len(resp.text)}")
print(f"First 500 chars: {resp.text[:500]}")

# Try to parse JSON
try:
    result = resp.json()
    print("\nJSON PARSED OK!")
    threads = result.get('data', {}).get('mediaData', {}).get('threads', [])
    print(f"Found {len(threads)} threads")
except Exception as e:
    print(f"\nJSON PARSE FAILED: {e}")
    print("Response is HTML, not JSON")
