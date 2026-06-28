#!/usr/bin/env python3
"""
Auto Threads Scraper
Automatically scrapes Threads profiles from a queue and indexes them
"""

import os
import sys
import time
import json
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add services to path (parent directory)
service_path = Path(__file__).parent.parent
sys.path.insert(0, str(service_path))

from threads_scraper.scraper import threads_scraper
from threads_scraper.indexer import threads_indexer

# Config
USERNAMES_FILE = os.getenv('THREADS_USERNAMES_FILE', '/data/threads_usernames.txt')
PROCESSED_FILE = '/tmp/threads_processed.json'
SCAN_INTERVAL = int(os.getenv('THREADS_SCAN_INTERVAL', 3600))  # 1 hour default


def load_processed():
    """Load list of already processed usernames"""
    if os.path.exists(PROCESSED_FILE):
        try:
            with open(PROCESSED_FILE, 'r') as f:
                return set(json.load(f))
        except:
            return set()
    return set()


def save_processed(processed):
    """Save processed usernames"""
    try:
        with open(PROCESSED_FILE, 'w') as f:
            json.dump(list(processed), f)
    except Exception as e:
        logger.error(f"Failed to save processed file: {e}")


def load_usernames():
    """Load usernames from file"""
    if not os.path.exists(USERNAMES_FILE):
        logger.warning(f"Usernames file not found: {USERNAMES_FILE}")
        logger.info("Create the file with one username per line (without @)")
        return []
    
    try:
        with open(USERNAMES_FILE, 'r') as f:
            usernames = [line.strip().replace('@', '') for line in f if line.strip() and not line.startswith('#')]
        return usernames
    except Exception as e:
        logger.error(f"Error reading usernames file: {e}")
        return []


def scrape_and_index(username):
    """Scrape and index a single profile"""
    try:
        logger.info(f"🔍 Scraping @{username}...")
        
        # Scrape profile
        profile_data = threads_scraper.scrape_profile(username)
        
        if not profile_data:
            logger.warning(f"❌ Failed to scrape @{username} (profile not found or private)")
            return False
        
        images_count = len(profile_data.get('profile_images', []))
        logger.info(f"✅ Scraped @{username}: {images_count} images, {profile_data.get('follower_count', 0)} followers")
        
        # Index to system
        results = threads_indexer.index_profile(profile_data)
        
        logger.info(f"📥 Indexed @{username}: {results['indexed_faces']} faces, {results['uploaded_images']} images uploaded")
        
        if results.get('errors'):
            logger.warning(f"⚠️  Errors during indexing: {results['errors']}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error processing @{username}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main auto-scraper loop"""
    logger.info("=" * 60)
    logger.info("🚀 Threads Auto-Scraper Started")
    logger.info("=" * 60)
    logger.info(f"Usernames file: {USERNAMES_FILE}")
    logger.info(f"Scan interval: {SCAN_INTERVAL}s")
    logger.info("=" * 60)
    
    while True:
        try:
            # Load usernames to scrape
            usernames = load_usernames()
            
            if not usernames:
                logger.info(f"No usernames to scrape. Add usernames to {USERNAMES_FILE}")
                time.sleep(SCAN_INTERVAL)
                continue
            
            # Load already processed
            processed = load_processed()
            
            # Find new usernames
            to_process = [u for u in usernames if u not in processed]
            
            if not to_process:
                logger.info(f"All {len(usernames)} profiles already processed")
                logger.info(f"Next scan in {SCAN_INTERVAL}s...")
                time.sleep(SCAN_INTERVAL)
                continue
            
            logger.info(f"📋 Found {len(to_process)} new profiles to scrape")
            
            # Process each username
            for idx, username in enumerate(to_process, 1):
                logger.info(f"\n[{idx}/{len(to_process)}] Processing @{username}")
                
                success = scrape_and_index(username)
                
                if success:
                    processed.add(username)
                    save_processed(processed)
                
                # Rate limiting - wait between profiles
                if idx < len(to_process):
                    wait_time = 10
                    logger.info(f"⏳ Waiting {wait_time}s before next profile...")
                    time.sleep(wait_time)
            
            logger.info(f"\n✅ Batch complete! Processed {len(to_process)} profiles")
            logger.info(f"💾 Total profiles indexed: {len(processed)}")
            logger.info(f"⏳ Next scan in {SCAN_INTERVAL}s...\n")
            
            time.sleep(SCAN_INTERVAL)
            
        except KeyboardInterrupt:
            logger.info("\n👋 Scraper stopped by user")
            break
        except Exception as e:
            logger.error(f"❌ Error in main loop: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)  # Wait 1 min on error


if __name__ == "__main__":
    main()

