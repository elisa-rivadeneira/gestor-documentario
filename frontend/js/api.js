/**
 * Cliente API para el Sistema de Gestión de Correspondencia
 * Maneja todas las comunicaciones con el backend FastAPI
 */

// Detectar automáticamente la URL del API (funciona en local y producción)
const API_BASE = window.location.origin + '/api';

/**
 * Clase para manejar errores de la API
 */
class APIError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'APIError';
    }
}

/**
 * Función helper para realizar peticiones HTTP
 */
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const config = { ...defaultOptions, ...options };

    // No incluir Content-Type para FormData
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    try {
        const response = await fetch(url, config);

        // Para respuestas 204 No Content
        if (response.status === 204) {
            return null;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new APIError(data.detail || 'Error en la petición', response.status);
        }

        return data;
    } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError(`Error de conexión: ${error.message}`, 0);
    }
}

// ============================================
// DOCUMENTOS
// ============================================

/**
 * Lista documentos con filtros opcionales
 */
async function apiListarDocumentos(filtros = {}) {
    const params = new URLSearchParams();

    if (filtros.tipo_documento) params.append('tipo_documento', filtros.tipo_documento);
    if (filtros.direccion) params.append('direccion', filtros.direccion);
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
    if (filtros.pagina) params.append('pagina', filtros.pagina);
    if (filtros.por_pagina) params.append('por_pagina', filtros.por_pagina);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await fetchAPI(`/documentos${query}`);
}

/**
 * Obtiene un documento por ID
 */
async function apiObtenerDocumento(id) {
    return await fetchAPI(`/documentos/${id}`);
}

/**
 * Crea un nuevo documento
 */
async function apiCrearDocumento(documento) {
    return await fetchAPI('/documentos', {
        method: 'POST',
        body: JSON.stringify(documento),
    });
}

/**
 * Actualiza un documento existente
 */
async function apiActualizarDocumento(id, documento) {
    return await fetchAPI(`/documentos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(documento),
    });
}

/**
 * Elimina un documento
 */
async function apiEliminarDocumento(id) {
    return await fetchAPI(`/documentos/${id}`, {
        method: 'DELETE',
    });
}

/**
 * Obtiene respuestas de un documento
 */
async function apiObtenerRespuestas(documentoId) {
    return await fetchAPI(`/documentos/${documentoId}/respuestas`);
}

// ============================================
// ARCHIVOS
// ============================================

/**
 * Sube un archivo a un documento existente
 */
async function apiSubirArchivo(documentoId, archivo) {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return await fetchAPI(`/documentos/${documentoId}/archivo`, {
        method: 'POST',
        body: formData,
    });
}

/**
 * Sube un archivo temporal (antes de crear documento)
 */
async function apiSubirArchivoTemporal(archivo) {
    const formData = new FormData();
    formData.append('archivo', archivo);

    return await fetchAPI('/subir-temporal', {
        method: 'POST',
        body: formData,
    });
}

// ============================================
// ANÁLISIS IA
// ============================================

/**
 * Analiza texto con IA
 */
async function apiAnalizarTexto(texto) {
    return await fetchAPI('/analizar-ia', {
        method: 'POST',
        body: JSON.stringify({ texto }),
    });
}

/**
 * Analiza un archivo PDF con IA
 */
async function apiAnalizarArchivo(nombreArchivo) {
    return await fetchAPI(`/analizar-archivo/${encodeURIComponent(nombreArchivo)}`, {
        method: 'POST',
    });
}

// ============================================
// ADJUNTOS
// ============================================

/**
 * Agrega un adjunto a un documento
 */
async function apiAgregarAdjunto(documentoId, archivo, enlaceDrive, nombre) {
    const formData = new FormData();
    if (archivo) formData.append('archivo', archivo);
    if (enlaceDrive) formData.append('enlace_drive', enlaceDrive);
    if (nombre) formData.append('nombre', nombre);

    const params = new URLSearchParams();
    if (enlaceDrive) params.append('enlace_drive', enlaceDrive);
    if (nombre) params.append('nombre', nombre);

    const query = params.toString() ? `?${params.toString()}` : '';

    return await fetchAPI(`/documentos/${documentoId}/adjuntos${query}`, {
        method: 'POST',
        body: archivo ? formData : undefined,
    });
}

/**
 * Elimina un adjunto
 */
async function apiEliminarAdjunto(adjuntoId) {
    return await fetchAPI(`/adjuntos/${adjuntoId}`, {
        method: 'DELETE',
    });
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Verifica el estado del servidor
 */
async function apiHealthCheck() {
    return await fetchAPI('/health');
}
