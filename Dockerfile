# Multi-stage Dockerfile for ÖZARA Staging & Production
# Stage 1: Build Mobile Web Client (iOS / React Native Expo export)
FROM node:22-bookworm-slim AS mobile-builder
WORKDIR /app/mobile
COPY mobile/package*.json ./
RUN npm ci --prefer-offline --no-audit
COPY mobile/ ./
RUN npx expo export --platform web

# Stage 2: Production Server
FROM node:22-bookworm-slim
WORKDIR /app

# Install C++ build tools for native addons (better-sqlite3), Python 3, pip, and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    python3-pip \
    python3-pil \
    sqlite3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install root Node.js dependencies
COPY package*.json ./
RUN npm ci --no-audit --omit=dev

# Copy application source
COPY server.js ./
COPY ozara.db sila.db ./
COPY public/ ./public/
COPY tools/ ./tools/
COPY DesignGuidline/ ./DesignGuidline/
COPY architecture/ ./architecture/
COPY storage/ ./storage/

# Copy compiled mobile web bundle from builder stage into mobile/dist
COPY --from=mobile-builder /app/mobile/dist ./mobile/dist

# Create persistent storage directories
RUN mkdir -p /app/data /app/storage/catalog/cards /app/storage/catalog/full /app/storage/catalog/thumb /app/storage/telegram_media /app/.tmp

# Environment defaults for Staging
ENV NODE_ENV=staging
ENV PORT=3000
ENV DATABASE_DIR=/app/data
ENV STORAGE_DIR=/app/storage
ENV SUPPRESS_EMAIL_NOTIFICATIONS=false
ENV SERVE_MOBILE_AS_ROOT=true

# Expose HTTP port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/intro-pics || exit 1

# Start server
CMD ["node", "server.js"]
