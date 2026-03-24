FROM oven/bun:1.2-alpine AS builder

WORKDIR /app

# Copy monorepo structure (only what server needs)
COPY package.json turbo.json bun.lock ./
COPY packages/server/package.json ./packages/server/
COPY packages/core/package.json ./packages/core/
COPY packages/shared/package.json ./packages/shared/

RUN bun install --frozen-lockfile

COPY packages/server ./packages/server
COPY packages/core ./packages/core
COPY packages/shared ./packages/shared
COPY tsconfig.base.json ./

RUN cd packages/server && bun build src/index.ts --outdir dist --target bun

# --- Runtime stage ---
FROM oven/bun:1.2-alpine

WORKDIR /app

COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/migrations ./migrations

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 3001

CMD ["bun", "dist/index.js"]