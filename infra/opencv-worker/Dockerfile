# OceanEmbed Worker Dockerfile
# Multi-stage build: OpenCV 5 + PyTorch + ONNX Runtime
# Used for both preprocessing (OpenCV) and inference (ONNX Runtime)

# === Stage 1: OpenCV 5 builder ===
FROM python:3.11-slim AS opencv-builder
ARG OPENCV_VERSION=5.0.0
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git pkg-config libjpeg-dev libpng-dev libtiff-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch ${OPENCV_VERSION} https://github.com/opencv/opencv.git /src/opencv \
    && cmake -S /src/opencv -B /src/opencv/build -D CMAKE_BUILD_TYPE=Release -D BUILD_opencv_python3=ON -D BUILD_TESTS=OFF -D BUILD_PERF_TESTS=OFF -D BUILD_EXAMPLES=OFF \
    && cmake --build /src/opencv/build --target install -j2

# === Stage 2: PyTorch + inference runtime ===
FROM python:3.11-slim AS inference-runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy OpenCV from builder
COPY --from=opencv-builder /usr/local /usr/local

# Install PyTorch (CPU) + ONNX Runtime + dependencies
RUN pip install --no-cache-dir \
    torch==2.13.0+cpu torchvision==0.28.0+cpu --index-url https://download.pytorch.org/whl/cpu \
    onnxruntime numpy xarray zarr netcdf4 scipy scikit-learn pandas matplotlib \
    flask flask-cors

WORKDIR /app

# Copy model files
COPY model/ /app/model/
COPY infra/opencv-worker/inference_server.py /app/inference_server.py
COPY infra/opencv-worker/preprocess_worker.py /app/preprocess_worker.py
COPY infra/opencv-worker/requirements.txt /app/requirements.txt

# Install additional requirements
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

# Verify OpenCV 5
RUN python -c "import cv2; assert cv2.__version__.startswith('5.'), cv2.__version__"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import cv2; print(cv2.__version__)" || exit 1

EXPOSE 8080

# Default: run inference server
CMD ["python", "inference_server.py"]
