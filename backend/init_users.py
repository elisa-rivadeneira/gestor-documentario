"""
Script para inicializar usuarios administradores.
Se ejecuta automáticamente si no hay usuarios en la base de datos.
"""
from database import SessionLocal, engine, Base
from models import Usuario
from services.auth_service import hash_password


def crear_usuarios_iniciales():
    """
    Crea los usuarios administradores iniciales.
    Solo se ejecuta si no hay usuarios en la base de datos.
    """
    # Crear tablas si no existen
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Verificar si ya hay usuarios
        count = db.query(Usuario).count()
        if count > 0:
            print(f"Ya existen {count} usuarios. No se crean nuevos.")
            return

        # Usuarios iniciales
        usuarios = [
            {
                "username": "adminnemaec",
                "password": "AdminNemaec123*",
                "nombre": "Administrador NEMAEC"
            },
            {
                "username": "rpaiva",
                "password": "AdminNemaec123*",
                "nombre": "R. Paiva - Coordinador"
            },
            {
                "username": "eagreda",
                "password": "AdminNemaec123*",
                "nombre": "E. Agreda - Especialista TIC"
            }
        ]

        # Crear usuarios
        for user_data in usuarios:
            usuario = Usuario(
                username=user_data["username"],
                password_hash=hash_password(user_data["password"]),
                nombre=user_data["nombre"],
                activo=1
            )
            db.add(usuario)
            print(f"Usuario creado: {user_data['username']}")

        db.commit()
        print("Usuarios iniciales creados exitosamente.")

    except Exception as e:
        print(f"Error al crear usuarios: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    crear_usuarios_iniciales()
