# ============================================================================
# Synthesis Engine Backend — Production Docker Image
# Multi-stage build: separate build and runtime stages for minimal image size
# ============================================================================

# ----------------------------------------------------------------------------
# STAGE 1: Builder
# ----------------------------------------------------------------------------
FROM node:20 AS builder

WORKDIR /app

# Enable pnpm via corepack (Node.js 20+)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install build dependencies for native modules (node-gyp, sweph)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy ephemeris data files (required for Swiss Ephemeris professional mode)
COPY ephemeris/ ./ephemeris/

# Copy Prisma schema and generate client
COPY prisma/ ./prisma/
RUN pnpm prisma generate

# Copy source code and build
COPY . .
RUN pnpm build

# ----------------------------------------------------------------------------
# STAGE 2: Production
# ----------------------------------------------------------------------------
FROM node:20-slim AS production

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install minimal runtime dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests and install production deps only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy ephemeris data files
COPY --from=builder /app/ephemeris/ ./ephemeris/

# Copy built application and Prisma schema, generate client locally
COPY --from=builder /app/dist/ ./dist/
COPY prisma/ ./prisma/
RUN npx -y prisma@5.22.0 generate

# Non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
RUN chown -R appuser:appgroup /app
USER appuser

# Production environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

EXPOSE 3000

CMD ["node", "dist/index.js"]
