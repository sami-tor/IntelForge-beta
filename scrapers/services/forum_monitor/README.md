# Forum RSS Monitor

Monitors XenForo and other forum RSS feeds for new threads, automatically extracting and storing thread metadata.

## Features

- **RSS Feed Monitoring**: Automatically fetches forum threads via RSS
- **Smart Content Detection**: Detects public vs login-required content
- **PostgreSQL Storage**: Stores thread metadata with indexing
- **Duplicate Prevention**: Uses hash-based thread IDs to avoid duplicates
- **Continuous Monitoring**: Runs every 5 minutes (configurable)

## Database Schema

```sql
forum_threads (
    id SERIAL PRIMARY KEY,
    thread_id VARCHAR(255) UNIQUE,
    forum_name VARCHAR(255),
    forum_type VARCHAR(50),
    title TEXT,
    link TEXT,
    author VARCHAR(255),
    published_date TIMESTAMP,
    content TEXT,
    is_public BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

## Configuration

Environment variables:
- `POSTGRES_HOST`: PostgreSQL host (default: postgres)
- `POSTGRES_PORT`: PostgreSQL port (default: 5432)
- `POSTGRES_DB`: Database name (default: intelforge)
- `POSTGRES_USER`: Database user (default: postgres)
- `POSTGRES_PASSWORD`: Database password (default: postgres)
- `CHECK_INTERVAL`: Check interval in seconds (default: 300)

## Usage

### Build and run with Docker Compose:

```bash
cd services/forum_monitor
docker-compose -f docker-compose.forum-monitor.yml up -d
```

### View logs:

```bash
docker logs -f intelforge-forum-monitor
```

### Stop service:

```bash
docker-compose -f docker-compose.forum-monitor.yml down
```

## Adding More Forums

Edit `monitor.py` and add to `RSS_FEEDS` list:

```python
RSS_FEEDS = [
    {
        'url': 'https://leakbase.la/forums/-/index.rss',
        'forum_type': 'xenforo',
        'forum_name': 'leakbase.la'
    },
    {
        'url': 'https://example.com/forums/index.rss',
        'forum_type': 'xenforo',
        'forum_name': 'example.com'
    }
]
```

## Query Examples

```sql
-- Get all public threads
SELECT title, link, published_date 
FROM forum_threads 
WHERE is_public = TRUE 
ORDER BY published_date DESC;

-- Search by keyword
SELECT title, link, author 
FROM forum_threads 
WHERE title ILIKE '%database%' OR content ILIKE '%database%'
ORDER BY published_date DESC;

-- Get threads from specific forum
SELECT title, link, published_date 
FROM forum_threads 
WHERE forum_name = 'leakbase.la' 
ORDER BY published_date DESC;
```
