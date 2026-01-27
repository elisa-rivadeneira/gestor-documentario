"""
Schemas Pydantic para validación de datos de entrada/salida
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TipoDocumentoEnum(str, Enum):
    OFICIO = "oficio"
    CARTA = "carta"


class DireccionEnum(str, Enum):
    RECIBIDO = "recibido"
    ENVIADO = "enviado"


# === Schemas para Adjuntos ===

class AdjuntoBase(BaseModel):
    nombre: str
    enlace_drive: Optional[str] = None
    archivo_local: Optional[str] = None


class AdjuntoCreate(AdjuntoBase):
    pass


class AdjuntoResponse(AdjuntoBase):
    id: int
    documento_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Documentos ===

class DocumentoBase(BaseModel):
    tipo_documento: TipoDocumentoEnum
    direccion: DireccionEnum
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    remitente: Optional[str] = None
    destinatario: Optional[str] = None
    titulo: Optional[str] = None
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None
    documento_padre_id: Optional[int] = None


class DocumentoCreate(DocumentoBase):
    """Schema para crear un nuevo documento"""
    pass


class DocumentoUpdate(BaseModel):
    """Schema para actualizar un documento existente"""
    tipo_documento: Optional[TipoDocumentoEnum] = None
    direccion: Optional[DireccionEnum] = None
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    remitente: Optional[str] = None
    destinatario: Optional[str] = None
    titulo: Optional[str] = None
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None
    documento_padre_id: Optional[int] = None


class DocumentoResponse(DocumentoBase):
    """Schema para respuesta de documento"""
    id: int
    archivo_local: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    adjuntos: List[AdjuntoResponse] = []

    class Config:
        from_attributes = True


class DocumentoListResponse(BaseModel):
    """Schema para lista de documentos con paginación"""
    documentos: List[DocumentoResponse]
    total: int
    pagina: int
    por_pagina: int


# === Schemas para IA ===

class AnalisisIARequest(BaseModel):
    """Request para análisis con IA"""
    texto: Optional[str] = None  # Texto extraído del documento


class AnalisisIAResponse(BaseModel):
    """Respuesta del análisis con IA"""
    numero_oficio: str = Field(default="", description="Número de oficio extraído del documento")
    fecha: str = Field(default="", description="Fecha del documento en formato YYYY-MM-DD")
    remitente: str = Field(default="", description="Remitente del documento")
    destinatario: str = Field(default="", description="Destinatario del documento")
    asunto: str = Field(default="", description="Asunto claro del documento")
    resumen: str = Field(default="", description="Resumen indicando qué solicita y para cuándo")
    mensaje_whatsapp: str = Field(default="", description="Mensaje formateado para compartir por WhatsApp")
    oficio_referencia: str = Field(default="", description="Número del oficio al que responde esta carta")
    exito: bool = True
    mensaje: Optional[str] = None


# === Schema para filtros de búsqueda ===

class DocumentoFiltros(BaseModel):
    tipo_documento: Optional[TipoDocumentoEnum] = None
    direccion: Optional[DireccionEnum] = None
    busqueda: Optional[str] = None
    pagina: int = 1
    por_pagina: int = 20


# === Schemas para Autenticación ===

class LoginRequest(BaseModel):
    """Request para login"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Respuesta del login"""
    token: str
    usuario: str
    nombre: str
    mensaje: str = "Login exitoso"


class UsuarioResponse(BaseModel):
    """Respuesta de usuario (sin password)"""
    id: int
    username: str
    nombre: str
    activo: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Adjuntos de Contrato ===

class AdjuntoContratoBase(BaseModel):
    nombre: str
    enlace_drive: Optional[str] = None
    archivo_local: Optional[str] = None


class AdjuntoContratoCreate(AdjuntoContratoBase):
    pass


class AdjuntoContratoResponse(AdjuntoContratoBase):
    id: int
    contrato_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === Schemas para Contratos ===

class ContratoBase(BaseModel):
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    contratante: Optional[str] = None
    contratado: Optional[str] = None
    item_contratado: Optional[str] = None
    cantidad: Optional[int] = None
    monto_total: Optional[str] = None
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None


class ContratoCreate(ContratoBase):
    """Schema para crear un nuevo contrato"""
    pass


class ContratoUpdate(BaseModel):
    """Schema para actualizar un contrato existente"""
    numero: Optional[str] = None
    fecha: Optional[datetime] = None
    contratante: Optional[str] = None
    contratado: Optional[str] = None
    item_contratado: Optional[str] = None
    cantidad: Optional[int] = None
    monto_total: Optional[str] = None
    asunto: Optional[str] = None
    resumen: Optional[str] = None
    enlace_drive: Optional[str] = None


class ContratoResponse(ContratoBase):
    """Schema para respuesta de contrato"""
    id: int
    archivo_local: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    adjuntos: List[AdjuntoContratoResponse] = []

    class Config:
        from_attributes = True


class ContratoListResponse(BaseModel):
    """Schema para lista de contratos con paginación"""
    contratos: List[ContratoResponse]
    total: int
    pagina: int
    por_pagina: int
