# ============================================================================
# Synthesis Engine Backend — Production Docker Image
# Multi-stage build: separate build and runtime stages for minimal image size
#
# Build variants (Phase D — deployment separation):
#   Standard (default, sweph-free — astronomia/Meeus ephemeris only):
#     docker build -t synthesis-backend .
#   Professional (native sweph module + Swiss Ephemeris .se1 data files,
#   EPHEMERIS_PRO_ENABLED=true baked in):
#     docker build --build-arg WITH_SWEPH=true -t synthesis-backend-pro .
#
# Verify a standard image is sweph-free:
#   docker run --rm synthesis-backend sh -c "test ! -d node_modules/sweph"
# ============================================================================

# Build variant switch. Declared before the first FROM so it can also select
# the ephemeris-data stage the production image copies from (ephe-true /
# ephe-false below). Values: "true" | "false".
ARG WITH_SWEPH=false

# ----------------------------------------------------------------------------
# STAGE 1: Builder
# ----------------------------------------------------------------------------
FROM node:20 AS builder
ARG WITH_SWEPH

WORKDIR /app

# Enable pnpm via corepack (Node.js 20+)
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Build tools (python3/make/g++) are only needed to compile the native sweph
# module via node-gyp — skipped entirely for the standard (sweph-free) build.
RUN if [ "$WITH_SWEPH" = "true" ]; then \
      apt-get update && apt-get install -y \
        python3 \
        make \
        g++ \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./
# sweph is an optionalDependency, so --no-optional (pnpm 9) leaves it out of
# the standard build entirely — no native module, no download, no node-gyp.
RUN if [ "$WITH_SWEPH" = "true" ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install --frozen-lockfile --no-optional; \
    fi

# Copy Prisma schema and generate client
COPY prisma/ ./prisma/
RUN pnpm prisma generate

# Copy source code and build
COPY . .
RUN pnpm build

# ----------------------------------------------------------------------------
# Ephemeris data selector
# The production stage copies from ephe-${WITH_SWEPH}: the professional image
# gets the Swiss Ephemeris .se1 data files, the standard image gets an empty
# directory (kept so the COPY itself succeeds; the app never reads it because
# EPHEMERIS_PRO_ENABLED=false and the resolver only consults SwephProvider
# when the flag is on).
# ----------------------------------------------------------------------------
FROM node:20-slim AS ephe-true
WORKDIR /app
COPY ephemeris/ ./ephemeris/

FROM node:20-slim AS ephe-false
WORKDIR /app
RUN mkdir -p ./ephemeris

# ----------------------------------------------------------------------------
# STAGE 2: Production
# ----------------------------------------------------------------------------
FROM node:20-slim AS production
ARG WITH_SWEPH

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Runtime build tools are only needed for the native sweph module; the
# standard image ships without them (slimmer, smaller attack surface).
RUN if [ "$WITH_SWEPH" = "true" ]; then \
      apt-get update && apt-get install -y \
        python3 \
        make \
        g++ \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# Copy dependency manifests and install production deps only
# (--no-optional keeps sweph out of the standard image)
COPY package.json pnpm-lock.yaml ./
RUN if [ "$WITH_SWEPH" = "true" ]; then \
      pnpm install --prod --frozen-lockfile; \
    else \
      pnpm install --prod --frozen-lockfile --no-optional; \
    fi

# Copy ephemeris data files (professional image only — see selector stages)
COPY --from=ephe-${WITH_SWEPH} /app/ephemeris/ ./ephemeris/

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
# Professional ephemeris tier: 'true' only in the WITH_SWEPH=true build.
# The runtime check is === 'true', so the literal build-arg value maps 1:1.
ENV EPHEMERIS_PRO_ENABLED=${WITH_SWEPH}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

EXPOSE 3000

CMD ["node", "dist/index.js"]
