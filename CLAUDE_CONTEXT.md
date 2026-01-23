# CONTEXTO PARA CLAUDE - GESTOR DOCUMENTARIO NEMAEC

> **Lee este archivo al inicio de cada sesión para entender el proyecto**

---

## 1. QUÉ ES ESTE PROYECTO

Sistema web de gestión de correspondencia para **NEMAEC** (institución gubernamental peruana). Permite registrar, buscar y gestionar:

- **Oficios recibidos** - Documentos oficiales que llegan de otras instituciones (FONCODES, MIDIS, etc.)
- **Cartas NEMAEC enviadas** - Cartas que NEMAEC envía a otras instituciones
- **Cartas recibidas** - Cartas que llegan a NEMAEC

Cada documento tiene: número, fecha, remitente, destinatario, asunto, resumen, y un PDF adjunto.

---

## 2. ARQUITECTURA

```
gestion_documentaria/
├── backend/
│   ├── main.py              # FastAPI - todos los endpoints
│   ├── models.py            # SQLAlchemy models (Documento, Adjunto, Usuario)
│   ├── schemas.py           # Pydantic schemas
│   ├── database.py          # Conexión SQLite
│   ├── init_users.py        # Crea usuarios iniciales
│   ├── start.sh             # Script de inicio (maneja volumen persistente)
│   └── services/
│       ├── ia_service.py    # Análisis con Claude API + OCR
│       └── auth_service.py  # JWT + bcrypt
├── frontend/
│   ├── index.html           # SPA - una sola página con varias "vistas"
│   ├── js/
│   │   ├── app.js           # Lógica principal UI
│   │   └── api.js           # Cliente API (fetch wrapper)
│   └── css/
│       └── styles.css       # Estilos custom + Tailwind
├── uploads/                  # PDFs locales (en prod: /data/uploads/)
├── correspondencia.db        # SQLite local (en prod: /data/correspondencia.db)
├── Dockerfile
├── NOTAS_PENDIENTES.md       # Tareas pendientes de seguridad y features
└── CLAUDE_CONTEXT.md         # Este archivo
```

---

## 3. CÓMO FUNCIONA

### Frontend (SPA)
- Una sola página HTML con varias "vistas" (`<div class="vista">`)
- Se muestran/ocultan con JavaScript (`mostrarVista('nombre')`)
- Vistas: `bandeja`, `formulario`, `detalle`, `login`
- Usa Tailwind CSS + SweetAlert2 para UI

### Backend (FastAPI)
- API REST en `/api/*`
- Sirve frontend estático en `/`
- Archivos en `/uploads/*`
- Auth con JWT en header `Authorization: Bearer <token>`

### Base de Datos (SQLite)
- Tabla `documentos` - oficios y cartas
- Tabla `adjuntos` - archivos adicionales por documento
- Tabla `usuarios` - admins (solo 3 por ahora)

### Flujo de crear documento:
1. Usuario sube PDF → va a `/api/subir-temporal` → archivo temporal
2. IA analiza PDF → extrae número, fecha, remitente, etc.
3. Usuario revisa/edita datos → guarda → `/api/documentos` POST
4. Se asocia archivo temporal al documento → `/api/documentos/{id}/asociar-archivo`

---

## 4. PRODUCCIÓN (Easypanel)

- **URL:** https://automation-gestor-documentario.gnrjtm.easypanel.host
- **Docker** con volumen persistente en `/data`
- **Base de datos:** `/data/correspondencia.db`
- **Uploads:** `/data/uploads/`

### Variables de entorno en producción:
```
DATABASE_PATH=/data/correspondencia.db
UPLOAD_DIR=/data/uploads
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 5. AUTENTICACIÓN

- **JWT** con expiración de 24 horas
- **bcrypt** para hash de contraseñas
- Token se guarda en `localStorage`
- Endpoints protegidos: POST, PUT, DELETE requieren token
- Endpoints públicos: GET (listar, ver documentos)

### Usuarios actuales:
| Usuario | Contraseña | Rol |
|---------|------------|-----|
| adminnemaec | AdminNemaec123* | Admin principal |
| rpaiva | AdminNemaec123* | Coordinador |
| eagreda | AdminNemaec123* | Especialista TIC |

**NOTA:** Todas las contraseñas son iguales (pendiente cambiar).

---

## 6. PROBLEMAS CONOCIDOS Y SOLUCIONES

### "Los PDFs no se ven en producción"
- **Causa:** Uploads no estaban en volumen persistente
- **Solución:** Ahora van a `/data/uploads/` (ya corregido)

### "Doble timestamp en nombres de archivo"
- **Causa:** Bug en `asociar_archivo_temporal` hacía split incorrecto
- **Solución:** Cambiado de `split('_', 2)` a `split('_', 3)` (ya corregido)

### "Caracteres raros en nombres (ó, é, ñ)"
- **Causa:** Encoding del sistema de archivos
- **Estado:** Funciona, pero los nombres en BD pueden verse raro

### "Error 401 al crear documento"
- **Causa:** Token expirado o no enviado
- **Solución:** Verificar que el usuario esté logueado

---

## 7. COMANDOS ÚTILES

### Desarrollo local:
```bash
# Iniciar servidor
cd backend && python -m uvicorn main:app --reload --port 8000

# Crear usuarios iniciales
cd backend && python init_users.py
```

### Producción (en contenedor):
```bash
# Ver archivos en uploads
ls /data/uploads/

# Ver logs
# (desde Easypanel)

# Contar documentos
python -c "import sqlite3; c=sqlite3.connect('/data/correspondencia.db'); print(c.execute('SELECT COUNT(*) FROM documentos').fetchone()[0])"
```

---

## 8. PARA CONTINUAR TRABAJANDO

1. **Lee `NOTAS_PENDIENTES.md`** para ver tareas pendientes
2. **Prioridad actual:** Seguridad (es institución gubernamental)
3. **No hacer redeploy** sin avisar - hay datos en producción
4. **Siempre probar localmente** antes de subir cambios

### Iniciar servidor local:
```bash
cd backend && python -m uvicorn main:app --reload --port 8000
```

### Ver la app:
- Local: http://localhost:8000
- Producción: https://automation-gestor-documentario.gnrjtm.easypanel.host

---

## 9. HISTORIAL DE CAMBIOS IMPORTANTES

| Fecha | Cambio |
|-------|--------|
| 2026-01-22 | Sistema de autenticación (JWT + bcrypt) |
| 2026-01-22 | Volumen persistente para uploads |
| 2026-01-22 | Restauración masiva de 127 PDFs |
| 2026-01-22 | Fix bug doble timestamp |
| 2026-01-20 | Breadcrumb y botón volver |
| 2026-01-20 | Título cambiado a "NEMAEC - GESTOR DOCUMENTARIO" |
| 2026-01-19 | Análisis con IA + OCR para extraer datos de PDFs |
| 2026-01-15 | Versión inicial con CRUD de documentos |

---

**Cuando inicies sesión, di:** "Lee CLAUDE_CONTEXT.md y NOTAS_PENDIENTES.md para continuar"
