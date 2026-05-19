# =============================================================================
# Praxis Webapp — Multi-stage Dockerfile
# Stage 1: Build llmwiki (Rust binary for semantic wiki search)
# Stage 2: Run Express backend (Node.js)
# =============================================================================

# ── Stage 1: llmwiki builder ────────────────────────────────────────────────
FROM rust:1.88-slim-bookworm AS llmwiki-builder

RUN apt-get update && apt-get install -y \
    pkg-config libssl-dev clang cmake \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install llmwiki --root /usr/local

# ── Stage 2: Express backend ────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Copy llmwiki binary from builder
COPY --from=llmwiki-builder /usr/local/bin/llmwiki /usr/local/bin/llmwiki

# Create wiki root (use Railway volume or fallback to ephemeral)
RUN mkdir -p /wiki && llmwiki init --wiki-root /wiki || true

# Install node dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev deps
RUN npm prune --production

# Environment
ENV NODE_ENV=production
ENV LLMWIKI_BIN=/usr/local/bin/llmwiki

EXPOSE 3001

# Start with wiki MCP server in background
CMD llmwiki serve --wiki-root /wiki --port 8080 & \
    NODE_ENV=production node dist/index.js
