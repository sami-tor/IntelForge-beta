"""
Configuration loader for threads-face-core
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


class Config:
    """Application configuration"""

    # RapidAPI
    RAPIDAPI_KEY = os.getenv('RAPIDAPI_KEY')
    RAPIDAPI_HOST = 'threadsscraper.p.rapidapi.com'

    # Telegram
    TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

    # MySQL
    MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))
    MYSQL_USER = os.getenv('MYSQL_USER')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD')
    MYSQL_DATABASE = os.getenv('MYSQL_DATABASE')

    # Paths
    PROFILES_DIR = BASE_DIR / 'profiles'
    PHOTOS_DIR = BASE_DIR / 'threads-photos'
    # Use ASCII-only path for FAISS (avoid Cyrillic characters issue)
    FAISS_DIR = Path('C:/threads-face-data/faiss')
    LOGS_DIR = BASE_DIR / 'logs'

    # Face detection settings
    FACE_DETECTION_MODEL = 'retinaface_r50_v1'
    FACE_RECOGNITION_MODEL = 'glint360k_r100'
    FACE_SIMILARITY_THRESHOLD = 0.40
    MAX_PHOTOS_PER_USER = 20

    # GPU settings
    USE_GPU = True
    GPU_ID = 0

    # FAISS settings
    FAISS_INDEX_TYPE = 'IndexFlatIP'  # Inner Product (cosine similarity)

    @classmethod
    def ensure_dirs(cls):
        """Create necessary directories"""
        cls.PROFILES_DIR.mkdir(exist_ok=True)
        cls.PHOTOS_DIR.mkdir(exist_ok=True)
        cls.FAISS_DIR.mkdir(parents=True, exist_ok=True)
        cls.LOGS_DIR.mkdir(exist_ok=True)

    @classmethod
    def get_db_url(cls):
        """Get SQLAlchemy database URL"""
        return f"mysql+pymysql://{cls.MYSQL_USER}:{cls.MYSQL_PASSWORD}@{cls.MYSQL_HOST}:{cls.MYSQL_PORT}/{cls.MYSQL_DATABASE}"


# Ensure directories exist
Config.ensure_dirs()
