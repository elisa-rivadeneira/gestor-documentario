"""
API REST para Sistema de Gestión de Correspondencia Institucional
FastAPI + SQLite + Claude IA
"""
import os
import re
import shutil
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
import pdfplumber

from database import engine, get_db, Base
from models import Documento, Adjunto
from schemas import (
    DocumentoCreate, DocumentoUpdate, DocumentoResponse, DocumentoListResponse,
    AdjuntoCreate, AdjuntoResponse, AnalisisIARequest, AnalisisIAResponse
)
from services.ia_service import ia_service, extraer_numero_con_ocr, OCR_DISPONIBLE

# Crear tablas en la base de datos
Base.metadata.create_all(bind=engine)

# Crear aplicación FastAPI
app = FastAPI(
    title="Sistema de Gestión de Correspondencia",
    description="MVP para gestión de oficios y cartas institucionales",
    version="1.0.0"
)

# Configurar CORS para permitir frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio para archivos subidos
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Montar directorio de uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ============================================
# ENDPOINTS DE DOCUMENTOS
# ============================================

@app.get("/api/documentos", response_model=DocumentoListResponse)
def listar_documentos(
    tipo_documento: Optional[str] = Query(None, description="Filtrar por tipo: oficio, carta"),
    direccion: Optional[str] = Query(None, description="Filtrar por dirección: recibido, enviado"),
    busqueda: Optional[str] = Query(None, description="Búsqueda en título, asunto, remitente, destinatario"),
    ordenar_por: Optional[str] = Query(None, description="Ordenar por: numero, fecha"),
    pagina: int = Query(1, ge=1, description="Número de página"),
    por_pagina: int = Query(20, ge=1, le=100, description="Documentos por página"),
    db: Session = Depends(get_db)
):
    """
    Lista documentos con filtros opcionales y paginación.
    Retorna bandeja unificada de correspondencia.
    """
    query = db.query(Documento)

    # Aplicar filtros
    if tipo_documento:
        query = query.filter(Documento.tipo_documento == tipo_documento)
    if direccion:
        query = query.filter(Documento.direccion == direccion)
    if busqueda:
        busqueda_like = f"%{busqueda}%"
        query = query.filter(
            or_(
                Documento.titulo.ilike(busqueda_like),
                Documento.asunto.ilike(busqueda_like),
                Documento.remitente.ilike(busqueda_like),
                Documento.destinatario.ilike(busqueda_like),
                Documento.numero.ilike(busqueda_like)
            )
        )

    # Contar total
    total = query.count()

    # Aplicar ordenamiento según parámetro
    if ordenar_por == 'fecha':
        # Ordenar por fecha del documento y luego por fecha de subida (más recientes primero)
        documentos = query.order_by(
            Documento.fecha.desc().nullslast(),
            Documento.created_at.desc()
        ).offset((pagina - 1) * por_pagina)\
            .limit(por_pagina)\
            .all()
    else:
        # Ordenar por año y correlativo (más nuevos primero) - default para oficios y cartas nemaec
        documentos = query.order_by(
            Documento.anio_oficio.desc().nullslast(),
            Documento.correlativo_oficio.desc().nullslast(),
            Documento.created_at.desc()
        ).offset((pagina - 1) * por_pagina)\
            .limit(por_pagina)\
            .all()

    return DocumentoListResponse(
        documentos=documentos,
        total=total,
        pagina=pagina,
        por_pagina=por_pagina
    )


