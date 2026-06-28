"""
Run scraper entry point
"""

import sys
from loguru import logger

from app.config import Config
from app.database import db
from app.scraper import scraper

# Setup logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    Config.LOGS_DIR / "scraper.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG"
)


def main():
    """Main scraper function"""
    logger.info("=" * 60)
    logger.info("Threads Face Scraper")
    logger.info("=" * 60)

    # Ensure directories exist
    Config.ensure_dirs()

    # Connect to database
    logger.info("Connecting to database...")
    db.connect()

    # Create tables if needed
    db.create_tables()

    # Seed username - this user's following list will be scraped
    SEED_USERNAME = "n_m.yan"  # Change this to any user with public following list
    SEED_LIMIT = 10  # Number of users to scrape (test with 10)

    logger.info(f"Seeding queue from @{SEED_USERNAME}'s following list...")
    scraper.seed_from_following(SEED_USERNAME, SEED_LIMIT)

    logger.info("Starting to process queue...")
    scraper.process_queue(limit=SEED_LIMIT)

    logger.info("=" * 60)
    logger.info("Scraping complete!")
    logger.info("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("Scraper interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        sys.exit(1)
