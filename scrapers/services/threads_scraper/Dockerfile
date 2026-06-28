FROM python:3.11-slim

WORKDIR /app

# Install system dependencies + build tools
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    g++ \
    cmake \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (insightface and uniface need build tools)
RUN pip install --no-cache-dir \
    requests \
    pillow \
    pymilvus \
    opencv-python-headless \
    insightface \
    uniface \
    onnxruntime \
    psutil \
    minio \
    torch \
    torchvision \
    transformers \
    timm \
    ftfy \
    regex \
    loguru

# Services will be mounted as volume at runtime
# No need to copy - we'll mount ./services:/app/services

CMD ["python", "/app/services/threads_scraper/auto_scraper.py"]

