"""
Stage 3: Expand network - get followings of already scraped users
- Takes completed users from database (Level 1)
- Gets their followings and adds to database (Level 2)
- Can be run multiple times for deeper expansion
"""

import sys
import time
import requests
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
    Config.LOGS_DIR / "expand_network.log",
    rotation="50 MB",
    retention="30 days",
    level="DEBUG"
)

# Settings
MAX_FOLLOWERS_THRESHOLD = 25000
FOLLOWINGS_LIMIT = 1000  # Max followings to fetch per user


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


def save_rejected_user(username: str, reason: str, follower_count: int, source: str):
    """Save user to rejected_users table"""
    try:
        with db.get_session() as session:
            existing = session.query(RejectedUser).filter(
                RejectedUser.username == username
            ).first()
            if existing:
                return

            rejected = RejectedUser(
                username=username,
                reason=reason,
                follower_count=follower_count,
                source_username=source
            )
            session.add(rejected)
            session.commit()
    except Exception as e:
        if "Duplicate entry" not in str(e):
            logger.error(f"Error saving rejected user {username}: {e}")


def save_user(user_data: dict, source_username: str) -> bool:
    """Save user to threads_users table"""
    username = user_data.get('username')
    if not username:
        return False

    follower_count = user_data.get('follower_count', 0)

    # Download profile photo
    profile_photo_path = download_profile_photo(
        username,
        user_data.get('profile_pic_url')
    )

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
            return True
    except Exception as e:
        if "Duplicate entry" not in str(e):
            logger.error(f"Error saving user {username}: {e}")
        return False


def get_completed_users(limit: int = None) -> list:
    """Get users with status='completed' for expansion"""
    with db.get_session() as session:
        query = session.query(ThreadsUser).filter(
            ThreadsUser.status == 'completed'
        ).order_by(ThreadsUser.id)

        if limit:
            query = query.limit(limit)

        users = query.all()
        return [{'id': u.id, 'username': u.username} for u in users]


def mark_user_expanded(user_id: int):
    """Mark user as expanded (we could add a column for this if needed)"""
    # For now, we just track by checking if we've processed their followings
    pass


def expand_user_network(username: str) -> dict:
    """
    Get followings of a user and add new users to database

    Returns:
        Statistics dict
    """
    stats = {
        'total_fetched': 0,
        'saved': 0,
        'skipped_exists': 0,
        'rejected': 0
    }

    def process_batch(users_batch):
        """Process each batch of users"""
        for user_data in users_batch:
            stats['total_fetched'] += 1
            uname = user_data.get('username')
            if not uname:
                continue

            follower_count = user_data.get('follower_count', 0)

            # Check follower threshold
            if follower_count > MAX_FOLLOWERS_THRESHOLD:
                if not is_rejected(uname):
                    save_rejected_user(uname, 'too_many_followers', follower_count, username)
                stats['rejected'] += 1
                continue

            # Check if exists
            if is_user_exists(uname):
                stats['skipped_exists'] += 1
                continue

            if is_rejected(uname):
                stats['rejected'] += 1
                continue

            # Save user
            if save_user(user_data, username):
                stats['saved'] += 1

    # Fetch followings with callback
    threads_api.get_user_following(username, FOLLOWINGS_LIMIT, callback=process_batch)

    return stats


def expand_all(limit: int = None):
    """Expand network for all completed users"""
    # Get completed users
    completed_users = get_completed_users(limit)

    if not completed_users:
        logger.info("No completed users to expand")
        return

    logger.info(f"Found {len(completed_users)} users to expand")

    total_stats = {
        'users_expanded': 0,
        'total_fetched': 0,
        'saved': 0,
        'skipped_exists': 0,
        'rejected': 0
    }

    for user_data in completed_users:
        username = user_data['username']

        logger.info(f"Expanding network for @{username}...")

        try:
            stats = expand_user_network(username)

            total_stats['users_expanded'] += 1
            total_stats['total_fetched'] += stats['total_fetched']
            total_stats['saved'] += stats['saved']
            total_stats['skipped_exists'] += stats['skipped_exists']
            total_stats['rejected'] += stats['rejected']

            logger.info(f"  @{username}: fetched {stats['total_fetched']}, saved {stats['saved']}, rejected {stats['rejected']}")

            # Rate limit
            time.sleep(1)

        except KeyboardInterrupt:
            logger.warning("Interrupted by user")
            raise
        except Exception as e:
            logger.error(f"Error expanding @{username}: {e}")

    # Final stats
    logger.info(f"=" * 80)
    logger.info(f"EXPANSION COMPLETE")
    logger.info(f"=" * 80)
    logger.info(f"Users expanded:    {total_stats['users_expanded']}")
    logger.info(f"Total fetched:     {total_stats['total_fetched']}")
    logger.info(f"New users saved:   {total_stats['saved']}")
    logger.info(f"Skipped (exists):  {total_stats['skipped_exists']}")
    logger.info(f"Rejected:          {total_stats['rejected']}")
    logger.info(f"=" * 80)


def get_stats():
    """Get current database statistics"""
    with db.get_session() as session:
        total = session.query(ThreadsUser).count()
        user_saved = session.query(ThreadsUser).filter(ThreadsUser.status == 'user_saved').count()
        completed = session.query(ThreadsUser).filter(ThreadsUser.status == 'completed').count()
        rejected = session.query(RejectedUser).count()

        return {
            'total': total,
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
    stats = get_stats()
    logger.info(f"Current DB stats:")
    logger.info(f"  Total users:     {stats['total']}")
    logger.info(f"  Pending (Stage2): {stats['user_saved']}")
    logger.info(f"  Completed:       {stats['completed']}")
    logger.info(f"  Rejected:        {stats['rejected']}")

    if stats['completed'] == 0:
        logger.info("No completed users to expand. Run process_faces.py first.")
        return

    # Get limit from command line
    limit = None
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
            logger.info(f"Expanding limit: {limit} users")
        except ValueError:
            pass

    # Expand network
    try:
        expand_all(limit)

        # Final stats
        stats = get_stats()
        logger.info(f"Final DB stats:")
        logger.info(f"  Total users:     {stats['total']}")
        logger.info(f"  Pending (Stage2): {stats['user_saved']}")
        logger.info(f"  Completed:       {stats['completed']}")
        logger.info(f"  Rejected:        {stats['rejected']}")

    except KeyboardInterrupt:
        logger.warning("Interrupted")
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    main()
