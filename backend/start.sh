#!/bin/bash

# Script de inicio para el servidor
# Copia la base de datos inicial solo si no existe en el volumen

DATA_DIR="/data"
DB_FILE="$DATA_DIR/correspondencia.db"
INITIAL_DB="/app/correspondencia.db.initial"
UPLOADS_DIR="$DATA_DIR/uploads"

# Crear directorios de datos si no existen
mkdir -p $DATA_DIR
mkdir -p $UPLOADS_DIR

# Si no existe la base de datos en el volumen, copiar la inicial
if [ ! -f "$DB_FILE" ]; then
    echo "Base de datos no encontrada en $DB_FILE"
    if [ -f "$INITIAL_DB" ]; then
        echo "Copiando base de datos inicial..."
        cp "$INITIAL_DB" "$DB_FILE"
        echo "Base de datos copiada exitosamente"
    else
        echo "No hay base de datos inicial, se creará una nueva"
    fi
else
    echo "Base de datos existente encontrada en $DB_FILE"
fi

# Iniciar el servidor
echo "Iniciando servidor..."
cd /app/backend
exec uvicorn main:app --host 0.0.0.0 --port 8000
