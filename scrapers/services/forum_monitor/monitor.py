import feedparser
import psycopg2
import time
import os
import logging
import hashlib
from datetime import datetime
from dateutil import parser as date_parser
import re

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Support DATABASE_URL for easy connection string configuration
# Format: postgresql://user:password@host:port/database
# Falls back to individual env vars for Docker/legacy setups
def get_db_config():
    db_url = os.getenv('DATABASE_URL', '')
    if db_url and '://' in db_url:
        import urllib.parse
        try:
            parsed = urllib.parse.urlparse(db_url)
            return {
                'host': parsed.hostname or 'localhost',
                'port': parsed.port or 5432,
                'database': parsed.path.lstrip('/') or 'intelforge',
                'user': parsed.username or 'intelforge',
                'password': parsed.password or ''
            }
        except Exception:
            pass
    # Fall back to individual env vars
    return {
        'host': os.getenv('POSTGRES_HOST', 'localhost'),
        'port': int(os.getenv('POSTGRES_PORT', '5432')),
        'database': os.getenv('POSTGRES_DB', 'intelforge'),
        'user': os.getenv('POSTGRES_USER', 'intelforge'),
        'password': os.getenv('POSTGRES_PASSWORD', '')
    }

DB_CONFIG = get_db_config()

RSS_FEEDS = [
    {
        'url': 'https://leakbase.la/forums/-/index.rss',
        'forum_type': 'xenforo',
        'forum_name': 'leakbase.la'
    },
    {
        'url': 'https://nulled.to/feed.php',
        'forum_type': 'xf2',
        'forum_name': 'nulled.to'
    },
    {
        'url': 'https://exploit.la/feed.php',
        'forum_type': 'xf2',
        'forum_name': 'exploit.la'
    },
]

CHECK_INTERVAL = int(os.getenv('CHECK_INTERVAL', 300))


def get_db_connection():
    """Create database connection"""
    return psycopg2.connect(**DB_CONFIG)


def init_database():
    """Initialize database table for forum threads"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
        CREATE TABLE IF NOT EXISTS forum_threads (
            id SERIAL PRIMARY KEY,
            thread_id VARCHAR(255) UNIQUE NOT NULL,
            forum_name VARCHAR(255) NOT NULL,
            forum_type VARCHAR(50) NOT NULL,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            author VARCHAR(255),
            published_date TIMESTAMP,
            content TEXT,
            is_public BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_forum_threads_forum_name 
        ON forum_threads(forum_name)
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_forum_threads_published_date 
        ON forum_threads(published_date DESC)
    """)
    
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_forum_threads_is_public 
        ON forum_threads(is_public)
    """)
    
    conn.commit()
    cur.close()
    conn.close()
    
    logger.info("Database initialized successfully")


def generate_thread_id(link, title):
    """Generate unique thread ID from link and title"""
    data = f"{link}_{title}".encode('utf-8')
    return hashlib.sha256(data).hexdigest()[:32]


def extract_content(entry):
    """Extract content from RSS entry"""
    content = None
    is_public = False
    
    if hasattr(entry, 'summary'):
        content = entry.summary
    elif hasattr(entry, 'description'):
        content = entry.description
    elif hasattr(entry, 'content'):
        if isinstance(entry.content, list) and len(entry.content) > 0:
            content = entry.content[0].get('value', '')
    
    if content:
        content = re.sub(r'<[^>]+>', '', content)
        content = content.strip()
        
        login_patterns = [
            r'you need to sign in',
            r'you must be logged in',
            r'login to view',
            r'register to see',
            r'to view the content',
            r'access restricted'
        ]
        
        has_login_requirement = any(
            re.search(pattern, content, re.IGNORECASE) 
            for pattern in login_patterns
        )
        
        if not has_login_requirement and len(content) > 50:
            is_public = True
    
    return content, is_public


def parse_date(date_string):
    """Parse date string to datetime object"""
    try:
        if hasattr(date_string, 'timetuple'):
            return datetime(*date_string.timetuple()[:6])
        return date_parser.parse(date_string)
    except Exception as e:
        logger.warning(f"Failed to parse date '{date_string}': {e}")
        return None


def save_thread(feed_config, entry):
    """Save or update thread in database"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        link = entry.get('link', '')
        title = entry.get('title', 'No Title')
        
        thread_id = generate_thread_id(link, title)
        
        author = entry.get('author', None)
        published_date = parse_date(entry.get('published', None))
        
        content, is_public = extract_content(entry)
        
        cur.execute("""
            INSERT INTO forum_threads 
            (thread_id, forum_name, forum_type, title, link, author, 
             published_date, content, is_public, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (thread_id) 
            DO UPDATE SET
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                is_public = EXCLUDED.is_public,
                updated_at = NOW()
        """, (
            thread_id,
            feed_config['forum_name'],
            feed_config['forum_type'],
            title,
            link,
            author,
            published_date,
            content,
            is_public
        ))
        
        conn.commit()
        
        logger.info(f"Saved thread: {title[:60]}... | Public: {is_public}")
        
    except Exception as e:
        logger.error(f"Failed to save thread: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()


def monitor_feed(feed_config):
    """Monitor a single RSS feed"""
    try:
        logger.info(f"Fetching feed: {feed_config['forum_name']}")
        
        feed = feedparser.parse(feed_config['url'])
        
        if feed.bozo:
            logger.warning(f"Feed parse warning for {feed_config['forum_name']}: {feed.bozo_exception}")
        
        if not feed.entries:
            logger.warning(f"No entries found in feed: {feed_config['forum_name']}")
            return
        
        logger.info(f"Found {len(feed.entries)} entries in {feed_config['forum_name']}")
        
        for entry in feed.entries:
            save_thread(feed_config, entry)
        
        logger.info(f"Completed monitoring {feed_config['forum_name']}")
        
    except Exception as e:
        logger.error(f"Failed to monitor feed {feed_config['forum_name']}: {e}")


def monitor_all_feeds():
    """Monitor all configured RSS feeds"""
    logger.info("Starting feed monitoring cycle")
    
    for feed_config in RSS_FEEDS:
        monitor_feed(feed_config)
        time.sleep(2)
    
    logger.info("Completed feed monitoring cycle")


def main():
    logger.info("Forum RSS Monitor starting...")
    
    time.sleep(10)
    
    try:
        init_database()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        logger.info("Retrying in 10 seconds...")
        time.sleep(10)
        init_database()
    
    logger.info(f"Monitoring {len(RSS_FEEDS)} RSS feeds every {CHECK_INTERVAL} seconds")
    
    while True:
        try:
            monitor_all_feeds()
        except Exception as e:
            logger.error(f"Error in monitoring cycle: {e}")
        
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
