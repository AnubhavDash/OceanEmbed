# This Dockerfile is deliberately outside the web-app root so it does not replace
# the managed Node deployment. Build it for the separate AWS preprocessing worker.
FROM python:3.11-slim AS opencv-builder
ARG OPENCV_VERSION=5.0.0
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git pkg-config libjpeg-dev libpng-dev libtiff-dev \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch ${OPENCV_VERSION} https://github.com/opencv/opencv.git /src/opencv \
    && cmake -S /src/opencv -B /src/opencv/build -D CMAKE_BUILD_TYPE=Release -D BUILD_opencv_python3=ON -D BUILD_TESTS=OFF -D BUILD_PERF_TESTS=OFF -D BUILD_EXAMPLES=OFF \
    && cmake --build /src/opencv/build --target install -j2

FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=opencv-builder /usr/local /usr/local
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY healthcheck.py ./
RUN python -c "import cv2; assert cv2.__version__.startswith('5.'), cv2.__version__"
CMD ["python", "healthcheck.py"]
