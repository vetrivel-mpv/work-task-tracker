# Multi-Stage Dockerfile for Jira-like Agile Workspace
# Stage 1: Build Frontend Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build production bundle with Vite
RUN npm run build

# Stage 2: Production Server Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Production environment settings
ENV NODE_ENV=production
ENV PORT=3000

# Copy package manifests and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy server code and built assets from builder stage
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/permissionMiddleware.js ./permissionMiddleware.js
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist

# Expose service port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the unified Express & Vite static delivery server
CMD ["node", "server.js"]
