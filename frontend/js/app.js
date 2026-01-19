/**
 * Aplicación principal del Sistema de Gestión de Correspondencia
 * Maneja la UI y la lógica de la aplicación
 */

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================

let state = {
    documentoActual: null,
    archivoTemporal: null,
    paginaActual: 1,
    editando: false
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    cargarDocumentos();
});

// ============================================
// NAVEGACIÓN ENTRE VISTAS
// ============================================

function mostrarVista(vistaId) {
    document.querySelectorAll('.vista').forEach(v => v.classList.add('hidden'));
    document.getElementById(vistaId).classList.remove('hidden');
}

function mostrarBandeja() {
    mostrarVista('vista-bandeja');
    state.documentoActual = null;
    state.archivoTemporal = null;
    state.editando = false;
    cargarDocumentos();
}

function mostrarFormularioNuevo() {
    limpiarFormulario();
    document.getElementById('form-titulo').textContent = 'Nuevo Documento';
    state.editando = false;
    state.archivoTemporal = null;
    cargarDocumentosParaPadre();
    // Mostrar el campo de dirección
    document.getElementById('direccion-container').classList.remove('hidden');
    mostrarVista('vista-formulario');
}

function onTipoDocumentoChange() {
    const tipo = document.getElementById('doc-tipo').value;
    const direccionContainer = document.getElementById('direccion-container');
    const direccionSelect = document.getElementById('doc-direccion');

    if (tipo === 'oficio') {
        // Para oficios, auto-seleccionar "recibido" y ocultar el campo
        direccionSelect.value = 'recibido';
        direccionContainer.classList.add('hidden');
    } else {
        // Para cartas, mostrar el campo de dirección
        direccionContainer.classList.remove('hidden');
    }
}

// ============================================
// BANDEJA DE DOCUMENTOS
// ============================================

async function cargarDocumentos() {
    const filtros = {
        tipo_documento: document.getElementById('filtro-tipo').value,
        direccion: document.getElementById('filtro-direccion').value,
        busqueda: document.getElementById('filtro-busqueda').value,
        pagina: state.paginaActual,
        por_pagina: 20
    };

    try {
        const data = await apiListarDocumentos(filtros);
        renderizarDocumentos(data);
    } catch (error) {
        mostrarToast('Error al cargar documentos: ' + error.message, 'error');
    }
}

function renderizarDocumentos(data) {
    const container = document.getElementById('lista-documentos');
    const totalEl = document.getElementById('total-docs');

    totalEl.textContent = `${data.total} documento(s) encontrado(s)`;

    if (data.documentos.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="5" class="px-4 py-8 text-center">
                    <div class="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 mx-auto text-gray-400 mb-4">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p class="text-gray-500 mb-4">No hay documentos registrados</p>
                        <button onclick="mostrarFormularioNuevo()"
                                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            Registrar primer documento
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Calcular número de fila basado en paginación
    const offset = (data.pagina - 1) * data.por_pagina;

    container.innerHTML = data.documentos.map((doc, index) => `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-4 py-3 text-sm text-gray-900 font-medium cursor-pointer" onclick="verDetalle(${doc.id})">${offset + index + 1}</td>
            <td class="px-4 py-3 text-sm text-blue-600 font-medium cursor-pointer" onclick="verDetalle(${doc.id})">${doc.numero || 'Sin número'}</td>
            <td class="px-4 py-3 text-sm text-gray-600 cursor-pointer" onclick="verDetalle(${doc.id})">${formatearFecha(doc.fecha)}</td>
            <td class="px-4 py-3 text-sm text-gray-900 cursor-pointer" onclick="verDetalle(${doc.id})">${doc.asunto || 'Sin asunto'}</td>
            <td class="px-4 py-3 text-sm text-gray-600 max-w-xs truncate cursor-pointer" onclick="verDetalle(${doc.id})" title="${doc.resumen || ''}">${truncarTexto(doc.resumen, 100) || '-'}</td>
            <td class="px-4 py-3 text-center">
                <button onclick="confirmarEliminar(${doc.id}, '${(doc.numero || '').replace(/'/g, "\\'")}'); event.stopPropagation();"
                        class="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition"
                        title="Eliminar documento">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');

    // Renderizar paginación
    renderizarPaginacion(data.total, data.pagina, data.por_pagina);
}

function renderizarPaginacion(total, pagina, porPagina) {
    const totalPaginas = Math.ceil(total / porPagina);
    const container = document.getElementById('paginacion');

    if (totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';

    // Botón anterior
    if (pagina > 1) {
        html += `<button onclick="irAPagina(${pagina - 1})"
                         class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">Anterior</button>`;
    }

    // Números de página
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === pagina) {
            html += `<button class="px-3 py-1 bg-blue-600 text-white rounded">${i}</button>`;
        } else if (i === 1 || i === totalPaginas || (i >= pagina - 2 && i <= pagina + 2)) {
            html += `<button onclick="irAPagina(${i})"
                             class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">${i}</button>`;
        } else if (i === pagina - 3 || i === pagina + 3) {
            html += `<span class="px-2">...</span>`;
        }
    }

    // Botón siguiente
    if (pagina < totalPaginas) {
        html += `<button onclick="irAPagina(${pagina + 1})"
                         class="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded">Siguiente</button>`;
    }

    container.innerHTML = html;
}

