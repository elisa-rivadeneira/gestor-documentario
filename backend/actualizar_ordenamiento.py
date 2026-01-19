"""
Script para actualizar los campos de ordenamiento (anio_oficio, correlativo_oficio)
"""
import re
from database import SessionLocal, engine
from models import Documento, Base

# Crear/actualizar tablas
Base.metadata.create_all(bind=engine)

def extraer_anio_correlativo(numero_oficio):
    """Extrae el año y correlativo del número de oficio para ordenamiento"""
    if not numero_oficio:
        return None, None

    # Buscar patrón de correlativo (3-6 dígitos)
    match_correlativo = re.search(r'(\d{3,6})', numero_oficio)
    correlativo = int(match_correlativo.group(1)) if match_correlativo else None

    # Buscar año (2024, 2025, 2026)
    match_anio = re.search(r'(202[4-9])', numero_oficio)
    anio = int(match_anio.group(1)) if match_anio else None

    return anio, correlativo

def actualizar_ordenamiento():
    """Actualiza los campos de ordenamiento de todos los documentos"""
    db = SessionLocal()

    try:
        documentos = db.query(Documento).all()
        print(f"Actualizando {len(documentos)} documentos...")

        for doc in documentos:
            anio, correlativo = extraer_anio_correlativo(doc.numero)
            doc.anio_oficio = anio
            doc.correlativo_oficio = correlativo
            print(f"  {doc.numero} -> Año: {anio}, Correlativo: {correlativo}")

        db.commit()
        print("\nActualización completada.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    actualizar_ordenamiento()
