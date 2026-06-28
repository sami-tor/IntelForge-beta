FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (2025 stack)
# Note: build-essential, g++, cmake needed for insightface and uniface compilation
RUN apt-get update && apt-get install -y \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libgthread-2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgcc-s1 \
    build-essential \
    g++ \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
# Install CPU-only PyTorch first
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio

# Install advanced requirements
COPY service/requirements-advanced.txt .
RUN pip install --no-cache-dir -r requirements-advanced.txt

# Copy service files
COPY service/app.py .
# Note: Old processor files removed - using new image_indexer from services/ directory

# Note: lib/ utilities are mounted as volume in docker-compose.yml
# They will be available at runtime via volume mount

# Expose port
EXPOSE 8000

# Run service
CMD ["python", "-u", "app.py"]

