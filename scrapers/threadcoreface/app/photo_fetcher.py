"""
Photo fetcher and downloader
"""

import requests
from pathlib import Path
from PIL import Image
from io import BytesIO
from loguru import logger
from typing import Optional, Tuple, List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.config import Config


class PhotoFetcher:
    """Download and process photos"""

    def __init__(self):
        self.profiles_dir = Config.PROFILES_DIR
        self.photos_dir = Config.PHOTOS_DIR
        self.timeout = 30
        self.max_workers = 8  # Number of parallel downloads

    def download_image(self, url: str) -> Optional[Image.Image]:
        """
        Download image from URL
        Returns PIL Image or None
        """
        try:
            response = requests.get(url, timeout=self.timeout)
            if response.status_code == 200:
                img = Image.open(BytesIO(response.content))
                return img.convert('RGB')
            else:
                logger.warning(f"Failed to download image: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error downloading image from {url}: {e}")
            return None

    def download_profile_photo(self, username: str, photo_url: str) -> Optional[str]:
        """
        Download user profile photo
        Returns saved file path or None
        """
        if not photo_url:
            return None

        logger.info(f"Downloading profile photo for {username}")

        img = self.download_image(photo_url)
        if img is None:
            return None

        # Save to profiles directory
        file_path = self.profiles_dir / f"{username}.jpg"
        try:
            img.save(file_path, 'JPEG', quality=95)
            logger.info(f"Saved profile photo: {file_path}")
            return str(file_path)
        except Exception as e:
            logger.error(f"Failed to save profile photo: {e}")
            return None

    def download_media_photo(self, username: str, photo_url: str, photo_index: int) -> Optional[Tuple[str, Image.Image]]:
        """
        Download media photo and return both path and PIL Image
        Returns (file_path, image) or None
        """
        logger.info(f"Downloading media photo {photo_index} for {username}")

        img = self.download_image(photo_url)
        if img is None:
            return None

        # Generate file path but don't save yet (we'll check for face first)
        file_path = self.photos_dir / f"{username}_{photo_index}.jpg"

        return str(file_path), img

    def save_image(self, img: Image.Image, file_path: str) -> bool:
        """
        Save PIL Image to file
        Returns True if successful
        """
        try:
            img.save(file_path, 'JPEG', quality=95)
            logger.info(f"Saved photo: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to save image: {e}")
            return False

    def download_media_photos_parallel(self, username: str, media_items: List[Dict]) -> List[Tuple[str, Image.Image, int]]:
        """
        Download multiple media photos in parallel

        Args:
            username: Username for file naming
            media_items: List of media items with 'url' key

        Returns:
            List of tuples: (file_path, image, original_index)
        """
        results = []

        def download_single(index_and_media):
            """Download a single photo - used by thread pool"""
            index, media = index_and_media
            try:
                logger.debug(f"Downloading photo {index} for {username}")
                img = self.download_image(media['url'])
                if img is None:
                    return None

                file_path = self.photos_dir / f"{username}_{index}.jpg"
                return (str(file_path), img, index)
            except Exception as e:
                logger.error(f"Error downloading photo {index}: {e}")
                return None

        # Create list of (index, media) tuples
        indexed_media = list(enumerate(media_items))

        # Download in parallel using ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all downloads
            futures = {executor.submit(download_single, item): item for item in indexed_media}

            # Collect results as they complete
            for future in as_completed(futures):
                result = future.result()
                if result is not None:
                    results.append(result)

        # Sort by original index to maintain order
        results.sort(key=lambda x: x[2])

        logger.info(f"Downloaded {len(results)}/{len(media_items)} photos for {username}")
        return results


# Global photo fetcher instance
photo_fetcher = PhotoFetcher()
