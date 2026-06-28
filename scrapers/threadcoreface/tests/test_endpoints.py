"""
Test different endpoint patterns to find the correct ones
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

# Test different endpoint patterns
test_endpoints = [
    # User details variants
    ('user-details', {'username': 'zuck'}),
    ('user_details', {'username': 'zuck'}),
    ('user/details', {'username': 'zuck'}),
    ('user', {'username': 'zuck'}),
    ('userdetails', {'username': 'zuck'}),
    ('profile', {'username': 'zuck'}),
    ('get-user', {'username': 'zuck'}),
    ('v1/user-details', {'username': 'zuck'}),
    ('api/user-details', {'username': 'zuck'}),

    # Try with different parameter name
    ('user-details', {'user': 'zuck'}),
    ('user-details', {'userid': 'zuck'}),
]

print(f"Testing API: {api_host}")
print(f"API Key: {api_key[:10]}...")
print("=" * 60)

for endpoint, params in test_endpoints:
    url = f"{base_url}/{endpoint}"
    print(f"\nTrying: {endpoint} with params {params}")

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)

        if response.status_code == 200:
            print(f"  [SUCCESS] Status: {response.status_code}")
            print(f"  Response preview: {str(response.json())[:200]}...")
            break
        elif response.status_code == 404:
            print(f"  [FAIL] 404 Not Found")
        elif response.status_code == 429:
            print(f"  [WARN] Rate Limited")
        else:
            print(f"  [?] Status: {response.status_code}")
            print(f"  Response: {response.text[:200]}")
    except Exception as e:
        print(f"  [ERROR] {e}")

print("\n" + "=" * 60)
print("If none worked, check:")
print("1. API key is valid")
print("2. API host is correct")
print("3. Check RapidAPI documentation for correct endpoints")
