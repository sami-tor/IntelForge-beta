"""
Production scraper - Full scraping with all safety features
"""

import sys
import time
from loguru import logger
from sqlalchemy import func

from app.config import Config
from app.database import db, ThreadsUser, ScrapeQueue
from app.scraper import scraper
from app.threads_api import threads_api

# Setup logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    Config.LOGS_DIR / "production.log",
    rotation="50 MB",
    retention="30 days",
    level="DEBUG"
)


# PRODUCTION SETTINGS
SEED_USERNAME = "n_m.yan"  # User whose following list to scrape
MAX_FOLLOWERS_THRESHOLD = 25000  # Skip users with more than this many followers
SCRAPE_ALL = True  # Set to False to limit scraping for testing


def print_banner():
    """Print production banner"""
    logger.info("=" * 80)
    logger.info("THREADS FACE RECOGNITION - PRODUCTION SCRAPER")
    logger.info("=" * 80)
    logger.info(f"Seed User: @{SEED_USERNAME}")
    logger.info(f"Max Followers Threshold: {MAX_FOLLOWERS_THRESHOLD:,}")
    logger.info(f"Scrape Mode: {'ALL USERS' if SCRAPE_ALL else 'LIMITED'}")
    logger.info("=" * 80)


def get_stats():
    """Get current scraping statistics"""
    with db.get_session() as session:
        total_users = session.query(ThreadsUser).count()
        users_with_centroids = session.query(ThreadsUser).filter(
            ThreadsUser.centroid_embedding.isnot(None)
        ).count()

        pending = session.query(ScrapeQueue).filter(
            ScrapeQueue.status == 'pending'
        ).count()

        processing = session.query(ScrapeQueue).filter(
            ScrapeQueue.status == 'processing'
        ).count()

        completed = session.query(ScrapeQueue).filter(
            ScrapeQueue.status == 'completed'
        ).count()

        failed = session.query(ScrapeQueue).filter(
            ScrapeQueue.status == 'failed'
        ).count()

        skipped = session.query(ScrapeQueue).filter(
            ScrapeQueue.status == 'skipped'
        ).count()

        return {
            'total_users': total_users,
            'users_with_centroids': users_with_centroids,
            'queue_pending': pending,
            'queue_processing': processing,
            'queue_completed': completed,
            'queue_failed': failed,
            'queue_skipped': skipped,
            'queue_total': pending + processing + completed + failed + skipped
        }


def print_stats(stats):
    """Print statistics"""
    logger.info("-" * 80)
    logger.info("STATISTICS")
    logger.info("-" * 80)
    logger.info(f"Database Users: {stats['total_users']}")
    logger.info(f"Users with Centroids: {stats['users_with_centroids']}")
    logger.info(f"Queue Total: {stats['queue_total']}")
    logger.info(f"  - Pending: {stats['queue_pending']}")
    logger.info(f"  - Processing: {stats['queue_processing']}")
    logger.info(f"  - Completed: {stats['queue_completed']}")
    logger.info(f"  - Failed: {stats['queue_failed']}")
    logger.info(f"  - Skipped: {stats['queue_skipped']}")
    logger.info("-" * 80)


def seed_queue():
    """Seed the queue from following list - writes to DB while fetching"""
    logger.info(f"Fetching @{SEED_USERNAME}'s following list and adding to queue...")

    added = 0
    skipped_exists = 0
    skipped_high_followers = 0

    def process_batch(users_batch):
        """Process each batch of users immediately"""
        nonlocal added, skipped_exists, skipped_high_followers

        for user in users_batch:
            username = user.get('username')
            if not username:
                continue

            # Check follower count immediately
            follower_count = user.get('follower_count', 0)
            if follower_count > MAX_FOLLOWERS_THRESHOLD:
                logger.debug(f"Skipping @{username}: {follower_count:,} followers (>{MAX_FOLLOWERS_THRESHOLD:,})")
                skipped_high_followers += 1
                continue

            try:
                with db.get_session() as session:
                    # Check if already in queue
                    existing_queue = session.query(ScrapeQueue).filter(
                        ScrapeQueue.username == username
                    ).first()

                    if existing_queue:
                        skipped_exists += 1
                        continue

                    # Add to queue
                    queue_item = ScrapeQueue(username=username, status='pending')
                    session.add(queue_item)
                    session.commit()
                    added += 1

                    if added % 10 == 0:
                        logger.info(f"Added {added} users to queue...")

            except Exception as e:
                # Skip duplicates silently
                if "Duplicate entry" in str(e):
                    skipped_exists += 1
                else:
                    logger.error(f"Error adding {username} to queue: {e}")

    # Fetch with callback - DB writes happen during API calls
    limit = 10000 if SCRAPE_ALL else 50
    threads_api.get_user_following(SEED_USERNAME, limit, callback=process_batch)

    logger.info(f"Added {added} new users to queue")
    logger.info(f"Skipped {skipped_exists} users (already in queue)")
    logger.info(f"Skipped {skipped_high_followers} users (>{MAX_FOLLOWERS_THRESHOLD:,} followers)")

    return added


