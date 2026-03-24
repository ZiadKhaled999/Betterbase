# ============================================================================
# Betterbase Monorepo Dockerfile
# 
# This Dockerfile builds the entire Betterbase monorepo including:
# - @betterbase/cli
# - @betterbase/core  
# - @betterbase/client
# - @betterbase/shared
#
# Usage:
#   docker build -t betterbase:local .
#   docker run -p 3000:3000 betterbase:local
# ============================================================================

# ----------------------------------------------------------------------------
# Stage 1: Base
# ----------------------------------------------------------------------------
FROM oven/bun:1.3.9-debian AS base

LABEL maintainer="Betterbase Team"
LABEL description="AI-Native Backend-as-a-Service Platform"

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # For sharp image processing
    vips-tools \
    fftw3 \
    libvips \
    # For PostgreSQL client
    libpq-dev \
    # For build tools
    make \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# ----------------------------------------------------------------------------
# Stage 2: Dependencies
# ----------------------------------------------------------------------------
FROM base AS deps

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy workspace package.json files
COPY packages/cli/package.json packages/cli/
COPY packages/core/package.json packages/core/
COPY packages/client/package.json packages/client/
COPY apps/test-project/package.json apps/test-project/

# Install dependencies
RUN bun install --frozen-lockfile

# ----------------------------------------------------------------------------
# Stage 3: Builder
# ----------------------------------------------------------------------------
FROM deps AS builder

WORKDIR /app

# Copy all source code
COPY packages/ packages/
COPY apps/ apps/

# Build all packages using turbo
RUN bun run build

# ----------------------------------------------------------------------------
# Stage 4: Production Runner
# ----------------------------------------------------------------------------
FROM base AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# Copy package files for production
COPY package.json bun.lock ./
COPY turbo.json ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# Copy built packages from builder
COPY --from=builder /app/packages/core/dist ./node_modules/@betterbase/core/dist
COPY --from=builder /app/packages/cli/dist ./node_modules/@betterbase/cli/dist
COPY --from=builder /app/packages/client/dist ./node_modules/@betterbase/client/dist
COPY --from=builder /app/packages/shared/dist ./node_modules/@betterbase/shared/dist

# Copy source files for runtime (needed for dynamic imports)
COPY --from=builder /app/packages/core/src ./node_modules/@betterbase/core/src
COPY --from=builder /app/packages/cli/src ./node_modules/@betterbase/cli/src
COPY --from=builder /app/packages/client/src ./node_modules/@betterbase/client/src
COPY --from=builder /app/packages/shared/src ./node_modules/@betterbase/shared/src

# Copy package.json files to access exports
COPY packages/core/package.json ./node_modules/@betterbase/core/
COPY packages/cli/package.json ./node_modules/@betterbase/cli/
COPY packages/client/package.json ./node_modules/@betterbase/client/
COPY packages/shared/package.json ./node_modules/@betterbase/shared/

# Switch to non-root user
USER appuser

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Default command (should be overridden by project-specific Dockerfiles)
CMD ["bun", "run", "src/index.ts"]
