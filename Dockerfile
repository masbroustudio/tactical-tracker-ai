# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy dependency files
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy source and build static files
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Set up the Python Backend & Serve
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend assets from Stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Run the FastAPI server in backend directory
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