def should_scrape_user(username: str) -> tuple[bool, str]:
    """
    Check if user should be scraped

    Returns:
        (should_scrape, reason)
    """
    # Check if already scraped successfully
    with db.get_session() as session:
        user = session.query(ThreadsUser).filter(
            ThreadsUser.username == username
        ).first()

        if user and user.centroid_embedding is not None:
            return False, "already_scraped"

    # Get user details to check follower count
    user_data = threads_api.get_user_details(username)

    if not user_data:
        return False, "api_error"

    follower_count = user_data.get('follower_count', 0)

    # Skip if too many followers
    if follower_count > MAX_FOLLOWERS_THRESHOLD:
        logger.info(f"Skipping @{username}: {follower_count:,} followers (>{MAX_FOLLOWERS_THRESHOLD:,})")
        return False, f"too_many_followers_{follower_count}"

    return True, "ok"


def process_queue_with_filtering():
    """Process queue with filtering logic"""
    logger.info("Starting queue processing with filtering...")

    with db.get_session() as session:
        # Get all pending items
        pending_items = session.query(ScrapeQueue).filter(
            ScrapeQueue.status == 'pending'
        ).order_by(ScrapeQueue.id).all()

        # Extract data before closing session
        pending_data = []
        for item in pending_items:
            pending_data.append({
                'id': item.id,
                'username': item.username
            })

    if not pending_data:
        logger.info("No pending users in queue")
        return

    logger.info(f"Found {len(pending_data)} pending users")

    processed = 0
    skipped = 0
    failed = 0
    save_interval = 10  # Save FAISS index every 10 users

    for item_data in pending_data:
        username = item_data['username']
        queue_id = item_data['id']

        try:
            # Mark as processing
            with db.get_session() as session:
                queue_item = session.query(ScrapeQueue).get(queue_id)
                if queue_item:
                    queue_item.status = 'processing'
                    session.commit()

            # Check if should scrape
            should_scrape, reason = should_scrape_user(username)

            if not should_scrape:
                logger.info(f"Skipping @{username}: {reason}")

                with db.get_session() as session:
                    queue_item = session.query(ScrapeQueue).get(queue_id)
                    if queue_item:
                        queue_item.status = 'skipped'
                        queue_item.error_message = reason
                        session.commit()

                skipped += 1
                continue

            # Scrape the user
            logger.info(f"Scraping @{username}...")
            success = scraper.scrape_user(username)

            # Update queue status
            with db.get_session() as session:
                queue_item = session.query(ScrapeQueue).get(queue_id)
                if queue_item:
                    if success:
                        queue_item.status = 'completed'
                        queue_item.error_message = None
                        processed += 1
                        logger.info(f"✓ Successfully scraped @{username}")

                        # Save FAISS index periodically
                        if processed % save_interval == 0:
                            logger.info(f"Saving FAISS index ({processed} users processed)...")
                            from app.faiss_index import faiss_index
                            faiss_index.save()
                    else:
                        queue_item.status = 'failed'
                        queue_item.error_message = "scraping_failed"
                        failed += 1
                        logger.warning(f"✗ Failed to scrape @{username}")

                    session.commit()

            # Small delay to avoid rate limiting
            time.sleep(1)

        except KeyboardInterrupt:
            logger.warning("Interrupted by user")
            raise
        except Exception as e:
            logger.error(f"Error processing @{username}: {e}")

            with db.get_session() as session:
                queue_item = session.query(ScrapeQueue).get(queue_id)
                if queue_item:
                    queue_item.status = 'failed'
                    queue_item.error_message = str(e)[:500]
                    session.commit()

            failed += 1
            time.sleep(2)  # Longer delay after error

    logger.info("=" * 80)
    logger.info(f"Queue processing complete:")
    logger.info(f"  Processed: {processed}")
    logger.info(f"  Skipped: {skipped}")
    logger.info(f"  Failed: {failed}")
    logger.info("=" * 80)


def main():
    """Main production scraper"""
    print_banner()

    # Ensure directories exist
    Config.ensure_dirs()

    # Connect to database
    logger.info("Connecting to database...")
    db.connect()
    db.create_tables()

    # Show initial stats
    stats = get_stats()
    print_stats(stats)

    # Seed queue if needed
    if stats['queue_total'] == 0:
        logger.info("Queue is empty, seeding from following list...")
        seed_queue()
    else:
        logger.info(f"Queue already has {stats['queue_total']} users")
        response = input("Reseed queue? (y/n): ")
        if response.lower() == 'y':
            seed_queue()

    # Show updated stats
    stats = get_stats()
    print_stats(stats)

    # Confirm start
    logger.info("=" * 80)
    logger.info("Ready to start scraping!")
    logger.info("=" * 80)

    if stats['queue_pending'] == 0:
        logger.warning("No pending users to scrape")
        return

    # Process queue
    try:
        process_queue_with_filtering()

        # Rebuild FAISS index
        logger.info("Rebuilding FAISS index...")
        from app.faiss_index import faiss_index
        faiss_index.rebuild_from_db(db)

        # Final stats
        stats = get_stats()
        print_stats(stats)

        logger.info("=" * 80)
        logger.info("PRODUCTION SCRAPING COMPLETE!")
        logger.info("=" * 80)

    except KeyboardInterrupt:
        logger.warning("Scraping interrupted by user")
        logger.info("Progress has been saved. Run again to resume.")
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("Scraper interrupted")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        sys.exit(1)
