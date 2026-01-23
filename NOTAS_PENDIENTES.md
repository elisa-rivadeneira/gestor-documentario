# NOTAS PENDIENTES - GESTOR DOCUMENTARIO NEMAEC

> **Institución:** NEMAEC (Institución Gubernamental)
> **Última actualización:** 2026-01-22
> **Estado:** En producción

---

## 🔴 SEGURIDAD - PRIORIDAD ALTA

### Inmediato (Hacer pronto)
- [ ] **Eliminar endpoint `/api/restaurar-uploads`** - Ya cumplió su función, es un riesgo dejarlo
- [ ] **Cambiar contraseñas por defecto** - Todos los usuarios tienen `AdminNemaec123*`
- [ ] **Mover JWT_SECRET a variable de entorno** - Actualmente está hardcodeado en `auth_service.py`
- [ ] **Restringir CORS** - Actualmente permite `*`, debe ser solo `https://automation-gestor-documentario.gnrjtm.easypanel.host`

### Corto Plazo
- [ ] Forzar cambio de contraseña en primer login
- [ ] Límite de intentos de login (bloqueo tras 5 fallos)
- [ ] Logs de auditoría (quién creó/editó/eliminó documentos)
- [ ] Reducir expiración de tokens (de 24h a 8h)
- [ ] Endpoint para cambiar contraseña

### Mediano Plazo
- [ ] Autenticación de dos factores (2FA)
- [ ] Panel de administración de usuarios (crear/editar/eliminar usuarios)
- [ ] Roles y permisos granulares (admin vs usuario normal)
- [ ] Backup automático de base de datos

---

## 🟡 FUNCIONALIDADES PENDIENTES

### Fase 2 - Gestión de Usuarios
- [ ] Dashboard de admin para gestionar usuarios
- [ ] Crear nuevos usuarios desde la app
- [ ] Desactivar/activar usuarios
- [ ] Ver historial de acciones por usuario

### Mejoras UX
- [ ] Botón "Resubir PDF" en vista de detalle (para documentos que perdieron archivo)
- [ ] Notificaciones cuando hay nuevos documentos
- [ ] Exportar lista de documentos a Excel

---

## 🟢 COMPLETADO

- [x] Sistema de autenticación básico (JWT + bcrypt)
- [x] Protección de endpoints de mutación (crear/editar/eliminar)
- [x] Login/logout en frontend
- [x] Volumen persistente para base de datos (`/data/correspondencia.db`)
- [x] Volumen persistente para uploads (`/data/uploads/`)
- [x] Restauración masiva de archivos (127 PDFs migrados)
- [x] Fix bug doble timestamp en nombres de archivo
- [x] Breadcrumb de navegación
- [x] Botón "+" para creación rápida de documentos

---

## 📋 INFORMACIÓN TÉCNICA

### Stack
- **Backend:** FastAPI + SQLite + SQLAlchemy
- **Frontend:** HTML + Tailwind CSS + JavaScript vanilla
- **Auth:** JWT (PyJWT) + bcrypt
- **Deploy:** Easypanel (Docker)
- **OCR:** Tesseract + pdf2image

### Usuarios Actuales
| Usuario | Nombre | Rol |
|---------|--------|-----|
| adminnemaec | Administrador NEMAEC | Admin |
| rpaiva | R. Paiva - Coordinador | Admin |
| eagreda | E. Agreda - Especialista TIC | Admin |

### URLs
- **Producción:** https://automation-gestor-documentario.gnrjtm.easypanel.host
- **Repo:** https://github.com/elisa-rivadeneira/gestor-documentario

### Volúmenes en Producción
- `/data/correspondencia.db` - Base de datos
- `/data/uploads/` - Archivos PDF

---

## 💡 NOTAS PARA CLAUDE

- Este es un sistema gubernamental, la seguridad es prioritaria
- Los archivos se perdieron una vez por no tener volumen persistente - ya está corregido
- El endpoint `/api/restaurar-uploads` debe eliminarse cuando se implemente seguridad
- Hay 3 tipos de documentos: oficios recibidos, cartas NEMAEC enviadas, cartas recibidas
