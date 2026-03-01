# ── Backend ─────────────────────────────────────────────────────
FROM python:3.12-slim AS backend

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

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


# ── Production image (single process — FastAPI serves everything) ──
FROM python:3.12-slim AS production

WORKDIR /app

# Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Copy built frontend into /app/static (FastAPI serves via StaticFiles)
COPY --from=frontend-build /app/dist /app/static

ENV STATIC_DIR=/app/static
ENV APP_ENV=production
ENV APP_DEBUG=false

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
