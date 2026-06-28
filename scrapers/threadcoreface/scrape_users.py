"""
Stage 1: Scrape users and save to database
- Gets followings of a seed user
- Saves user info + profile photos
- Filters out users with >25k followers (saves to rejected_users)
- Does NOT process faces (that's Stage 2)
"""

import sys
import time
import requests
from pathlib import Path
from loguru import logger

from app.config import Config
from app.database import db, ThreadsUser, RejectedUser
from app.threads_api import threads_api

# Setup logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    Config.LOGS_DIR / "scrape_users.log",
    rotation="50 MB",
    retention="30 days",
    level="DEBUG"
)

# Settings
MAX_FOLLOWERS_THRESHOLD = 25000
RATE_LIMIT_DELAY = 0.5


def is_user_exists(username: str) -> bool:
    """Check if user already exists in threads_users table"""
    with db.get_session() as session:
        user = session.query(ThreadsUser).filter(
            ThreadsUser.username == username
        ).first()
        return user is not None


def is_rejected(username: str) -> bool:
    """Check if user is in rejected_users table"""
    with db.get_session() as session:
        rejected = session.query(RejectedUser).filter(
            RejectedUser.username == username
        ).first()
        return rejected is not None


def save_rejected_user(username: str, reason: str, follower_count: int, source: str):
    """Save user to rejected_users table"""
    try:
        with db.get_session() as session:
            rejected = RejectedUser(
                username=username,
                reason=reason,
                follower_count=follower_count,
                source_username=source
            )
            session.add(rejected)
            session.commit()
            logger.debug(f"Rejected @{username}: {reason}")
    except Exception as e:
        if "Duplicate entry" not in str(e):
            logger.error(f"Error saving rejected user {username}: {e}")


def download_profile_photo(username: str, photo_url: str) -> str:
    """Download profile photo and return saved path"""
    if not photo_url:
        return None

    try:
        file_path = Config.PROFILES_DIR / f"{username}.jpg"

        # Skip if already exists
        if file_path.exists():
            return str(file_path)

        response = requests.get(photo_url, timeout=30)
        if response.status_code == 200:
            with open(file_path, 'wb') as f:
                f.write(response.content)
            logger.debug(f"Saved profile photo: {username}.jpg")
            return str(file_path)
    except Exception as e:
        logger.error(f"Error downloading profile photo for {username}: {e}")

    return None


def save_user(user_data: dict, source_username: str) -> bool:
    """
    Save user to threads_users table

    Args:
        user_data: User data from API
        source_username: Username of the user whose followings we're scraping

    Returns:
        True if saved, False if skipped/rejected
    """
    username = user_data.get('username')
    if not username:
        return False

    # Check if already exists
    if is_user_exists(username):
        logger.debug(f"User @{username} already exists")
        return False

    # Check if already rejected
    if is_rejected(username):
        logger.debug(f"User @{username} already rejected")
        return False

    # Check follower count
    follower_count = user_data.get('follower_count', 0)
    if follower_count > MAX_FOLLOWERS_THRESHOLD:
        save_rejected_user(username, 'too_many_followers', follower_count, source_username)
        logger.info(f"Rejected @{username}: {follower_count:,} followers")
        return False

    # Download profile photo
    profile_photo_path = download_profile_photo(
        username,
        user_data.get('profile_pic_url')
    )

    # Save to database
    try:
        with db.get_session() as session:
            user = ThreadsUser(
                username=username,
                threads_id=user_data.get('id'),
                full_name=user_data.get('full_name'),
                bio=user_data.get('biography', ''),
                profile_photo=profile_photo_path,
                follower_count=follower_count,
                following_count=user_data.get('following_count', 0),
                status='user_saved',
                source_username=source_username  # Track where this user came from
            )
            session.add(user)
            session.commit()
            logger.info(f"Saved @{username} ({follower_count:,} followers) [source: @{source_username}]")
            return True
    except Exception as e:
        if "Duplicate entry" not in str(e):
            logger.error(f"Error saving user {username}: {e}")
        return False


