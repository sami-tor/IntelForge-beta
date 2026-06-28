"""
Run Telegram bot entry point
"""

import sys
from loguru import logger

from app.config import Config
from app.database import db
from app.telegram_bot import telegram_bot

# Setup logging
logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)
logger.add(
    Config.LOGS_DIR / "bot.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG"
)


def main():
    """Main bot function"""
    logger.info("=" * 60)
    logger.info("Threads Face Search Telegram Bot")
    logger.info("=" * 60)

    # Ensure directories exist
    Config.ensure_dirs()

    # Connect to database
    logger.info("Connecting to database...")
    db.connect()

    # Run bot
    telegram_bot.run()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("Bot stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        sys.exit(1)
