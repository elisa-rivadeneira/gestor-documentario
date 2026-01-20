"""
Configuración de base de datos SQLite con SQLAlchemy
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Ruta de la base de datos
# En producción (Easypanel): usa DATABASE_PATH=/app/correspondencia.db
# En local: usa la ruta por defecto
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.environ.get('DATABASE_PATH', os.path.join(BASE_DIR, 'correspondencia.db'))
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Crear engine de SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Necesario para SQLite
)

# Crear sesión
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para los modelos
Base = declarative_base()

def get_db():
    """
    Dependency para obtener sesión de base de datos.
    Se usa en cada endpoint que necesite acceso a BD.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