@app.post("/api/documentos", response_model=DocumentoResponse, status_code=201)
def crear_documento(
    documento: DocumentoCreate,
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo documento (oficio o carta).
    """
    # Validar que no exista un documento con el mismo número
    if documento.numero:
        existente = db.query(Documento).filter(Documento.numero == documento.numero).first()
        if existente:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un documento con el número {documento.numero}"
            )

    # Validar documento padre si se especifica
    if documento.documento_padre_id:
        padre = db.query(Documento).filter(Documento.id == documento.documento_padre_id).first()
        if not padre:
            raise HTTPException(status_code=404, detail="Documento padre no encontrado")

    # Extraer año y correlativo para ordenamiento
    anio_oficio = None
    correlativo_oficio = None
    if documento.numero:
        import re
        match_correlativo = re.search(r'(\d{3,6})', documento.numero)
        correlativo_oficio = int(match_correlativo.group(1)) if match_correlativo else None
        match_anio = re.search(r'(202[4-9])', documento.numero)
        anio_oficio = int(match_anio.group(1)) if match_anio else None

    db_documento = Documento(
        **documento.model_dump(),
        anio_oficio=anio_oficio,
        correlativo_oficio=correlativo_oficio
    )
    db.add(db_documento)
    db.commit()
    db.refresh(db_documento)
    return db_documento


@app.get("/api/documentos/{documento_id}", response_model=DocumentoResponse)
def obtener_documento(documento_id: int, db: Session = Depends(get_db)):
    """
    Obtiene un documento por su ID con todos sus adjuntos.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return documento


@app.put("/api/documentos/{documento_id}", response_model=DocumentoResponse)
def actualizar_documento(
    documento_id: int,
    documento_update: DocumentoUpdate,
    db: Session = Depends(get_db)
):
    """
    Actualiza un documento existente.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Actualizar campos proporcionados
    update_data = documento_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(documento, field, value)

    documento.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(documento)
    return documento


@app.delete("/api/documentos/{documento_id}", status_code=204)
def eliminar_documento(documento_id: int, db: Session = Depends(get_db)):
    """
    Elimina un documento y sus adjuntos.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Eliminar archivo local si existe
    if documento.archivo_local:
        archivo_path = os.path.join(UPLOAD_DIR, documento.archivo_local)
        if os.path.exists(archivo_path):
            os.remove(archivo_path)

    db.delete(documento)
    db.commit()
    return None


@app.get("/api/documentos/{documento_id}/respuestas", response_model=List[DocumentoResponse])
def obtener_respuestas(documento_id: int, db: Session = Depends(get_db)):
    """
    Obtiene las cartas enviadas como respuesta a un documento.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    respuestas = db.query(Documento).filter(
        Documento.documento_padre_id == documento_id
    ).all()

    return respuestas


# ============================================
# ENDPOINTS DE ARCHIVOS
# ============================================

@app.post("/api/documentos/{documento_id}/archivo")
async def subir_archivo(
    documento_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Sube un archivo PDF a un documento existente.
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    # Validar tipo de archivo
    if not archivo.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    # Generar nombre único
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"{documento_id}_{timestamp}_{archivo.filename}"
    ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

    # Guardar archivo
    with open(ruta_archivo, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    # Actualizar documento
    documento.archivo_local = nombre_archivo
    documento.updated_at = datetime.utcnow()
    db.commit()

    return {
        "mensaje": "Archivo subido exitosamente",
        "archivo": nombre_archivo,
        "ruta": f"/uploads/{nombre_archivo}"
    }


@app.post("/api/subir-temporal")
async def subir_archivo_temporal(archivo: UploadFile = File(...)):
    """
    Sube un archivo temporalmente para análisis antes de crear el documento.
    """
    if not archivo.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    # Generar nombre único temporal
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"temp_{timestamp}_{archivo.filename}"
    ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

    # Guardar archivo
    with open(ruta_archivo, "wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    return {
        "mensaje": "Archivo subido temporalmente",
        "archivo": nombre_archivo,
        "ruta": f"/uploads/{nombre_archivo}"
    }


# ============================================
# ENDPOINTS DE ANÁLISIS IA
# ============================================

@app.post("/api/analizar-ia", response_model=AnalisisIAResponse)
async def analizar_con_ia(request: AnalisisIARequest):
    """
    Analiza texto con IA y genera título, asunto y resumen.
    Recibe texto directamente.
    """
    if not request.texto:
        raise HTTPException(status_code=400, detail="Se requiere texto para analizar")

    resultado = ia_service.analizar_documento(request.texto)
    return AnalisisIAResponse(**resultado)


@app.post("/api/analizar-archivo/{nombre_archivo}", response_model=AnalisisIAResponse)
async def analizar_archivo_con_ia(nombre_archivo: str):
    """
    Extrae texto de un PDF y lo analiza con IA.
    Usa OCR como fallback si no se puede extraer el número de oficio.
    """
    ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

    if not os.path.exists(ruta_archivo):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # Extraer texto del PDF
    try:
        texto = extraer_texto_pdf(ruta_archivo)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error al leer PDF: {str(e)}")

    if not texto or len(texto.strip()) < 50:
        return AnalisisIAResponse(
            numero_oficio="",
            fecha="",
            remitente="",
            destinatario="",
            asunto="",
            resumen="",
            exito=False,
            mensaje="No se pudo extraer suficiente texto del PDF"
        )

    # Agregar el nombre del archivo al inicio del texto para ayudar a la IA
    # El nombre del archivo suele contener el número de oficio
    nombre_original = nombre_archivo.split('_', 3)[-1] if '_' in nombre_archivo else nombre_archivo
    texto_con_nombre = f"NOMBRE DEL ARCHIVO: {nombre_original}\n\n{texto}"

    # Detectar si necesitamos OCR prioritario:
    # 1. Nombre de archivo corto de Windows (contiene ~)
    # 2. El texto tiene "OFICIO N°" pero sin número visible (ej: "OFICIO N° -2026")
    nombre_es_corto_windows = '~' in nombre_original
    texto_sin_numero_encabezado = bool(re.search(r'OFICIO\s*N[°º]?\s*-\s*\d{4}', texto, re.IGNORECASE))

    necesita_ocr_prioritario = nombre_es_corto_windows or texto_sin_numero_encabezado

    # Si necesitamos OCR prioritario y está disponible, extraer número con OCR primero
    numero_ocr = ""
    if necesita_ocr_prioritario and OCR_DISPONIBLE:
        print(f"Nombre corto Windows o texto sin número en encabezado detectado, usando OCR prioritario...")
        numero_ocr = extraer_numero_con_ocr(ruta_archivo)
        print(f"OCR encontró: '{numero_ocr}'")

    # Analizar con IA
    resultado = ia_service.analizar_documento(texto_con_nombre)

    # Si OCR prioritario encontró un número, usarlo (tiene prioridad sobre la IA)
    if numero_ocr:
        resultado["numero_oficio"] = numero_ocr
        resultado["mensaje_whatsapp"] = f"{numero_ocr}\nAsunto: {resultado.get('asunto', '')}\nResumen: {resultado.get('resumen', '')}"
        resultado["mensaje"] = "Análisis completado (número extraído con OCR)"
    else:
        # Verificar si el número de oficio tiene el formato correcto
        # Acepta 5-6 dígitos para oficios O 3 dígitos para cartas NEMAEC
        numero_actual = resultado.get("numero_oficio", "")
        es_nemaec = "NEMAEC" in numero_actual.upper()
        tiene_numero_valido = bool(re.search(r'\d{5,6}', numero_actual)) or (es_nemaec and bool(re.search(r'\d{3}', numero_actual)))

        # Si no se encontró número válido y OCR está disponible, intentar con OCR
        if not tiene_numero_valido and OCR_DISPONIBLE:
            print(f"Número de oficio incompleto o no encontrado: '{numero_actual}', intentando OCR...")
            numero_ocr = extraer_numero_con_ocr(ruta_archivo)
            if numero_ocr:
                resultado["numero_oficio"] = numero_ocr
                # Actualizar mensaje WhatsApp con el número encontrado por OCR
                resultado["mensaje_whatsapp"] = f"{numero_ocr}\nAsunto: {resultado.get('asunto', '')}\nResumen: {resultado.get('resumen', '')}"
                resultado["mensaje"] = "Análisis completado (número extraído con OCR)"

    return AnalisisIAResponse(**resultado)


def extraer_texto_pdf(ruta: str) -> str:
    """
    Extrae texto de un archivo PDF usando pdfplumber (mejor extracción).
    """
    texto = ""
    with pdfplumber.open(ruta) as pdf:
        for page in pdf.pages:
            texto += page.extract_text() or ""
    return texto


# ============================================
# ENDPOINTS DE ADJUNTOS
# ============================================

@app.post("/api/documentos/{documento_id}/adjuntos", response_model=AdjuntoResponse)
async def agregar_adjunto(
    documento_id: int,
    archivo: UploadFile = File(None),
    enlace_drive: str = Query(None),
    nombre: str = Query(None),
    db: Session = Depends(get_db)
):
    """
    Agrega un adjunto a un documento (archivo o enlace Drive).
    """
    documento = db.query(Documento).filter(Documento.id == documento_id).first()
    if not documento:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    adjunto_data = {"documento_id": documento_id}

    if archivo:
        # Subir archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        nombre_archivo = f"adj_{documento_id}_{timestamp}_{archivo.filename}"
        ruta_archivo = os.path.join(UPLOAD_DIR, nombre_archivo)

        with open(ruta_archivo, "wb") as buffer:
            shutil.copyfileobj(archivo.file, buffer)

        adjunto_data["archivo_local"] = nombre_archivo
        adjunto_data["nombre"] = nombre or archivo.filename
    elif enlace_drive:
        adjunto_data["enlace_drive"] = enlace_drive
        adjunto_data["nombre"] = nombre or "Enlace Drive"
    else:
        raise HTTPException(status_code=400, detail="Se requiere archivo o enlace Drive")

    adjunto = Adjunto(**adjunto_data)
    db.add(adjunto)
    db.commit()
    db.refresh(adjunto)
    return adjunto


@app.delete("/api/adjuntos/{adjunto_id}", status_code=204)
def eliminar_adjunto(adjunto_id: int, db: Session = Depends(get_db)):
    """
    Elimina un adjunto.
    """
    adjunto = db.query(Adjunto).filter(Adjunto.id == adjunto_id).first()
    if not adjunto:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")

    # Eliminar archivo si existe
    if adjunto.archivo_local:
        ruta = os.path.join(UPLOAD_DIR, adjunto.archivo_local)
        if os.path.exists(ruta):
            os.remove(ruta)

    db.delete(adjunto)
    db.commit()
    return None


# ============================================
# ENDPOINT DE SALUD
# ============================================

@app.get("/api/health")
def health_check():
    """Verificar estado del servidor"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ============================================
# SERVIR FRONTEND
# ============================================

# Directorio del frontend
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

# Montar archivos estáticos del frontend (CSS, JS)
if os.path.exists(FRONTEND_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(FRONTEND_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(FRONTEND_DIR, "js")), name="js")

@app.get("/")
async def serve_frontend():
    """Servir el frontend"""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend no encontrado", "api_docs": "/docs"}


# ============================================
# PUNTO DE ENTRADA
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
