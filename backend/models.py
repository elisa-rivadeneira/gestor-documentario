"""
Modelos SQLAlchemy para el sistema de gestión de correspondencia
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from database import Base


class TipoDocumento(str, enum.Enum):
    """Tipos de documento permitidos"""
    OFICIO = "oficio"
    CARTA = "carta"


class Direccion(str, enum.Enum):
    """Dirección del documento"""
    RECIBIDO = "recibido"
    ENVIADO = "enviado"


class Documento(Base):
    """
    Modelo principal de documentos.
    Almacena oficios y cartas, tanto recibidos como enviados.
    """
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    tipo_documento = Column(String(20), nullable=False)  # oficio, carta
    direccion = Column(String(20), nullable=False)  # recibido, enviado
    numero = Column(String(50), nullable=True)  # Número del documento
    fecha = Column(DateTime, nullable=True)  # Fecha del documento
    remitente = Column(String(255), nullable=True)
    destinatario = Column(String(255), nullable=True)
    titulo = Column(String(500), nullable=True)  # Generado por IA o manual
    asunto = Column(String(500), nullable=True)  # Generado por IA o manual
    resumen = Column(Text, nullable=True)  # Generado por IA o manual
    anio_oficio = Column(Integer, nullable=True)  # Año extraído del número (para ordenamiento)
    correlativo_oficio = Column(Integer, nullable=True)  # Número correlativo (para ordenamiento)
    enlace_drive = Column(String(500), nullable=True)  # Link a Google Drive
    archivo_local = Column(String(500), nullable=True)  # Ruta archivo subido

    # Relación padre-hijo para respuestas
    documento_padre_id = Column(Integer, ForeignKey("documentos.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relaciones
    adjuntos = relationship("Adjunto", back_populates="documento", cascade="all, delete-orphan")
    respuestas = relationship("Documento", backref="documento_padre", remote_side=[id])


class Adjunto(Base):
    """
    Modelo para archivos adjuntos adicionales al documento principal.
    """
    __tablename__ = "adjuntos"

    id = Column(Integer, primary_key=True, index=True)
    documento_id = Column(Integer, ForeignKey("documentos.id"), nullable=False)
    nombre = Column(String(255), nullable=False)
    enlace_drive = Column(String(500), nullable=True)
    archivo_local = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relación
    documento = relationship("Documento", back_populates="adjuntos")


class Usuario(Base):
    """
    Modelo para usuarios administradores del sistema.
    """
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=False)  # Nombre completo para mostrar
    activo = Column(Integer, default=1)  # 1 = activo, 0 = inactivo
    created_at = Column(DateTime, server_default=func.now())


class Contrato(Base):
    """
    Modelo para contratos institucionales.
    Tabla independiente de documentos.
    """
    __tablename__ = "contratos"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(50), nullable=True)
    fecha = Column(DateTime, nullable=True)
    contratante = Column(String(255), nullable=True)
    contratado = Column(String(255), nullable=True)
    item_contratado = Column(String(500), nullable=True)
    cantidad = Column(Integer, nullable=True)
    monto_total = Column(String(100), nullable=True)
    asunto = Column(String(500), nullable=True)
    resumen = Column(Text, nullable=True)
    archivo_local = Column(String(500), nullable=True)
    enlace_drive = Column(String(500), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    adjuntos = relationship("AdjuntoContrato", back_populates="contrato", cascade="all, delete-orphan")


class AdjuntoContrato(Base):
    """
    Modelo para archivos adjuntos de contratos.
    """
    __tablename__ = "adjuntos_contrato"

    id = Column(Integer, primary_key=True, index=True)
    contrato_id = Column(Integer, ForeignKey("contratos.id"), nullable=False)
    nombre = Column(String(255), nullable=False)
    enlace_drive = Column(String(500), nullable=True)
    archivo_local = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    contrato = relationship("Contrato", back_populates="adjuntos")
