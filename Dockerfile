# Stage 1: Build frontend
FROM node:20-slim AS build-frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy built frontend into static/ directory
COPY --from=build-frontend /app/frontend/dist ./static/

ENV PORT=8080
EXPOSE 8080

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
