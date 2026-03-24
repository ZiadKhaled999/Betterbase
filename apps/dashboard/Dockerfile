# Dashboard Dockerfile placeholder
# This is a placeholder. The actual dashboard needs to be created first.
# If the dashboard uses Bun instead of npm, replace node:20-alpine with oven/bun:1.2-alpine
# and replace npm install with bun install and npm run build with bun run build

FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/dashboard/package.json apps/dashboard/package-lock.json* ./
RUN npm ci

COPY apps/dashboard ./

# Inject API URL at build time
ARG VITE_API_URL=http://localhost
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# --- Runtime: serve static files with nginx ---
FROM nginx:alpine

# Create non-root user for nginx
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure non-root user can read the html directory
RUN chown -R appuser:appgroup /usr/share/nginx/html && \
    chown -R appuser:appgroup /etc/nginx/conf.d

# SPA routing: serve index.html for all unknown paths
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
}' > /etc/nginx/conf.d/default.conf

# Switch to non-root user
USER appuser

EXPOSE 80