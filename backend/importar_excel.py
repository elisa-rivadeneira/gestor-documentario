"""
Script para importar oficios desde Excel a la base de datos
"""
import pandas as pd
import re
from datetime import datetime
from database import SessionLocal, engine
from models import Documento, Base

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

def normalizar_numero_oficio(numero):
    """Normaliza el formato del número de oficio"""
    if pd.isna(numero):
        return ""

    numero = str(numero).strip()

    # Si ya tiene el formato correcto, devolverlo
    if "OFICIO N°" in numero:
        return numero

    # Convertir OFICIO-000291-2025-UGPE a OFICIO N°000291-2025-MIDIS/FONCODES/UGPE
    match = re.match(r'OFICIO[- ]*(\d+)[- ]*(\d{4})[- ]*UGPE', numero, re.IGNORECASE)
    if match:
        num = match.group(1).zfill(6)  # Asegurar 6 dígitos
        anio = match.group(2)
        return f"OFICIO N°{num}-{anio}-MIDIS/FONCODES/UGPE"

    # Otro formato: OFICIO N° 000295-2025-MIDIS/FONCODES/UGPE
    numero = numero.replace("OFICIO N°", "OFICIO N°").replace("  ", " ")

    return numero

def extraer_anio_correlativo(numero_oficio):
    """Extrae el año y correlativo del número de oficio para ordenamiento"""
    if not numero_oficio:
        return None, None

    # Buscar patrón de correlativo (5-6 dígitos)
    match_correlativo = re.search(r'(\d{5,6})', numero_oficio)
    correlativo = int(match_correlativo.group(1)) if match_correlativo else None

    # Buscar año (2024, 2025, 2026)
    match_anio = re.search(r'(202[4-9])', numero_oficio)
    anio = int(match_anio.group(1)) if match_anio else None

    return anio, correlativo

def importar_excel():
    """Importa los oficios del Excel a la base de datos"""

    # Leer Excel
    excel_path = r'c:\Users\NEERIVADENEIRA\Documents\NEMAEC\GESTION DOCUMENTARIA NEMAEC.xlsx'
    df = pd.read_excel(excel_path)

    print(f"Leyendo {len(df)} registros del Excel...")

    # Crear sesión de base de datos
    db = SessionLocal()

    importados = 0
    actualizados = 0
    errores = 0

    try:
        for index, row in df.iterrows():
            try:
                numero_oficio = normalizar_numero_oficio(row['OFICIO'])

                # Verificar si ya existe
                existente = db.query(Documento).filter(
                    Documento.numero == numero_oficio
                ).first()

                # Procesar fecha
                fecha = None
                if pd.notna(row['FECHA ENVIO']):
                    if isinstance(row['FECHA ENVIO'], datetime):
                        fecha = row['FECHA ENVIO']
                    else:
                        try:
                            fecha = pd.to_datetime(row['FECHA ENVIO'])
                        except:
                            pass

                # Limpiar texto (caracteres especiales)
                asunto = str(row['ASUNTO']) if pd.notna(row['ASUNTO']) else ""
                resumen = str(row['RESUMEN']) if pd.notna(row['RESUMEN']) else ""

                if existente:
                    # Actualizar registro existente
                    existente.asunto = asunto
                    existente.resumen = resumen
                    if fecha:
                        existente.fecha = fecha
                    existente.titulo = numero_oficio
                    actualizados += 1
                    print(f"  Actualizado: {numero_oficio}")
                else:
                    # Crear nuevo registro
                    nuevo_doc = Documento(
                        tipo_documento="oficio",
                        direccion="recibido",
                        numero=numero_oficio,
                        titulo=numero_oficio,
                        fecha=fecha,
                        asunto=asunto,
                        resumen=resumen
                    )
                    db.add(nuevo_doc)
                    importados += 1
                    print(f"  Importado: {numero_oficio}")

            except Exception as e:
                errores += 1
                print(f"  Error en fila {index + 1}: {e}")

        # Guardar cambios
        db.commit()

        print("\n" + "=" * 50)
        print(f"RESUMEN DE IMPORTACIÓN:")
        print(f"  - Nuevos importados: {importados}")
        print(f"  - Actualizados: {actualizados}")
        print(f"  - Errores: {errores}")
        print(f"  - Total procesados: {importados + actualizados + errores}")
        print("=" * 50)

    except Exception as e:
        db.rollback()
        print(f"Error general: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    importar_excel()
