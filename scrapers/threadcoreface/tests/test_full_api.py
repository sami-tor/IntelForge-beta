"""
Test all API endpoints
"""

from app.threads_api import threads_api
from loguru import logger
import sys

logger.remove()
logger.add(sys.stderr, level="INFO")

print("=" * 60)
print("Testing Threads API - All Endpoints")
print("=" * 60)

# Test 1: User details
print("\n1. Testing user-details for n_m.yan...")
user_data = threads_api.get_user_details("n_m.yan")
if user_data:
    print(f"   [OK] Success: {user_data.get('full_name')} (@{user_data.get('username')})")
    print(f"   Followers: {user_data.get('follower_count')}")
else:
    print("   [FAIL] Failed")

# Test 2: User following
print("\n2. Testing user-following for n_m.yan...")
following = threads_api.get_user_following("n_m.yan", limit=10)
if following:
    print(f"   [OK] Success: Found {len(following)} users")
    print(f"   First 5: {following[:5]}")
else:
    print("   [FAIL] Failed or no following")

# Test 3: User media
print("\n3. Testing user-threads for n_m.yan...")
media = threads_api.get_user_media("n_m.yan", limit=5)
if media:
    print(f"   [OK] Success: Found {len(media)} media items")
else:
    print("   [FAIL] Failed or no media")

print("\n" + "=" * 60)
print("API Testing Complete!")
print("=" * 60)
