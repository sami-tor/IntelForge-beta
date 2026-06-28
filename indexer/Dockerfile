FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# Note: RAR support uses Python rarfile library (works without system unrar for some RAR files)
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    p7zip-full \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    watchdog \
    py7zr \
    rarfile \
    PyPDF2 \
    pdfplumber \
    python-docx \
    openpyxl \
    pytesseract \
    Pillow

COPY indexer.py .
COPY auto-indexer.py .

# Default to auto-indexer (can override in docker-compose)
# Use -u flag for unbuffered output so logs appear immediately
CMD ["python", "-u", "auto-indexer.py"]

