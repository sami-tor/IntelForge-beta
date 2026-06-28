"""
Direct Threads scraper - bypasses RapidAPI for faster, free scraping
Uses Threads GraphQL API directly
"""

import requests
import json
import re
from PIL import Image
from io import BytesIO
from typing import Optional, List, Dict, Tuple
from loguru import logger
from concurrent.futures import ThreadPoolExecutor, as_completed


class ThreadsScraper:
    """Direct scraper for Threads using GraphQL API"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
        self.api_url = 'https://www.threads.net/api/graphql'
        self.doc_id = '6232751443445612'  # User threads query
        self.max_workers = 8
        self._cached_lsd = None  # Cache LSD token
        self._lsd_lock = None  # Lock for thread-safe LSD fetching

    def initialize(self):
        """Pre-fetch LSD token before parallel processing"""
        import threading
        self._lsd_lock = threading.Lock()
        lsd = self._get_lsd_token()
        if lsd:
            logger.info(f"Threads scraper initialized with LSD token")
            return True
        else:
            logger.error("Failed to initialize Threads scraper - could not get LSD token")
            return False

    def _get_lsd_token(self) -> Optional[str]:
        """
        Get LSD token from Threads homepage (cached and thread-safe)

        Returns:
            LSD token or None if failed
        """
        if self._cached_lsd:
            return self._cached_lsd

        # Use lock if available (for thread safety)
        if self._lsd_lock:
            with self._lsd_lock:
                # Double-check after acquiring lock
                if self._cached_lsd:
                    return self._cached_lsd
                return self._fetch_lsd_token()
        else:
            return self._fetch_lsd_token()

    def _fetch_lsd_token(self) -> Optional[str]:
        """Actually fetch the LSD token from homepage and store cookies"""
        try:
            # Use SESSION to get LSD token AND cookies
            response = self.session.get('https://www.threads.net/', timeout=30)

            if response.status_code != 200:
                logger.error(f"Failed to fetch Threads homepage: {response.status_code}")
                return None

            html = response.text

            # Extract LSD token
            lsd_match = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', html)
            if not lsd_match:
                logger.error("Could not find LSD token in homepage")
                return None

            self._cached_lsd = lsd_match.group(1)
            logger.debug(f"Got LSD token: {self._cached_lsd[:10]}..., cookies: {len(self.session.cookies)}")
            return self._cached_lsd

        except Exception as e:
            logger.error(f"Error getting LSD token: {e}")
            return None

    def _get_tokens(self, username: str) -> Optional[Tuple[str, str]]:
        """
        Fetch user page to get user_id and LSD token (fallback if no threads_id)

        Returns:
            Tuple of (user_id, lsd_token) or None if failed
        """
        try:
            url = f'https://www.threads.net/@{username}'
            response = self.session.get(url, timeout=30)

            if response.status_code != 200:
                logger.error(f"Failed to fetch page for @{username}: {response.status_code}")
                return None

            html = response.text

            # Extract user_id
            user_id_match = re.search(r'"user_id":"(\d+)"', html)
            if not user_id_match:
                logger.error(f"Could not find user_id for @{username}")
                return None

            # Extract LSD token
            lsd_match = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', html)
            if not lsd_match:
                logger.error(f"Could not find LSD token for @{username}")
                return None

            # Cache the LSD token
            self._cached_lsd = lsd_match.group(1)

            return user_id_match.group(1), lsd_match.group(1)

        except Exception as e:
            logger.error(f"Error getting tokens for @{username}: {e}")
            return None

    def _call_graphql(self, user_id: str, lsd: str) -> Optional[Dict]:
        """
        Call Threads GraphQL API to get user's threads/posts

        Returns:
            API response data or None if failed
        """
        try:
            # Get CSRF token from cookies
            csrf = self.session.cookies.get('csrftoken', '')

            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': '*/*',
                'X-FB-LSD': lsd,
                'X-IG-App-ID': '238260118697367',
                'X-CSRFToken': csrf,
                'Origin': 'https://www.threads.net',
                'Referer': 'https://www.threads.net/',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
            }

            data = {
                'lsd': lsd,
                'variables': json.dumps({'userID': user_id}),
                'doc_id': self.doc_id,
            }

            # Use the session to include cookies from homepage fetch
            response = self.session.post(self.api_url, headers=headers, data=data, timeout=30)

            logger.debug(f"API response status: {response.status_code}, length: {len(response.text)}")

            if response.status_code != 200:
                logger.error(f"GraphQL API error: {response.status_code} - {response.text[:200]}")
                return None

            if not response.text:
                logger.error(f"GraphQL API returned empty response")
                return None

            try:
                return response.json()
            except Exception as e:
                logger.error(f"Failed to parse JSON: {e}, response: {response.text[:200]}")
                return None

        except Exception as e:
            logger.error(f"GraphQL API call failed: {e}")
            return None

    def _extract_image_urls(self, api_data: Dict, skip_reposts: bool = True) -> List[str]:
        """
        Extract image URLs from API response

        Args:
            api_data: GraphQL API response
            skip_reposts: If True, skip reposted content

        Returns:
            List of image URLs
        """
        image_urls = []

        # Handle None or invalid response
        if not api_data or not isinstance(api_data, dict):
            return []

        data = api_data.get('data')
        if not data:
            return []

        media_data = data.get('mediaData')
        if not media_data:
            return []

        threads = media_data.get('threads', []) or []

        for thread in threads:
            for item in thread.get('thread_items', []):
                post = item.get('post', {})

                # Check if repost or quote
                if skip_reposts:
                    app_info = post.get('text_post_app_info', {})
                    share_info = app_info.get('share_info', {})

                    if share_info.get('reposted_post') or share_info.get('quoted_post'):
                        continue  # Skip reposts and quotes

                # Get images from carousel
                carousel = post.get('carousel_media') or []
                for cm in carousel:
                    candidates = cm.get('image_versions2', {}).get('candidates', [])
                    if candidates:
                        # Get highest resolution
                        best = max(candidates, key=lambda x: x.get('width', 0) * x.get('height', 0))
                        if best.get('url'):
                            image_urls.append(best.get('url'))

                # Get direct image (if no carousel)
                if not carousel:
                    candidates = post.get('image_versions2', {}).get('candidates', [])
                    if candidates:
                        best = max(candidates, key=lambda x: x.get('width', 0) * x.get('height', 0))
                        if best.get('url'):
                            image_urls.append(best.get('url'))

        return image_urls

    def _extract_profile_pic_url(self, api_data: Dict) -> Optional[str]:
        """Extract profile pic URL from API response"""
        if not api_data or not isinstance(api_data, dict):
            return None

        data = api_data.get('data')
        if not data:
            return None

        media_data = data.get('mediaData')
        if not media_data:
            return None

        threads = media_data.get('threads', []) or []
        if not threads:
            return None

        # Get profile pic from first post's user data
        first_thread = threads[0]
        items = first_thread.get('thread_items', [])
        if not items:
            return None

        post = items[0].get('post', {})
        user = post.get('user', {})
        return user.get('profile_pic_url')

    def _download_image(self, url: str) -> Optional[Image.Image]:
        """
        Download a single image

        Returns:
            PIL Image or None if failed
        """
        try:
            response = self.session.get(url, timeout=30)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content)).convert('RGB')
        except Exception as e:
            logger.debug(f"Failed to download image: {e}")
        return None

    def get_user_images(self, username: str, limit: int = 20, skip_reposts: bool = True, threads_id: str = None) -> List[Tuple[Image.Image, int]]:
        """
        Get user's images directly from Threads

        Args:
            username: Threads username (without @)
            limit: Maximum number of images to return
            skip_reposts: If True, skip reposted content
            threads_id: Optional user's Threads ID (if known, skips page fetch)

        Returns:
            List of (PIL Image, index) tuples
        """
        logger.info(f"Fetching images for @{username}...")

        # Step 1: Get user_id and LSD token
        if threads_id:
            # We have the ID already, just need LSD token
            user_id = str(threads_id)
            lsd = self._get_lsd_token()
            if not lsd:
                logger.warning(f"Could not get LSD token")
                return []
            logger.debug(f"Using provided threads_id: {user_id}")
        else:
            # Fallback: fetch from user page
            tokens = self._get_tokens(username)
            if not tokens:
                logger.warning(f"Could not get tokens for @{username}")
                return []
            user_id, lsd = tokens
            logger.debug(f"Got user_id from page: {user_id}")

        # Step 2: Call GraphQL API
        api_data = self._call_graphql(user_id, lsd)
        if not api_data:
            logger.warning(f"Could not get API data for @{username}")
            return []

        # Step 3: Extract image URLs
        image_urls = self._extract_image_urls(api_data, skip_reposts)

        if not image_urls:
            logger.warning(f"No images found for @{username}")
            return []

        # Limit URLs
        image_urls = image_urls[:limit]
        logger.info(f"Found {len(image_urls)} images for @{username}")

        # Step 4: Download images in parallel
        results = []

        def download_with_index(args):
            idx, url = args
            img = self._download_image(url)
            if img:
                return (img, idx)
            return None

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(download_with_index, (i, url)): i
                      for i, url in enumerate(image_urls)}

            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)

        # Sort by original index
        results.sort(key=lambda x: x[1])

        logger.info(f"Downloaded {len(results)}/{len(image_urls)} images for @{username}")
        return results

    def get_user_info(self, username: str) -> Optional[Dict]:
        """
        Get basic user info from page

        Returns:
            Dict with user info or None
        """
        try:
            url = f'https://www.threads.net/@{username}'
            response = self.session.get(url, timeout=30)

            if response.status_code != 200:
                return None

            html = response.text

            # Extract user data from HTML
            user_id_match = re.search(r'"user_id":"(\d+)"', html)

            # Try to find profile pic
            profile_pic_match = re.search(r'"profile_pic_url":"([^"]+)"', html)

            # Try to find full name
            full_name_match = re.search(r'"full_name":"([^"]*)"', html)

            # Try to find bio
            bio_match = re.search(r'"biography":"([^"]*)"', html)

            # Try to find follower count
            follower_match = re.search(r'"follower_count":(\d+)', html)

            return {
                'username': username,
                'threads_id': user_id_match.group(1) if user_id_match else None,
                'full_name': full_name_match.group(1) if full_name_match else None,
                'bio': bio_match.group(1).encode().decode('unicode_escape') if bio_match else None,
                'profile_photo': profile_pic_match.group(1).replace('\\/', '/') if profile_pic_match else None,
                'follower_count': int(follower_match.group(1)) if follower_match else 0,
            }

        except Exception as e:
            logger.error(f"Error getting user info for @{username}: {e}")
            return None


# Global scraper instance
threads_scraper = ThreadsScraper()
