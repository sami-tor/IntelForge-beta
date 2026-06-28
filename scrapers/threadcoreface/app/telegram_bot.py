"""
Telegram bot for face search
"""

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from PIL import Image
from io import BytesIO
from loguru import logger

from app.config import Config
from app.search_engine import search_engine
from app.faiss_index import faiss_index
from app.database import db


class TelegramBot:
    """Telegram bot for face search"""

    def __init__(self):
        self.token = Config.TELEGRAM_BOT_TOKEN
        self.app = None

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        welcome_message = (
            "Welcome to Threads Face Search Bot!\n\n"
            "How to use:\n"
            "1. Send me a photo with a face\n"
            "2. I'll search for similar faces in the Threads database\n"
            "3. You'll get the best matches\n\n"
            "Commands:\n"
            "/start - Show this message\n"
            "/stats - Show database statistics\n"
            "/help - Get help"
        )
        await update.message.reply_text(welcome_message)

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        help_message = (
            "Threads Face Search Bot Help\n\n"
            "Simply send a photo containing a face, and I'll search for similar faces "
            "in the Threads profiles database.\n\n"
            "The search uses advanced face recognition technology to find matches based on "
            "facial features.\n\n"
            "Commands:\n"
            "/start - Welcome message\n"
            "/stats - Database statistics\n"
            "/help - This help message"
        )
        await update.message.reply_text(help_message)

    async def stats_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /stats command"""
        try:
            with db.get_session() as session:
                from app.database import ThreadsUser, ThreadsFace

                user_count = session.query(ThreadsUser).count()
                face_count = session.query(ThreadsFace).count()
                indexed_count = faiss_index.get_size()

                stats_message = (
                    f"Database Statistics:\n\n"
                    f"Users: {user_count}\n"
                    f"Face photos: {face_count}\n"
                    f"Indexed users: {indexed_count}"
                )

                await update.message.reply_text(stats_message)

        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            await update.message.reply_text("Error retrieving statistics")

    async def handle_photo(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle photo messages"""
        try:
            await update.message.reply_text("Analyzing photo...")

            # Get photo
            photo = update.message.photo[-1]  # Get highest resolution
            photo_file = await photo.get_file()

            # Download photo
            photo_bytes = await photo_file.download_as_bytearray()
            image = Image.open(BytesIO(photo_bytes)).convert('RGB')

            # Search
            results = search_engine.search_by_image(image, top_k=5)

            if not results:
                await update.message.reply_text(
                    "No matches found. This could mean:\n"
                    "- No face detected in the photo\n"
                    "- No similar faces in the database\n"
                    "- Face similarity below threshold"
                )
                return

            # Send results
            await update.message.reply_text(f"Found {len(results)} match(es):\n")

            for i, result in enumerate(results, 1):
                result_text = (
                    f"{i}. Match found:\n"
                    f"@{result['username']}\n"
                )

                if result.get('full_name'):
                    result_text += f"Name: {result['full_name']}\n"

                result_text += (
                    f"Similarity: {result['similarity']:.2f}\n"
                    f"Face photos: {result['face_count']}\n"
                    f"{result['threads_url']}"
                )

                await update.message.reply_text(result_text)

        except Exception as e:
            logger.error(f"Error handling photo: {e}")
            await update.message.reply_text("Error processing photo")

    async def handle_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle text messages"""
        await update.message.reply_text(
            "Please send a photo with a face to search.\n"
            "Use /help for more information."
        )

    def setup_handlers(self):
        """Setup bot handlers"""
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
        self.app.add_handler(CommandHandler("stats", self.stats_command))
        self.app.add_handler(MessageHandler(filters.PHOTO, self.handle_photo))
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))

        logger.info("Bot handlers setup complete")

    def run(self):
        """Run the bot"""
        logger.info("Starting Telegram bot...")

        # Load FAISS index
        faiss_index.load()

        # Create application
        self.app = Application.builder().token(self.token).build()

        # Setup handlers
        self.setup_handlers()

        # Run bot
        logger.info("Bot is running...")
        self.app.run_polling(allowed_updates=Update.ALL_TYPES)


# Global bot instance
telegram_bot = TelegramBot()
