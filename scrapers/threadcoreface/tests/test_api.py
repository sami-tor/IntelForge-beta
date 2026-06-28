"""
Test Threads API endpoints
"""

import sys
from loguru import logger

from app.config import Config
from app.threads_api import threads_api

# Setup logging
logger.remove()
logger.add(sys.stderr, level="INFO")


def test_user_details():
    """Test getting user details"""
    logger.info("Testing user details endpoint...")

    test_username = "zuck"

    user_data = threads_api.get_user_details(test_username)

    if user_data:
        logger.info(f"Success! Got data for @{test_username}")
        logger.info(f"  Full name: {user_data.get('full_name')}")
        logger.info(f"  Followers: {user_data.get('follower_count')}")
        logger.info(f"  Following: {user_data.get('following_count')}")
        return True
    else:
        logger.error("Failed to get user details")
        return False


def test_user_media():
    """Test getting user media"""
    logger.info("Testing user media endpoint...")

    test_username = "zuck"

    media_items = threads_api.get_user_media(test_username, limit=5)

    if media_items:
        logger.info(f"Success! Got {len(media_items)} media items for @{test_username}")
        return True
    else:
        logger.warning("No media items found (might be normal)")
        return True  # Not an error


def main():
    logger.info("=" * 60)
    logger.info("Threads API Test")
    logger.info("=" * 60)
    logger.info(f"API Host: {Config.RAPIDAPI_HOST}")
    logger.info(f"API Key: {Config.RAPIDAPI_KEY[:10]}...")
    logger.info("")

    # Test endpoints
    test1 = test_user_details()
    logger.info("")
    test2 = test_user_media()

    logger.info("")
    logger.info("=" * 60)
    if test1 and test2:
        logger.info("All tests passed!")
    else:
        logger.error("Some tests failed - check API credentials and endpoints")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