def scrape_followings(seed_username: str, limit: int = 10000) -> dict:
    """
    Scrape followings of a user and save to database

    Args:
        seed_username: Username to get followings from
        limit: Maximum number of followings to fetch

    Returns:
        Statistics dict
    """
    logger.info(f"=" * 80)
    logger.info(f"Scraping followings of @{seed_username}")
    logger.info(f"=" * 80)

    stats = {
        'total_fetched': 0,
        'saved': 0,
        'skipped_exists': 0,
        'rejected': 0,
        'errors': 0
    }

    def process_batch(users_batch):
        """Process each batch of users immediately"""
        for user_data in users_batch:
            stats['total_fetched'] += 1

            username = user_data.get('username')
            if not username:
                continue

            # Check follower count for filtering
            follower_count = user_data.get('follower_count', 0)

            if follower_count > MAX_FOLLOWERS_THRESHOLD:
                # Reject high-follower users
                if not is_rejected(username):
                    save_rejected_user(username, 'too_many_followers', follower_count, seed_username)
                stats['rejected'] += 1
                continue

            # Check if exists
            if is_user_exists(username):
                stats['skipped_exists'] += 1
                continue

            if is_rejected(username):
                stats['rejected'] += 1
                continue

            # Save user
            if save_user(user_data, seed_username):
                stats['saved'] += 1
            else:
                stats['errors'] += 1

            # Progress log every 50 users
            if stats['total_fetched'] % 50 == 0:
                logger.info(f"Progress: {stats['total_fetched']} fetched, {stats['saved']} saved, {stats['rejected']} rejected")

    # Fetch followings with callback
    threads_api.get_user_following(seed_username, limit, callback=process_batch)

    return stats


def print_stats(stats: dict):
    """Print final statistics"""
    logger.info(f"=" * 80)
    logger.info(f"SCRAPING COMPLETE")
    logger.info(f"=" * 80)
    logger.info(f"Total fetched:    {stats['total_fetched']}")
    logger.info(f"Saved to DB:      {stats['saved']}")
    logger.info(f"Skipped (exists): {stats['skipped_exists']}")
    logger.info(f"Rejected:         {stats['rejected']}")
    logger.info(f"Errors:           {stats['errors']}")
    logger.info(f"=" * 80)


def get_db_stats():
    """Get current database statistics"""
    with db.get_session() as session:
        total_users = session.query(ThreadsUser).count()
        user_saved = session.query(ThreadsUser).filter(ThreadsUser.status == 'user_saved').count()
        completed = session.query(ThreadsUser).filter(ThreadsUser.status == 'completed').count()
        rejected = session.query(RejectedUser).count()

        return {
            'total_users': total_users,
            'user_saved': user_saved,
            'completed': completed,
            'rejected': rejected
        }


def main():
    """Main entry point"""
    # Ensure directories exist
    Config.ensure_dirs()

    # Connect to database
    logger.info("Connecting to database...")
    db.connect()

    # Show current stats
    db_stats = get_db_stats()
    logger.info(f"Current DB: {db_stats['total_users']} users, {db_stats['rejected']} rejected")

    # Get seed username from command line or use default
    if len(sys.argv) > 1:
        seed_username = sys.argv[1]
    else:
        seed_username = input("Enter seed username to scrape followings: ").strip()
        if not seed_username:
            seed_username = "n_m.yan"

    # Scrape followings
    try:
        stats = scrape_followings(seed_username)
        print_stats(stats)

        # Show final DB stats
        db_stats = get_db_stats()
        logger.info(f"Final DB: {db_stats['total_users']} users, {db_stats['rejected']} rejected")
        logger.info(f"Ready for Stage 2: {db_stats['user_saved']} users waiting for face processing")

    except KeyboardInterrupt:
        logger.warning("Interrupted by user")
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    main()
