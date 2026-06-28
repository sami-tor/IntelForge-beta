"""
Find the correct endpoint for user posts/threads
"""

import requests
from app.config import Config

api_key = Config.RAPIDAPI_KEY
api_host = Config.RAPIDAPI_HOST
base_url = f"https://{api_host}"

headers = {
    'x-rapidapi-key': api_key,
    'x-rapidapi-host': api_host
}

# Test different post/thread endpoint patterns
test_endpoints = [
    ('user-threads', {'username': 'zuck'}),
    ('user-posts', {'username': 'zuck'}),
    ('threads', {'username': 'zuck'}),
    ('posts', {'username': 'zuck'}),
    ('user-media', {'username': 'zuck'}),
    ('get-threads', {'username': 'zuck'}),
    ('get-posts', {'username': 'zuck'}),
]

print(f"Testing posts/threads endpoints on: {api_host}")
print("=" * 60)

for endpoint, params in test_endpoints:
    url = f"{base_url}/{endpoint}"
    print(f"\nTrying: {endpoint} with params {params}")

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)

        if response.status_code == 200:
            print(f"  [SUCCESS] Status: {response.status_code}")
            data = response.json()
            print(f"  Response has these keys: {list(data.keys())[:5]}")
            print(f"  Full response preview:")
            import json
            print(json.dumps(data, indent=2)[:500])
            print(f"\n  ^^ THIS IS THE CORRECT ENDPOINT: {endpoint}")
            break
        elif response.status_code == 404:
            print(f"  [FAIL] 404 Not Found")
        elif response.status_code == 429:
            print(f"  [WARN] Rate Limited - waiting...")
            import time
            time.sleep(3)
        else:
            print(f"  [?] Status: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
    except Exception as e:
        print(f"  [ERROR] {e}")

print("\n" + "=" * 60)
print("If none worked, posts endpoint might not be available")
print("Check RapidAPI playground for available endpoints")
