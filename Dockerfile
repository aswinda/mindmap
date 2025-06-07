# Multi-stage Docker build for Mindmap Application
# Stage 1: Build the TypeScript application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Install TypeScript globally for build
RUN npm install -g typescript

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Stage 2: Production runtime
FROM nginx:alpine AS runtime

# Set maintainer
LABEL maintainer="Mindmap App Developer"
LABEL description="Interactive TypeScript-based mindmap application"
LABEL version="1.0.0"

# Copy built application files
COPY --from=builder /app/dist/ /usr/share/nginx/html/dist/
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY README.md /usr/share/nginx/html/

# Create custom nginx configuration
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \
    echo '    server_name localhost;' >> /etc/nginx/conf.d/default.conf && \
    echo '    root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    index index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    ' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Enable gzip compression' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip on;' >> /etc/nginx/conf.d/default.conf && \
    echo '    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;' >> /etc/nginx/conf.d/default.conf && \
    echo '    ' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Security headers' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-Frame-Options DENY;' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-Content-Type-Options nosniff;' >> /etc/nginx/conf.d/default.conf && \
    echo '    add_header X-XSS-Protection "1; mode=block";' >> /etc/nginx/conf.d/default.conf && \
    echo '    ' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Handle SPA routing' >> /etc/nginx/conf.d/default.conf && \
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '    ' >> /etc/nginx/conf.d/default.conf && \
    echo '    # Cache static assets' >> /etc/nginx/conf.d/default.conf && \
    echo '    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {' >> /etc/nginx/conf.d/default.conf && \
    echo '        expires 1y;' >> /etc/nginx/conf.d/default.conf && \
    echo '        add_header Cache-Control "public, immutable";' >> /etc/nginx/conf.d/default.conf && \
    echo '    }' >> /etc/nginx/conf.d/default.conf && \
    echo '}' >> /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
