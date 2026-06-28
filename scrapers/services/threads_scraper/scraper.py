"""
Threads Profile Scraper - FREE (no API key)
Scrapes Threads profiles and integrates with MinIO, Milvus, and Quickwit
"""

import requests
import json
import re
import hashlib
import os
from PIL import Image
from io import BytesIO
from typing import Optional, List, Dict, Tuple
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ThreadsProfileScraper:
    """Free Threads scraper using public GraphQL API"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        self.api_url = 'https://www.threads.net/api/graphql'
        self.doc_id = '6232751443445612'  # User threads query
        self._cached_lsd = None

    def _get_lsd_token(self) -> Optional[str]:
        """Get LSD token from Threads homepage"""
        if self._cached_lsd:
            return self._cached_lsd

        try:
            response = self.session.get('https://www.threads.net/', timeout=30)
            if response.status_code != 200:
                logger.error(f"Failed to fetch Threads homepage: {response.status_code}")
                return None

            html = response.text
            lsd_match = re.search(r'"LSD",\[\],\{"token":"([^"]+)"', html)
            if not lsd_match:
                logger.error("Could not find LSD token")
                return None

            self._cached_lsd = lsd_match.group(1)
            return self._cached_lsd

        except Exception as e:
            logger.error(f"Error getting LSD token: {e}")
            return None

    def _get_user_tokens(self, username: str) -> Optional[Tuple[str, str]]:
        """Get user_id and LSD token from profile page"""
        try:
            url = f'https://www.threads.net/@{username}'
            response = self.session.get(url, timeout=30)

            if response.status_code != 200:
                logger.error(f"Failed to fetch @{username}: {response.status_code}")
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
                logger.error(f"Could not find LSD token")
                return None

            self._cached_lsd = lsd_match.group(1)
            return user_id_match.group(1), lsd_match.group(1)

        except Exception as e:
            logger.error(f"Error getting tokens for @{username}: {e}")
            return None

    def _call_graphql(self, user_id: str, lsd: str) -> Optional[Dict]:
        """Call Threads GraphQL API"""
        try:
            csrf = self.session.cookies.get('csrftoken', '')

            headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-FB-LSD': lsd,
                'X-IG-App-ID': '238260118697367',
                'X-CSRFToken': csrf,
                'Origin': 'https://www.threads.net',
                'Referer': 'https://www.threads.net/',
            }

            data = {
                'lsd': lsd,
                'variables': json.dumps({'userID': user_id}),
                'doc_id': self.doc_id,
            }

            response = self.session.post(self.api_url, headers=headers, data=data, timeout=30)

            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"GraphQL API error: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Error calling GraphQL API: {e}")
            return None

    def scrape_profile(self, username: str) -> Optional[Dict]:
        """
        Scrape complete Threads profile
        
        Returns dict with:
        - username, full_name, bio
        - follower_count, following_count
        - profile_pic_url
        - threads_url
        - is_verified, is_private
        - profile_images (list of PIL Images)
        """
        logger.info(f"Scraping Threads profile: @{username}")

        # Get tokens
        tokens = self._get_user_tokens(username)
        if not tokens:
            return None

        user_id, lsd = tokens

        # Call API
        api_data = self._call_graphql(user_id, lsd)
        if not api_data:
            return None

        # Extract profile data
        profile = self._extract_profile_data(api_data, username, user_id)
        
        # Download images
        if profile:
            profile['profile_images'] = self._download_images(api_data, limit=20)
        
        return profile

    def _extract_profile_data(self, api_data: Dict, username: str, user_id: str) -> Optional[Dict]:
        """Extract profile metadata from API response"""
        try:
            data = api_data.get('data', {})
            media_data = data.get('mediaData', {})
            threads = media_data.get('threads', []) or []

            if not threads:
                logger.warning("No threads data found")
                return None

            # Get user data from first post
            first_thread = threads[0]
            items = first_thread.get('thread_items', [])
            if not items:
                return None

            post = items[0].get('post', {})
            user = post.get('user', {})

            profile = {
                'username': username,
                'user_id': user_id,
                'full_name': user.get('full_name', ''),
                'bio': user.get('biography', ''),
                'profile_pic_url': user.get('profile_pic_url', ''),
                'follower_count': user.get('follower_count', 0),
                'following_count': None,  # Not in API response
                'is_verified': user.get('is_verified', False),
                'is_private': user.get('is_private', False),
                'threads_url': f'https://www.threads.net/@{username}',
                'scraped_at': datetime.utcnow().isoformat()
            }

            return profile

        except Exception as e:
            logger.error(f"Error extracting profile data: {e}")
            return None

    def _download_images(self, api_data: Dict, limit: int = 20) -> List[Image.Image]:
        """Download images from posts"""
        images = []
        
        try:
            data = api_data.get('data', {})
            media_data = data.get('mediaData', {})
            threads = media_data.get('threads', []) or []

            for thread in threads:
                if len(images) >= limit:
                    break

                for item in thread.get('thread_items', []):
                    if len(images) >= limit:
                        break

                    post = item.get('post', {})
                    
                    # Skip reposts
                    app_info = post.get('text_post_app_info', {})
                    share_info = app_info.get('share_info', {})
                    if share_info.get('reposted_post') or share_info.get('quoted_post'):
                        continue

                    # Get images from carousel
                    carousel = post.get('carousel_media') or []
                    for cm in carousel:
                        if len(images) >= limit:
                            break
                        candidates = cm.get('image_versions2', {}).get('candidates', [])
                        if candidates:
                            best = max(candidates, key=lambda x: x.get('width', 0) * x.get('height', 0))
                            url = best.get('url')
                            if url:
                                img = self._download_single_image(url)
                                if img:
                                    images.append(img)

                    # Get direct image (if no carousel)
                    if not carousel:
                        candidates = post.get('image_versions2', {}).get('candidates', [])
                        if candidates:
                            best = max(candidates, key=lambda x: x.get('width', 0) * x.get('height', 0))
                            url = best.get('url')
                            if url:
                                img = self._download_single_image(url)
                                if img:
                                    images.append(img)

        except Exception as e:
            logger.error(f"Error downloading images: {e}")

        return images

    def _download_single_image(self, url: str) -> Optional[Image.Image]:
        """Download a single image"""
        try:
            response = self.session.get(url, timeout=30)
            if response.status_code == 200:
                return Image.open(BytesIO(response.content)).convert('RGB')
        except Exception as e:
            logger.debug(f"Failed to download image: {e}")
        return None


# Global instance
threads_scraper = ThreadsProfileScraper()

