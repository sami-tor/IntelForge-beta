"""
Test user-following endpoint to see actual response
"""

import requests
import json
from app.config import Config

api_key = Config.RAPIDAPI_KEY
api_host = Config.RAPIDAPI_HOST
base_url = f"https://{api_host}"

headers = {
    'x-rapidapi-key': api_key,
    'x-rapidapi-host': api_host
}

# Test with different users
test_users = ['n_m.yan', 'foxnews', 'zuck']

print("Testing user-following endpoint")
print("=" * 60)

for username in test_users:
    print(f"\nTesting: {username}")

    try:
        response = requests.get(
            f"{base_url}/user-following",
            headers=headers,
            params={'username': username, 'limit': 10},
            timeout=30
        )

        if response.status_code == 200:
            data = response.json()
            print(f"  Status: {response.status_code}")
            print(f"  Response keys: {list(data.keys())}")
            print(f"  Full response (first 500 chars):")
            print(json.dumps(data, indent=2)[:500])

            # Try to find users
            if 'data' in data:
                if isinstance(data['data'], list):
                    print(f"  Found {len(data['data'])} items in data list")
                    if len(data['data']) > 0:
                        print(f"  First item keys: {list(data['data'][0].keys())}")
                elif isinstance(data['data'], dict):
                    print(f"  data is dict with keys: {list(data['data'].keys())}")
                    if 'users' in data['data']:
                        print(f"  Found {len(data['data']['users'])} users")

            break  # Stop after first success

        elif response.status_code == 429:
            print(f"  Rate limited, trying next user...")
            continue
        else:
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.text[:200]}")

    except Exception as e:
        print(f"  Error: {e}")

print("\n" + "=" * 60)
