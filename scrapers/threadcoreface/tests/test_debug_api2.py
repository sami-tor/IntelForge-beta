"""
Debug with more complete browser headers
"""
import requests
import json
import re

session = requests.Session()

# More complete browser headers
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
})

# Step 1: Get homepage
print("Step 1: Fetching homepage...")
resp = session.get('https://www.threads.net/', timeout=30)
print(f"Status: {resp.status_code}")
print(f"Cookies: {dict(session.cookies)}")

# Extract LSD
lsd_match = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', resp.text)
if not lsd_match:
    print("ERROR: No LSD token found!")
    exit(1)
lsd = lsd_match.group(1)
print(f"LSD token: {lsd[:20]}...")

# Get csrftoken from cookies
csrf = session.cookies.get('csrftoken', '')
print(f"CSRF token: {csrf[:20]}...")

# Step 2: Call GraphQL API with all required headers
print("\nStep 2: Calling GraphQL API...")

api_url = 'https://www.threads.net/api/graphql'
user_id = '63437026463'  # bellame.10

# Full headers like browser
headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-FB-LSD': lsd,
    'X-IG-App-ID': '238260118697367',
    'X-CSRFToken': csrf,
    'X-ASBD-ID': '129477',
    'X-FB-Friendly-Name': 'BarcelonaProfileThreadsTabQuery',
    'Origin': 'https://www.threads.net',
    'Referer': 'https://www.threads.net/',
}

data = {
    'av': '0',
    '__user': '0',
    '__a': '1',
    '__req': 'b',
    '__hs': '19702.HYP:barcelona_web_pkg.2.1..0.0',
    'dpr': '1',
    '__ccg': 'EXCELLENT',
    '__rev': '1009844044',
    '__s': '',
    '__hsi': '7437841589437665371',
    '__dyn': '',
    '__csr': '',
    'fb_dtsg': '',
    'jazoest': '',
    'lsd': lsd,
    '__spin_r': '1009844044',
    '__spin_b': 'trunk',
    '__spin_t': '1732302000',
    'fb_api_caller_class': 'RelayModern',
    'fb_api_req_friendly_name': 'BarcelonaProfileThreadsTabQuery',
    'variables': json.dumps({'userID': user_id}),
    'server_timestamps': 'true',
    'doc_id': '6232751443445612',
}

resp = session.post(api_url, headers=headers, data=data, timeout=30)

print(f"\nResponse status: {resp.status_code}")
print(f"Response length: {len(resp.text)}")
print(f"First 500 chars: {resp.text[:500]}")

try:
    result = resp.json()
    print("\nJSON PARSED OK!")
    threads = result.get('data', {}).get('mediaData', {}).get('threads', [])
    print(f"Found {len(threads)} threads")
except Exception as e:
    print(f"\nJSON PARSE FAILED: {e}")

    # Check if for_not_logged_in prefix exists
    if resp.text.startswith('for (;;);'):
        print("Has for(;;) prefix - stripping...")
        json_text = resp.text[9:]
        try:
            result = json.loads(json_text)
            print("JSON after stripping: OK!")
        except:
            print("Still failed after stripping")