function irAPagina(pagina) {
    state.paginaActual = pagina;
    cargarDocumentos();
}

// ============================================
// DETALLE DE DOCUMENTO
// ============================================

async function verDetalle(id) {
    try {
        const doc = await apiObtenerDocumento(id);
        state.documentoActual = doc;
        renderizarDetalle(doc);
        mostrarVista('vista-detalle');
    } catch (error) {
        mostrarToast('Error al cargar documento: ' + error.message, 'error');
    }
}

async function renderizarDetalle(doc) {
    // Badge
    const badge = document.getElementById('det-badge');
    badge.textContent = `${capitalizar(doc.tipo_documento)} ${capitalizar(doc.direccion)}`;
    badge.className = `inline-block px-3 py-1 rounded-full text-sm font-medium badge-${doc.tipo_documento}-${doc.direccion}`;

    // Datos básicos
    document.getElementById('det-titulo').textContent = doc.titulo || 'Sin título';
    document.getElementById('det-numero').textContent = doc.numero || '-';
    document.getElementById('det-fecha').textContent = doc.fecha ? formatearFecha(doc.fecha) : '-';
    document.getElementById('det-remitente').textContent = doc.remitente || '-';
    document.getElementById('det-destinatario').textContent = doc.destinatario || '-';
    document.getElementById('det-asunto').textContent = doc.asunto || 'No especificado';
    document.getElementById('det-resumen').textContent = doc.resumen || 'No hay resumen disponible';

    // Archivo principal
    const archivoContainer = document.getElementById('det-archivo');
    if (doc.archivo_local) {
        archivoContainer.innerHTML = `
            <a href="http://localhost:8000/uploads/${doc.archivo_local}" target="_blank"
               class="link-documento flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                </svg>
                Ver PDF
            </a>
        `;
    } else if (doc.enlace_drive) {
        archivoContainer.innerHTML = `
            <a href="${doc.enlace_drive}" target="_blank"
               class="link-documento flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                Ver en Google Drive
            </a>
        `;
    } else {
        archivoContainer.innerHTML = '<p class="text-gray-500">No hay documento adjunto</p>';
    }

    // Adjuntos
    const adjuntosContainer = document.getElementById('det-adjuntos');
    if (doc.adjuntos && doc.adjuntos.length > 0) {
        adjuntosContainer.innerHTML = doc.adjuntos.map(adj => `
            <div class="flex items-center justify-between py-2">
                <a href="${adj.archivo_local ? `http://localhost:8000/uploads/${adj.archivo_local}` : adj.enlace_drive}"
                   target="_blank" class="link-documento">
                    ${adj.nombre}
                </a>
            </div>
        `).join('');
    } else {
        adjuntosContainer.innerHTML = '<p class="text-gray-500">No hay adjuntos</p>';
    }

    // Sección de respuestas (solo para documentos recibidos)
    const seccionRespuestas = document.getElementById('seccion-respuestas');
    if (doc.direccion === 'recibido') {
        seccionRespuestas.classList.remove('hidden');
        cargarRespuestas(doc.id);
    } else {
        seccionRespuestas.classList.add('hidden');
    }
}

async function cargarRespuestas(documentoId) {
    try {
        const respuestas = await apiObtenerRespuestas(documentoId);
        const container = document.getElementById('lista-respuestas');

        if (respuestas.length === 0) {
            container.innerHTML = '<p class="text-gray-500">No hay respuestas registradas</p>';
            return;
        }

        container.innerHTML = respuestas.map(resp => `
            <div class="py-2 border-b last:border-0 cursor-pointer hover:bg-gray-50"
                 onclick="verDetalle(${resp.id})">
                <div class="font-medium">${resp.titulo || 'Sin título'}</div>
                <div class="text-sm text-gray-500">${formatearFecha(resp.created_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error al cargar respuestas:', error);
    }
}

// ============================================
// FORMULARIO DE DOCUMENTO
// ============================================

function limpiarFormulario() {
    document.getElementById('doc-id').value = '';
    document.getElementById('doc-tipo').value = '';
    document.getElementById('doc-direccion').value = '';
    document.getElementById('doc-numero').value = '';
    document.getElementById('doc-fecha').value = '';
    document.getElementById('doc-remitente').value = '';
    document.getElementById('doc-destinatario').value = '';
    document.getElementById('doc-titulo').value = '';
    document.getElementById('doc-asunto').value = '';
    document.getElementById('doc-resumen').value = '';
    document.getElementById('doc-enlace').value = '';
    document.getElementById('doc-archivo').value = '';
    document.getElementById('doc-padre').value = '';
    document.getElementById('archivo-status').textContent = '';
    document.getElementById('ia-error').classList.add('hidden');
    document.getElementById('doc-whatsapp').value = '';
    document.getElementById('whatsapp-container').classList.add('hidden');
    state.archivoTemporal = null;
}

function editarDocumento() {
    const doc = state.documentoActual;
    if (!doc) return;

    document.getElementById('form-titulo').textContent = 'Editar Documento';
    document.getElementById('doc-id').value = doc.id;
    document.getElementById('doc-tipo').value = doc.tipo_documento;
    document.getElementById('doc-direccion').value = doc.direccion;
    document.getElementById('doc-numero').value = doc.numero || '';
    document.getElementById('doc-fecha').value = doc.fecha ? doc.fecha.split('T')[0] : '';
    document.getElementById('doc-remitente').value = doc.remitente || '';
    document.getElementById('doc-destinatario').value = doc.destinatario || '';
    document.getElementById('doc-titulo').value = doc.titulo || '';
    document.getElementById('doc-asunto').value = doc.asunto || '';
    document.getElementById('doc-resumen').value = doc.resumen || '';
    document.getElementById('doc-enlace').value = doc.enlace_drive || '';

    if (doc.archivo_local) {
        document.getElementById('archivo-status').textContent = `Archivo actual: ${doc.archivo_local}`;
    }

    state.editando = true;
    cargarDocumentosParaPadre();
    mostrarVista('vista-formulario');
}

async function cargarDocumentosParaPadre() {
    try {
        // Cargar documentos recibidos para poder seleccionarlos como padre
        const data = await apiListarDocumentos({ direccion: 'recibido', por_pagina: 100 });
        const select = document.getElementById('doc-padre');

        select.innerHTML = '<option value="">Ninguno (documento nuevo)</option>';
        data.documentos.forEach(doc => {
            // No mostrar el documento actual si estamos editando
            if (state.documentoActual && doc.id === state.documentoActual.id) return;

            select.innerHTML += `
                <option value="${doc.id}">
                    ${doc.numero || 'S/N'} - ${doc.titulo || 'Sin título'}
                </option>
            `;
        });

        // Seleccionar padre si existe
        if (state.documentoActual && state.documentoActual.documento_padre_id) {
            select.value = state.documentoActual.documento_padre_id;
        }
    } catch (error) {
        console.error('Error al cargar documentos para padre:', error);
    }
}

async function guardarDocumento(event) {
    event.preventDefault();

    const docId = document.getElementById('doc-id').value;
    const numeroOficio = document.getElementById('doc-numero').value || null;
    const documento = {
        tipo_documento: document.getElementById('doc-tipo').value,
        direccion: document.getElementById('doc-direccion').value,
        numero: numeroOficio,
        fecha: document.getElementById('doc-fecha').value || null,
        remitente: document.getElementById('doc-remitente').value || null,
        destinatario: document.getElementById('doc-destinatario').value || null,
        titulo: numeroOficio, // El título es el número de oficio
        asunto: document.getElementById('doc-asunto').value || null,
        resumen: document.getElementById('doc-resumen').value || null,
        enlace_drive: document.getElementById('doc-enlace').value || null,
        documento_padre_id: document.getElementById('doc-padre').value || null
    };

    try {
        let resultado;

        if (docId) {
            // Actualizar
            resultado = await apiActualizarDocumento(docId, documento);
            mostrarToast('Documento actualizado correctamente');
        } else {
            // Crear
            resultado = await apiCrearDocumento(documento);

            // Si hay archivo temporal, asociarlo
            if (state.archivoTemporal) {
                const archivo = document.getElementById('doc-archivo').files[0];
                if (archivo) {
                    await apiSubirArchivo(resultado.id, archivo);
                }
            }

            mostrarToast('Documento creado correctamente');
        }

        mostrarBandeja();
    } catch (error) {
        mostrarToast('Error: ' + error.message, 'error');
    }
}

async function eliminarDocumento() {
    if (!state.documentoActual) return;

    if (!confirm('¿Está seguro de eliminar este documento?')) return;

    try {
        await apiEliminarDocumento(state.documentoActual.id);
        mostrarToast('Documento eliminado');
        mostrarBandeja();
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
}

async function confirmarEliminar(id, numero) {
    const mensaje = numero
        ? `¿Está seguro de querer borrar el oficio ${numero}?`
        : '¿Está seguro de querer borrar este documento?';

    if (!confirm(mensaje)) return;

    try {
        await apiEliminarDocumento(id);
        mostrarToast('Documento eliminado correctamente');
        cargarDocumentos(); // Recargar la lista
    } catch (error) {
        mostrarToast('Error al eliminar: ' + error.message, 'error');
    }
}

// ============================================
// SUBIDA DE ARCHIVOS
// ============================================

async function subirArchivo() {
    const archivo = document.getElementById('doc-archivo').files[0];
    if (!archivo) {
        mostrarToast('Seleccione un archivo PDF', 'error');
        return;
    }

    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
        mostrarToast('Solo se permiten archivos PDF', 'error');
        return;
    }

    const statusEl = document.getElementById('archivo-status');
    statusEl.textContent = 'Subiendo archivo...';

    try {
        const resultado = await apiSubirArchivoTemporal(archivo);
        state.archivoTemporal = resultado.archivo;
        statusEl.textContent = `Archivo subido: ${resultado.archivo}`;
        mostrarToast('Archivo subido correctamente');
    } catch (error) {
        statusEl.textContent = 'Error al subir archivo';
        mostrarToast('Error: ' + error.message, 'error');
    }
}

// ============================================
// ANÁLISIS CON IA
// ============================================

async function analizarConIA() {
    const btn = document.getElementById('btn-analizar');
    const loadingEl = document.getElementById('ia-loading');
    const errorEl = document.getElementById('ia-error');

    // Verificar que hay un archivo subido
    if (!state.archivoTemporal) {
        mostrarToast('Primero suba un archivo PDF', 'error');
        return;
    }

    // Mostrar estado de carga
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Analizando...';
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');

    try {
        const resultado = await apiAnalizarArchivo(state.archivoTemporal);

        if (resultado.exito) {
            console.log('Resultado IA:', resultado); // Para depuración

            // Llenar TODOS los campos con resultados
            document.getElementById('doc-numero').value = resultado.numero_oficio || '';

            // Fecha - convertir a formato de input date
            if (resultado.fecha && resultado.fecha !== 'No especificado' && resultado.fecha.length >= 10) {
                document.getElementById('doc-fecha').value = resultado.fecha.substring(0, 10);
            }

            // Remitente
            const remitente = resultado.remitente || '';
            if (remitente && remitente !== 'No especificado') {
                document.getElementById('doc-remitente').value = remitente;
            }

            // Destinatario
            const destinatario = resultado.destinatario || '';
            if (destinatario && destinatario !== 'No especificado') {
                document.getElementById('doc-destinatario').value = destinatario;
            }

            // Asunto y Resumen
            document.getElementById('doc-asunto').value = resultado.asunto || '';
            document.getElementById('doc-resumen').value = resultado.resumen || '';

            // Mensaje WhatsApp - usar directamente numero_oficio del resultado
            if (resultado.numero_oficio) {
                const mensajeWhatsapp = `${resultado.numero_oficio}\nAsunto: ${resultado.asunto || ''}\nResumen: ${resultado.resumen || ''}`;
                document.getElementById('doc-whatsapp').value = mensajeWhatsapp;
                document.getElementById('whatsapp-container').classList.remove('hidden');
            }

            // Auto-seleccionar tipo oficio si se detectó número de oficio
            if (resultado.numero_oficio && resultado.numero_oficio.toLowerCase().includes('oficio')) {
                document.getElementById('doc-tipo').value = 'oficio';
                onTipoDocumentoChange();
            }

            mostrarToast('Análisis completado. Revise y edite los campos.');
        } else {
            errorEl.textContent = resultado.mensaje;
            errorEl.classList.remove('hidden');
            mostrarToast('Error en análisis: ' + resultado.mensaje, 'error');
        }
    } catch (error) {
        errorEl.textContent = error.message;
        errorEl.classList.remove('hidden');
        mostrarToast('Error: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            Analizar con IA
        `;
        loadingEl.classList.add('hidden');
    }
}

// ============================================
// CREAR RESPUESTA
// ============================================

function crearRespuesta() {
    const docPadre = state.documentoActual;
    if (!docPadre) return;

    limpiarFormulario();
    document.getElementById('form-titulo').textContent = 'Nueva Carta de Respuesta';
    document.getElementById('doc-tipo').value = 'carta';
    document.getElementById('doc-direccion').value = 'enviado';

    // Pre-llenar con datos del documento padre
    document.getElementById('doc-destinatario').value = docPadre.remitente || '';

    // Cargar documentos padre y seleccionar el actual
    cargarDocumentosParaPadre().then(() => {
        document.getElementById('doc-padre').value = docPadre.id;
    });

    state.editando = false;
    mostrarVista('vista-formulario');
}

// ============================================
// UTILIDADES
// ============================================

function capitalizar(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncarTexto(texto, maxLength) {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength) + '...';
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toast-message');

    messageEl.textContent = mensaje;
    toast.querySelector('div').className = tipo === 'error'
        ? 'bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg'
        : 'bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg';

    toast.classList.remove('hidden');
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 3000);
}

function copiarWhatsApp() {
    const texto = document.getElementById('doc-whatsapp').value;
    if (!texto) {
        mostrarToast('No hay mensaje para copiar', 'error');
        return;
    }

    navigator.clipboard.writeText(texto).then(() => {
        mostrarToast('Mensaje copiado al portapapeles');
    }).catch(err => {
        // Fallback para navegadores sin soporte
        const textarea = document.getElementById('doc-whatsapp');
        textarea.select();
        document.execCommand('copy');
        mostrarToast('Mensaje copiado al portapapeles');
    });
}

// Debounce para búsqueda
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
