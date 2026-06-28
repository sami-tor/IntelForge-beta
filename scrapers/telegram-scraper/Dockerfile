FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    telethon \
    aiofiles \
    python-socks[asyncio]

# Copy scraper files
COPY telegram_scraper.py .
COPY chat_ids.txt* ./

# Create data directory mount point
RUN mkdir -p /data

# Default command
CMD ["python", "telegram_scraper.py"]

