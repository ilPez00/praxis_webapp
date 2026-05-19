# =============================================================================
# Praxis Webapp — Express backend (Node.js)
# llmwiki is optional: if LLMWIKI_BIN is missing, AxiomWikiSearchService
# falls back to Postgres FTS automatically.
# =============================================================================

FROM node:20-slim

WORKDIR /app

# Create wiki root dir (Railway volume mounts here if configured)
RUN mkdir -p /wiki

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

# Start
COPY scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/node", "dist/index.js"]
