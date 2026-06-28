"""
Deep Network Scraper
Recursively scrapes followings of followings to discover all Armenians

Strategy:
1. Start with seed user
2. Get their followings
3. For each following:
   - Check first 5 pages (~100 followings)
   - If NO Armenians found → DROP user (not Armenian network)
   - If Armenians found → Save them and queue for expansion
4. Process queue recursively to cover entire Armenian network
"""

import sys
import io
import time
from loguru import logger
from app.database import db, ThreadsUser, RejectedUser
from app.threads_api import threads_api
from app.simple_armenian_filter import simple_armenian_filter
from app.config import Config

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Setup logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <level>{message}</level>",
    level="INFO"
)
logger.add(
    Config.LOGS_DIR / "deep_scraper.log",
    rotation="50 MB",
    retention="30 days",
    level="DEBUG"
)


class DeepNetworkScraper:
    """Recursively scrape Armenian network"""

    def __init__(self, max_followers_threshold: int = 25000,
                 min_pages_to_check: int = 5):
        """
        Args:
            max_followers_threshold: Reject users with more followers
            min_pages_to_check: Check this many pages before dropping (100 users if 20/page)
        """
        self.max_followers_threshold = max_followers_threshold
        self.min_pages_to_check = min_pages_to_check
        self.min_followings_to_check = min_pages_to_check * 20  # ~100 users

    def is_user_exists(self, username: str) -> bool:
        """Check if user exists in database"""
        with db.get_session() as session:
            return session.query(ThreadsUser).filter(
                ThreadsUser.username == username
            ).first() is not None

    def is_rejected(self, username: str) -> bool:
        """Check if user is rejected"""
        with db.get_session() as session:
            return session.query(RejectedUser).filter(
                RejectedUser.username == username
            ).first() is not None

    def save_rejected_user(self, username: str, reason: str, follower_count: int, source: str):
        """Save rejected user"""
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
        except Exception as e:
            if "Duplicate entry" not in str(e):
                logger.error(f"Error saving rejected user {username}: {e}")

    def download_profile_photo(self, username: str, photo_url: str) -> str:
        """Download profile photo"""
        if not photo_url:
            return None

        try:
            import requests
            file_path = Config.PROFILES_DIR / f"{username}.jpg"
            if file_path.exists():
                return str(file_path)

            response = requests.get(photo_url, timeout=30)
            if response.status_code == 200:
                with open(file_path, 'wb') as f:
                    f.write(response.content)
                return str(file_path)
        except Exception as e:
            logger.debug(f"Error downloading photo for {username}: {e}")
        return None

    def save_armenian_user(self, user_data: dict, source_username: str) -> bool:
        """
        Save Armenian user to database

        Returns:
            True if saved, False if already exists/rejected
        """
        username = user_data.get('username')
        if not username:
            return False

        # Skip if exists or rejected
        if self.is_user_exists(username):
            return False
        if self.is_rejected(username):
            return False

        # Check follower count
        follower_count = user_data.get('follower_count', 0)
        if follower_count > self.max_followers_threshold:
            self.save_rejected_user(username, 'too_many_followers',
                                   follower_count, source_username)
            return False

        # Check if Armenian
        result = simple_armenian_filter.classify(user_data)
        if not result['is_armenian']:
            return False

        # Download profile photo
        profile_photo_path = self.download_profile_photo(
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
                    source_username=source_username
                )
                session.add(user)
                session.commit()
                logger.info(f"✓ Saved @{username} (from @{source_username})")
                return True
        except Exception as e:
            if "Duplicate entry" not in str(e):
                logger.error(f"Error saving {username}: {e}")
        return False

    def analyze_user_followings(self, username: str) -> dict:
        """
        Analyze first N followings to determine if user is in Armenian network

        Returns:
            {
                'has_armenian_network': bool,
                'armenian_count': int,
                'total_checked': int,
                'saved_count': int,
                'should_drop': bool
            }
        """
        logger.info(f"Analyzing @{username}'s followings...")

        result = {
            'has_armenian_network': False,
            'armenian_count': 0,
            'total_checked': 0,
            'saved_count': 0,
            'should_drop': False
        }

        try:
            # Fetch first N followings
            followings = []

            def collect_batch(batch):
                followings.extend(batch)

            threads_api.get_user_following(
                username,
                limit=self.min_followings_to_check,
                callback=collect_batch
            )

            if not followings:
                logger.warning(f"@{username}: No followings found")
                result['should_drop'] = True
                return result

            result['total_checked'] = len(followings)

            # Check each following for Armenian
            for following_data in followings:
                following_username = following_data.get('username')
                if not following_username:
                    continue

                # Classify as Armenian
                user_data = {
                    'username': following_username,
                    'full_name': following_data.get('full_name', ''),
                    'biography': following_data.get('biography', ''),
                }

                classification = simple_armenian_filter.classify(user_data)

                if classification['is_armenian']:
                    result['armenian_count'] += 1

                    # Save Armenian user
                    if self.save_armenian_user(following_data, username):
                        result['saved_count'] += 1

            # Determine if user has Armenian network
            if result['armenian_count'] > 0:
                result['has_armenian_network'] = True
                armenian_ratio = result['armenian_count'] / result['total_checked']
                logger.info(
                    f"@{username}: ✓ Armenian network detected "
                    f"({result['armenian_count']}/{result['total_checked']} = {armenian_ratio:.1%}), "
                    f"saved {result['saved_count']} new users"
                )
            else:
                result['should_drop'] = True
                logger.info(
                    f"@{username}: ✗ NO Armenians in first {result['total_checked']} followings → DROPPING"
                )

            return result

        except Exception as e:
            logger.error(f"Error analyzing @{username}: {e}")
            result['should_drop'] = True
            return result

    def get_pending_users(self, limit: int = 100) -> list:
        """
        Get users that need their followings analyzed

        Returns users with status='user_saved' (not yet expanded)
        """
        with db.get_session() as session:
            users = session.query(ThreadsUser).filter(
                ThreadsUser.status == 'user_saved'
            ).limit(limit).all()

            return [{
                'username': u.username,
                'follower_count': u.follower_count,
                'source': u.source_username
            } for u in users]

    def mark_user_processed(self, username: str, has_armenian_network: bool):
        """Mark user as processed"""
        with db.get_session() as session:
            user = session.query(ThreadsUser).filter(
                ThreadsUser.username == username
            ).first()

            if user:
                user.status = 'completed'
                session.commit()

    def run(self, seed_username: str, max_iterations: int = 1000, batch_size: int = 50):
        """
        Run deep network scraper

        Args:
            seed_username: Starting user
            max_iterations: Maximum expansion iterations
            batch_size: How many users to process per iteration
        """

        print("=" * 80)
        print("DEEP NETWORK SCRAPER")
        print("=" * 80)
        print()
        print(f"Starting from: @{seed_username}")
        print(f"Strategy:")
        print(f"  • Check first {self.min_followings_to_check} followings per user")
        print(f"  • If NO Armenians found → DROP user")
        print(f"  • If Armenians found → Save & queue for expansion")
        print(f"  • Expand recursively through Armenian network")
        print()
        print("=" * 80)
        print()

        db.connect()

        # Initialize with seed user
        logger.info(f"Initializing with seed user @{seed_username}...")
        seed_result = self.analyze_user_followings(seed_username)

        print()
        print(f"Seed analysis:")
        print(f"  Found: {seed_result['armenian_count']} Armenians")
        print(f"  Saved: {seed_result['saved_count']} new users")
        print()
        print("=" * 80)
        print()

        # Main expansion loop
        stats = {
            'iterations': 0,
            'users_processed': 0,
            'users_dropped': 0,
            'total_saved': seed_result['saved_count'],
        }

        for iteration in range(1, max_iterations + 1):
            stats['iterations'] = iteration

            # Get pending users
            pending = self.get_pending_users(batch_size)

            if not pending:
                logger.info("No more pending users to process")
                break

            print(f"\nIteration {iteration}:")
            print(f"  Processing {len(pending)} users...")
            print()

            # Process each user
            iteration_saved = 0
            iteration_dropped = 0

            for i, user_info in enumerate(pending, 1):
                username = user_info['username']

                print(f"  [{i}/{len(pending)}] @{username}")

                # Analyze followings
                result = self.analyze_user_followings(username)

                if result['should_drop']:
                    # Drop user (no Armenian network)
                    self.save_rejected_user(
                        username,
                        'no_armenian_network',
                        user_info['follower_count'],
                        user_info['source']
                    )
                    iteration_dropped += 1
                    stats['users_dropped'] += 1

                    # Remove from threads_users
                    with db.get_session() as session:
                        session.query(ThreadsUser).filter(
                            ThreadsUser.username == username
                        ).delete()
                        session.commit()

                else:
                    # User has Armenian network, mark as processed
                    self.mark_user_processed(username, True)
                    iteration_saved += result['saved_count']
                    stats['total_saved'] += result['saved_count']

                stats['users_processed'] += 1

                # Rate limiting
                time.sleep(0.5)

            # Iteration summary
            print()
            print(f"Iteration {iteration} complete:")
            print(f"  Processed: {len(pending)} users")
            print(f"  Dropped: {iteration_dropped} users (no Armenian network)")
            print(f"  Saved: {iteration_saved} new Armenian users")
            print(f"  Total saved: {stats['total_saved']}")
            print()
            print("=" * 80)

        # Final summary
        print()
        print("=" * 80)
        print("DEEP SCRAPING COMPLETE")
        print("=" * 80)
        print()
        print(f"Iterations:         {stats['iterations']}")
        print(f"Users processed:    {stats['users_processed']}")
        print(f"Users dropped:      {stats['users_dropped']}")
        print(f"Total Armenians:    {stats['total_saved']}")
        print()

        # Show final database stats
        with db.get_session() as session:
            total_users = session.query(ThreadsUser).count()
            pending_users = session.query(ThreadsUser).filter(
                ThreadsUser.status == 'user_saved'
            ).count()
            completed = session.query(ThreadsUser).filter(
                ThreadsUser.status == 'completed'
            ).count()
            rejected = session.query(RejectedUser).count()

            print(f"Database stats:")
            print(f"  Total users:        {total_users}")
            print(f"  Pending expansion:  {pending_users}")
            print(f"  Completed:          {completed}")
            print(f"  Rejected:           {rejected}")
            print()
            print("=" * 80)


def main():
    """Main entry point"""
    Config.ensure_dirs()

    seed = sys.argv[1] if len(sys.argv) > 1 else 'n_m.yan'
    max_iterations = int(sys.argv[2]) if len(sys.argv) > 2 else 1000
    batch_size = int(sys.argv[3]) if len(sys.argv) > 3 else 50

    scraper = DeepNetworkScraper()
    scraper.run(seed, max_iterations, batch_size)


if __name__ == "__main__":
    main()
