# ── Backend ─────────────────────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]" 2>/dev/null || pip install --no-cache-dir .

COPY backend/ ./backend/

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]


# ── Frontend build ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build


# ── Production image (Nginx serves frontend, proxies /api → backend) ──
FROM python:3.12-slim AS production

WORKDIR /app

# Install nginx
RUN apt-get update && apt-get install -y --no-install-recommends nginx && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Nginx config to proxy /api to uvicorn
RUN echo 'server { \n\
    listen 80; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        try_files $uri $uri/ /index.html; \n\
    } \n\
    location /api { \n\
        proxy_pass http://127.0.0.1:8000; \n\
        proxy_set_header Host $host; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
    } \n\
    location /docs { \n\
        proxy_pass http://127.0.0.1:8000; \n\
    } \n\
    location /health { \n\
        proxy_pass http://127.0.0.1:8000; \n\
    } \n\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD service nginx start && uvicorn backend.main:app --host 0.0.0.0 --port 8000
