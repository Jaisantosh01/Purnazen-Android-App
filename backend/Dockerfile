# syntax=docker/dockerfile:1
#
# Production image for the Purnazen FastAPI backend.
#
# Python is pinned to 3.12 because the AI pipeline wheels (mediapipe, opencv,
# scikit-image) are not published for 3.13/3.14 — see requirements.txt.
FROM python:3.12-slim AS base

# System libraries the AI/runtime deps need at import time:
#   libglib2.0-0, libgl1     -> opencv
#   libgles2, libegl1        -> mediapipe (loads libGLESv2.so.2 / libEGL.so.1)
#   libgomp1                 -> onnxruntime / scikit-image (OpenMP)
#   libmagic1                -> python-magic (file-type sniffing)
#   curl                     -> container healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libglib2.0-0 \
        libgl1 \
        libgles2 \
        libegl1 \
        libgomp1 \
        libmagic1 \
        curl \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=5000

WORKDIR /app

# Install deps first so the layer is cached across code-only changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "gunicorn>=23.0"

# App code (see .dockerignore for what is excluded).
COPY . .

# Run as an unprivileged user; ensure the entrypoint is executable regardless of
# the checkout's file mode (Windows checkouts drop the +x bit).
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

# Container-level health signal (Container Apps also probes /health via ingress).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
