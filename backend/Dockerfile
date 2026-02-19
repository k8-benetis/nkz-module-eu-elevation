# ==============================================================================
# Nekazari 3D Elevation Worker (GDAL 3.x + Python 3.12)
# ==============================================================================
# Use official OSGeo GDAL image as base (Ubuntu-based) to guarantee C++ dependencies
FROM osgeo/gdal:ubuntu-small-latest

# Prevent tzdata prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install Python 3.12 and build tools for C++ extensions (tinytiles/quantized-mesh-encoder)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.12 \
    python3.12-dev \
    python3.12-venv \
    python3-pip \
    build-essential \
    curl \
    git \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Set default python
RUN ln -s /usr/bin/python3.12 /usr/bin/python

# Create working directory
WORKDIR /app

# Upgrade pip to latest
RUN python -m pip install --upgrade pip setuptools wheel

# Install Python dependencies (including quantized-mesh-encoder which needs C++ compilation)
# Note: GDAL Python bindings must match the system GDAL version exactly
# The osgeo base image provides system GDAL. We install the matching python binding.
RUN GDAL_VERSION=$(gdal-config --version) && \
    pip install "GDAL==${GDAL_VERSION}"

# Copy requirements and install
COPY requirements.txt .
RUN pip install -r requirements.txt

# --- Optimizations for GIS Processing ---
# Maximum cache for GDAL (Adjust dynamically at runtime if possible, e.g. 50-70% of RAM)
ENV GDAL_CACHEMAX=2048
# Force GDAL to use multiple cores where possible
ENV GDAL_NUM_THREADS=ALL_CPUS
# Quiet logging for GDAL unless error
ENV CPL_DEBUG=OFF
# S3 Configuration fallbacks
ENV AWS_S3_ENDPOINT=minio:9000
ENV AWS_HTTPS=NO

# Copy application code
COPY ./app /app/app

# The worker entrypoint (Celery or custom queue consumer)
CMD ["python", "-m", "app.worker"]
