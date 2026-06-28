"""
Threads API wrapper for RapidAPI ThreadsScraper
"""

import requests
import time
from loguru import logger
from typing import Optional, Dict, List

from app.config import Config


class ThreadsAPI:
    """Wrapper for Threads RapidAPI"""

    def __init__(self):
        self.api_key = Config.RAPIDAPI_KEY
        self.api_host = Config.RAPIDAPI_HOST
        self.base_url = f"https://{self.api_host}"
        self.headers = {
            'x-rapidapi-key': self.api_key,
            'x-rapidapi-host': self.api_host
        }
        self.max_retries = 3
        self.retry_delay = 2

    def _make_request(self, endpoint: str, params: Dict) -> Optional[Dict]:
        """Make API request with retry logic"""
        url = f"{self.base_url}/{endpoint}"

        for attempt in range(self.max_retries):
            try:
                response = requests.get(url, headers=self.headers, params=params, timeout=30)

                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 429:
                    logger.warning(f"Rate limit hit, waiting {self.retry_delay * (attempt + 1)}s...")
                    time.sleep(self.retry_delay * (attempt + 1))
                    continue
                else:
                    logger.error(f"API error {response.status_code}: {response.text}")
                    return None

            except requests.exceptions.Timeout:
                logger.warning(f"Request timeout, attempt {attempt + 1}/{self.max_retries}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                return None

            except Exception as e:
                logger.error(f"Request failed: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                return None

        return None

    def get_user_details(self, username: str) -> Optional[Dict]:
        """
        Get user profile details
        Returns normalized user data
        """
        logger.info(f"Fetching user details for: {username}")

        data = self._make_request('user-details', {'username': username})

        if not data or 'data' not in data:
            logger.error(f"Failed to fetch user details for {username}")
            return None

        user_data = data['data']

        # Normalize the response
        normalized = {
            'username': user_data.get('username'),
            'threads_id': user_data.get('id'),
            'full_name': user_data.get('full_name'),
            'bio': user_data.get('biography', ''),
            'profile_photo': user_data.get('profile_pic_url'),
            'is_verified': user_data.get('is_verified', False),
            'follower_count': user_data.get('follower_count', 0),
            'following_count': user_data.get('following_count', 0)
        }

        logger.info(f"Successfully fetched details for {username}")
        return normalized

    def get_user_media(self, username: str, limit: int = 20) -> Optional[List[Dict]]:
        """
        Get user's media/posts
        Returns list of media items
        """
        logger.info(f"Fetching media for: {username}")

        data = self._make_request('user-threads', {'username': username, 'limit': limit})

        if not data or 'data' not in data:
            logger.warning(f"No media found for {username}")
            return []

        threads = data['data']
        media_items = []

        for thread in threads:
            # Check for carousel media
            carousel_media = thread.get('carousel_media')
            if carousel_media:
                for carousel_item in carousel_media:
                    # Try to get image versions
                    if 'image_versions2' in carousel_item:
                        candidates = carousel_item['image_versions2'].get('candidates', [])
                        if candidates:
                            media_items.append({
                                'url': candidates[0].get('url'),
                                'width': candidates[0].get('width'),
                                'height': candidates[0].get('height')
                            })

            # Check for direct image versions (not in carousel)
            if 'image_versions2' in thread:
                candidates = thread['image_versions2'].get('candidates', [])
                if candidates:
                    media_items.append({
                        'url': candidates[0].get('url'),
                        'width': candidates[0].get('width'),
                        'height': candidates[0].get('height')
                    })

        logger.info(f"Found {len(media_items)} media items for {username}")
        return media_items

    def get_user_following(self, username: str, limit: int = 100, callback=None) -> Optional[List[str]]:
        """
        Get list of users that this user follows
        Returns list of usernames

        Supports pagination to fetch ALL followings (up to limit)

        Args:
            username: User to get followings for
            limit: Maximum number of users to fetch
            callback: Optional callback(users_batch) called for each page
        """
        logger.info(f"Fetching following list for: {username} (limit: {limit})")

        all_usernames = []
        cursor_token = None
        page = 1

        while len(all_usernames) < limit:
            # Build params
            params = {'username': username}
            if cursor_token:
                params['cursor'] = cursor_token

            logger.info(f"Fetching page {page}...")
            data = self._make_request('user-following', params)

            if not data or 'data' not in data:
                if page == 1:
                    logger.warning(f"No following data for {username}")
                    return []
                else:
                    # No more data, stop pagination
                    break

            # data['data'] is a direct list of user objects
            users = data['data']
            if not isinstance(users, list):
                logger.warning(f"Unexpected data format for {username}")
                break

            if not users:
                # No more users, stop pagination
                break

            # Extract usernames
            usernames = [user.get('username') for user in users if user.get('username')]
            all_usernames.extend(usernames)

            logger.info(f"Page {page}: Got {len(usernames)} users (total: {len(all_usernames)})")

            # Call callback with this batch if provided
            if callback:
                callback(users)

            # Check for next cursor
            cursor_token = data.get('cursor')
            if cursor_token:
                page += 1
                time.sleep(0.5)  # Small delay between pages
            else:
                # No more pages
                logger.info("No more pages available")
                break

        logger.info(f"Found {len(all_usernames)} total following for {username}")
        return all_usernames[:limit]  # Respect limit


# Global API instance
threads_api = ThreadsAPI()
