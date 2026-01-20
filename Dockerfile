# Dockerfile para Sistema de Gestión Documentaria
FROM python:3.11-slim

# Instalar dependencias del sistema para OCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-spa \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Copiar requirements primero (para cache de Docker)
COPY backend/requirements.txt .

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend/ ./backend/

# Copiar frontend
COPY frontend/ ./frontend/

# Copiar base de datos
COPY correspondencia.db ./correspondencia.db

# Crear directorio de uploads
RUN mkdir -p /app/uploads

# Variables de entorno
ENV PYTHONUNBUFFERED=1
ENV UPLOAD_DIR=/app/uploads

# Exponer puerto
EXPOSE 8000

# Comando para iniciar el servidor
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
