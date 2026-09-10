# ── Stage 1: Build Frontend ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install clean dependencies
RUN npm ci

# Copy full application code
COPY . .

# Build production bundle with Vite
RUN npm run build

# ── Stage 2: Serve with Nginx ──
FROM nginx:alpine AS runner

# Copy custom Nginx configuration with SPA fallback
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production bundle from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
