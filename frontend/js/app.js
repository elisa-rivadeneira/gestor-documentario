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
    editando: false,
    categoriaActual: 'oficios', // Por defecto: oficios
    oficiosDisponibles: [], // Lista de oficios para el dropdown de referencia
    adjuntosTemporales: [] // Lista de adjuntos a subir
};

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar con "oficios" seleccionado por defecto
    filtrarPorCategoria('oficios');
});

// ============================================
// NAVEGACIÓN POR CATEGORÍAS
// ============================================

function filtrarPorCategoria(categoria) {
    state.categoriaActual = categoria;
    state.paginaActual = 1;

    // Configurar filtros según la categoría
    const filtroTipo = document.getElementById('filtro-tipo');
    const filtroDireccion = document.getElementById('filtro-direccion');
    const filtroReferencia = document.getElementById('filtro-referencia');
    const colReferencia = document.getElementById('col-referencia');
    const colDocumento = document.getElementById('col-documento');

    // Limpiar filtro de referencia al cambiar de categoría
    filtroReferencia.value = '';

    switch (categoria) {
        case 'cartas-nemaec':
            // Cartas enviadas (NEMAEC)
            filtroTipo.value = 'carta';
            filtroDireccion.value = 'enviado';
            // Mostrar columna y filtro de referencia
            filtroReferencia.classList.remove('hidden');
            colReferencia.classList.remove('hidden');
            // Cambiar título de columna a CARTA
            colDocumento.textContent = 'CARTA';
            break;
        case 'oficios':
            // Todos los oficios
            filtroTipo.value = 'oficio';
            filtroDireccion.value = '';
            // Ocultar columna y filtro de referencia
            filtroReferencia.classList.add('hidden');
            colReferencia.classList.add('hidden');
            // Cambiar título de columna a OFICIO
            colDocumento.textContent = 'OFICIO';
            break;
        case 'cartas-recibidas':
            // Cartas recibidas
            filtroTipo.value = 'carta';
            filtroDireccion.value = 'recibido';
            // Ocultar columna y filtro de referencia
            filtroReferencia.classList.add('hidden');
            colReferencia.classList.add('hidden');
            // Cambiar título de columna a CARTA
            colDocumento.textContent = 'CARTA';
            break;
    }

    // Actualizar estilos de botones activos
    actualizarBotonesMenu(categoria);

    // Cargar documentos con los nuevos filtros
    cargarDocumentos();
}

function actualizarBotonesMenu(categoriaActiva) {
    const botones = ['cartas-nemaec', 'oficios', 'cartas-recibidas'];

    botones.forEach(cat => {
        const btn = document.getElementById(`btn-${cat}`);
        if (btn) {
            if (cat === categoriaActiva) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

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
    mostrarVista('vista-formulario');
}

function onTipoDocumentoChange() {
    const tipo = document.getElementById('doc-tipo').value;
    const direccionInput = document.getElementById('doc-direccion');
    const oficioRefContainer = document.getElementById('oficio-referencia-container');

    // Mapear tipo a dirección automáticamente
    switch (tipo) {
        case 'carta-nemaec':
            // CARTA NEMAEC = carta enviada
            direccionInput.value = 'enviado';
            // Mostrar campo de referencia para cartas NEMAEC
            oficioRefContainer.classList.remove('hidden');
            cargarOficiosParaReferencia();
            break;
        case 'oficio':
            // OFICIO = recibido
            direccionInput.value = 'recibido';
            oficioRefContainer.classList.add('hidden');
            break;
        case 'carta-recibida':
            // CARTA RECIBIDA = recibida
            direccionInput.value = 'recibido';
            oficioRefContainer.classList.add('hidden');
            break;
        default:
            direccionInput.value = '';
            oficioRefContainer.classList.add('hidden');
    }
}

async function cargarOficiosParaReferencia() {
    try {
        // Cargar todos los oficios (recibidos y enviados) para referencia
        const data = await apiListarDocumentos({ tipo_documento: 'oficio', por_pagina: 100 });
        state.oficiosDisponibles = data.documentos;

        const select = document.getElementById('doc-oficio-referencia');
        select.innerHTML = '<option value="">-- Sin oficio de referencia --</option>';

        data.documentos.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.numero || `ID: ${doc.id}`;
            option.dataset.asunto = doc.asunto || '';
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar oficios para referencia:', error);
    }
}

function onOficioReferenciaChange() {
    const select = document.getElementById('doc-oficio-referencia');
    const asuntoContainer = document.getElementById('oficio-referencia-asunto');
    const asuntoTexto = document.getElementById('oficio-ref-asunto-texto');

    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        const asunto = selectedOption.dataset.asunto;

        if (asunto) {
            asuntoTexto.textContent = asunto;
            asuntoContainer.classList.remove('hidden');
        } else {
            asuntoContainer.classList.add('hidden');
        }
    } else {
        asuntoContainer.classList.add('hidden');
    }
}

function seleccionarOficioPorNumero(numeroOficio) {
    if (!numeroOficio) return false;

    const select = document.getElementById('doc-oficio-referencia');
    const numeroNormalizado = numeroOficio.toUpperCase().replace(/\s+/g, '');

    console.log('Buscando oficio de referencia:', numeroOficio);

    // Extraer el número correlativo y año del oficio buscado
    const matchBuscado = numeroOficio.match(/(\d{5,6})-(\d{4})/);
    if (!matchBuscado) {
        console.log('No se pudo extraer correlativo del oficio:', numeroOficio);
        return false;
    }

    const correlativoBuscado = matchBuscado[1];
    const anioBuscado = matchBuscado[2];
    console.log('Buscando correlativo:', correlativoBuscado, 'año:', anioBuscado);

    // Buscar en las opciones
    for (let i = 0; i < select.options.length; i++) {
        const optionText = select.options[i].textContent.toUpperCase();

        // Buscar por correlativo y año
        if (optionText.includes(correlativoBuscado) && optionText.includes(anioBuscado)) {
            console.log('Encontrado:', optionText);
            select.value = select.options[i].value;
            onOficioReferenciaChange();
            return true;
        }
    }

    // Si no encontró con año, buscar solo por correlativo
    for (let i = 0; i < select.options.length; i++) {
        const optionText = select.options[i].textContent;
        if (optionText.includes(correlativoBuscado)) {
            console.log('Encontrado por correlativo:', optionText);
            select.value = select.options[i].value;
            onOficioReferenciaChange();
            return true;
        }
    }

    console.log('No se encontró el oficio en la lista');
    return false;
}

// ============================================
// BANDEJA DE DOCUMENTOS
// ============================================

async function cargarDocumentos() {
    // Determinar el ordenamiento según la categoría
    // - cartas-recibidas: ordenar por fecha del documento y fecha de subida
    // - oficios y cartas-nemaec: ordenar por número (año y correlativo)
    const ordenamiento = state.categoriaActual === 'cartas-recibidas' ? 'fecha' : 'numero';

    const filtros = {
        tipo_documento: document.getElementById('filtro-tipo').value,
        direccion: document.getElementById('filtro-direccion').value,
        busqueda: document.getElementById('filtro-busqueda').value,
        ordenar_por: ordenamiento,
        pagina: state.paginaActual,
        por_pagina: 100 // Cargar más para poder filtrar por referencia
    };

    try {
        // Si estamos en cartas-nemaec, cargar también los oficios para el mapa de referencias
        if (state.categoriaActual === 'cartas-nemaec') {
            const oficiosData = await apiListarDocumentos({ tipo_documento: 'oficio', por_pagina: 200 });
            state.oficiosDisponibles = oficiosData.documentos;
        }

        let data = await apiListarDocumentos(filtros);

        // Filtrar por oficio de referencia si hay filtro
        const filtroReferencia = document.getElementById('filtro-referencia').value.trim().toLowerCase();
        if (filtroReferencia && state.categoriaActual === 'cartas-nemaec') {
            // Crear mapa de oficios
            const oficiosMap = {};
            if (state.oficiosDisponibles) {
                state.oficiosDisponibles.forEach(ofi => {
                    oficiosMap[ofi.id] = (ofi.numero || '').toLowerCase();
                });
            }

            // Filtrar documentos que tienen referencia que coincide
            const documentosFiltrados = data.documentos.filter(doc => {
                if (!doc.documento_padre_id) return false;
                const numReferencia = oficiosMap[doc.documento_padre_id] || '';
                return numReferencia.includes(filtroReferencia);
            });

            data = {
                ...data,
                documentos: documentosFiltrados,
                total: documentosFiltrados.length
            };
        }

        renderizarDocumentos(data);
    } catch (error) {
        mostrarToast('Error al cargar documentos: ' + error.message, 'error');
    }
}

function renderizarDocumentos(data) {
    const container = document.getElementById('lista-documentos');
    const totalEl = document.getElementById('total-docs');

    totalEl.textContent = `${data.total} documento(s) encontrado(s)`;

    // Determinar colspan según si se muestra la columna de referencia
    const colspan = state.categoriaActual === 'cartas-nemaec' ? 7 : 6;

    if (data.documentos.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="${colspan}" class="px-4 py-8 text-center">
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

    // Verificar si mostrar columna de referencia (solo para cartas-nemaec)
    const mostrarReferencia = state.categoriaActual === 'cartas-nemaec';

    // Crear mapa de oficios para buscar el número del documento padre
    const oficiosMap = {};
    if (state.oficiosDisponibles) {
        state.oficiosDisponibles.forEach(ofi => {
            oficiosMap[ofi.id] = ofi.numero || `ID: ${ofi.id}`;
        });
    }

    // Clase para ocultar/mostrar columna de referencia
    const claseReferencia = mostrarReferencia ? '' : 'hidden';

    container.innerHTML = data.documentos.map((doc, index) => {
        // Obtener número del oficio de referencia si existe
        const oficioRef = doc.documento_padre_id ? (oficiosMap[doc.documento_padre_id] || '-') : '-';

        return `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-4 py-3 text-sm text-gray-900 font-medium cursor-pointer" onclick="verDetalle(${doc.id})">${offset + index + 1}</td>
            <td class="px-4 py-3 text-sm text-blue-600 font-medium cursor-pointer" onclick="verDetalle(${doc.id})">${doc.numero || 'Sin número'}</td>
            <td class="px-4 py-3 text-sm text-purple-600 cursor-pointer ${claseReferencia}" onclick="verDetalle(${doc.id})" title="Oficio de referencia">${oficioRef}</td>
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
    `}).join('');

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
            <a href="${window.location.origin}/uploads/${doc.archivo_local}" target="_blank"
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
            <div class="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg mb-2 hover:bg-gray-100 transition">
                <svg class="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                </svg>
                <a href="${adj.archivo_local ? `${window.location.origin}/uploads/${adj.archivo_local}` : adj.enlace_drive}"
                   target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline flex-1">
                    ${adj.nombre || adj.archivo_local || 'Adjunto'}
                </a>
            </div>
        `).join('');
    } else {
        adjuntosContainer.innerHTML = '<p class="text-gray-500 italic">No hay adjuntos</p>';
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
    document.getElementById('archivo-status').innerHTML = '';
    document.getElementById('ia-error').classList.add('hidden');
    document.getElementById('doc-whatsapp').value = '';
    document.getElementById('whatsapp-container').classList.add('hidden');
    // Limpiar campo de oficio de referencia
    document.getElementById('doc-oficio-referencia').value = '';
    document.getElementById('oficio-referencia-container').classList.add('hidden');
    document.getElementById('oficio-referencia-asunto').classList.add('hidden');
    // Limpiar adjuntos
    state.adjuntosTemporales = [];
    document.getElementById('lista-adjuntos-form').innerHTML = '';
    state.archivoTemporal = null;
}

function editarDocumento() {
    const doc = state.documentoActual;
    if (!doc) return;

    document.getElementById('form-titulo').textContent = 'Editar Documento';
    document.getElementById('doc-id').value = doc.id;

    // Mapear tipo_documento y direccion del backend al nuevo tipo del frontend
    let tipoFrontend;
    if (doc.tipo_documento === 'carta' && doc.direccion === 'enviado') {
        tipoFrontend = 'carta-nemaec';
    } else if (doc.tipo_documento === 'oficio') {
        tipoFrontend = 'oficio';
    } else if (doc.tipo_documento === 'carta' && doc.direccion === 'recibido') {
        tipoFrontend = 'carta-recibida';
    } else {
        tipoFrontend = doc.tipo_documento;
    }

    document.getElementById('doc-tipo').value = tipoFrontend;
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
        document.getElementById('archivo-status').innerHTML = `Archivo actual: <a href="${window.location.origin}/uploads/${doc.archivo_local}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${doc.archivo_local}</a>`;
    }

    // Activar la lógica de cambio de tipo para mostrar/ocultar campos
    onTipoDocumentoChange();

    // Renderizar adjuntos existentes
    renderizarAdjuntosForm();

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
    const tipoSeleccionado = document.getElementById('doc-tipo').value;

    // Mapear el tipo seleccionado a tipo_documento y direccion para el backend
    let tipoDocumento, direccion;
    switch (tipoSeleccionado) {
        case 'carta-nemaec':
            tipoDocumento = 'carta';
            direccion = 'enviado';
            break;
        case 'oficio':
            tipoDocumento = 'oficio';
            direccion = 'recibido';
            break;
        case 'carta-recibida':
            tipoDocumento = 'carta';
            direccion = 'recibido';
            break;
        default:
            tipoDocumento = tipoSeleccionado;
            direccion = document.getElementById('doc-direccion').value;
    }

    // Determinar documento padre: primero el oficio de referencia, luego el campo padre tradicional
    let documentoPadreId = document.getElementById('doc-oficio-referencia').value ||
                           document.getElementById('doc-padre').value || null;

    const documento = {
        tipo_documento: tipoDocumento,
        direccion: direccion,
        numero: numeroOficio,
        fecha: document.getElementById('doc-fecha').value || null,
        remitente: document.getElementById('doc-remitente').value || null,
        destinatario: document.getElementById('doc-destinatario').value || null,
        titulo: numeroOficio, // El título es el número de oficio
        asunto: document.getElementById('doc-asunto').value || null,
        resumen: document.getElementById('doc-resumen').value || null,
        enlace_drive: document.getElementById('doc-enlace').value || null,
        documento_padre_id: documentoPadreId
    };

    // Función para ir a la bandeja correspondiente según el tipo
    function irABandejaCorrespondiente() {
        mostrarVista('vista-bandeja');
        state.documentoActual = null;
        state.archivoTemporal = null;
        state.editando = false;

        switch (tipoSeleccionado) {
            case 'carta-nemaec':
                filtrarPorCategoria('cartas-nemaec');
                break;
            case 'oficio':
                filtrarPorCategoria('oficios');
                break;
            case 'carta-recibida':
                filtrarPorCategoria('cartas-recibidas');
                break;
            default:
                filtrarPorCategoria('oficios');
        }
    }

    try {
        let resultado;

        if (docId) {
            // Actualizar documento existente
            resultado = await apiActualizarDocumento(docId, documento);

            // Subir adjuntos temporales si hay
            if (state.adjuntosTemporales.length > 0) {
                await subirAdjuntosTemporales(docId);
            }

            mostrarToast('Documento actualizado correctamente');
            irABandejaCorrespondiente();
        } else {
            // Verificar si ya existe un documento con el mismo número
            let documentoExistente = null;
            if (numeroOficio) {
                const busqueda = await apiListarDocumentos({ busqueda: numeroOficio, por_pagina: 100 });
                documentoExistente = busqueda.documentos.find(doc =>
                    doc.numero && doc.numero.toLowerCase() === numeroOficio.toLowerCase()
                );
            }

            if (documentoExistente) {
                // Mostrar SweetAlert preguntando si desea reemplazar
                const confirmacion = await Swal.fire({
                    title: 'Documento ya existe',
                    html: `Ya existe un documento con el número <strong>${numeroOficio}</strong>.<br><br>¿Desea reemplazarlo?`,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Sí, reemplazar',
                    cancelButtonText: 'Cancelar'
                });

                if (confirmacion.isConfirmed) {
                    // Actualizar el documento existente
                    resultado = await apiActualizarDocumento(documentoExistente.id, documento);

                    // Si hay archivo temporal, asociarlo
                    if (state.archivoTemporal) {
                        const archivo = document.getElementById('doc-archivo').files[0];
                        if (archivo) {
                            await apiSubirArchivo(documentoExistente.id, archivo);
                        }
                    }

                    // Subir adjuntos temporales si hay
                    if (state.adjuntosTemporales.length > 0) {
                        await subirAdjuntosTemporales(documentoExistente.id);
                    }

                    mostrarToast('Documento reemplazado correctamente');
                    irABandejaCorrespondiente();
                }
                // Si cancela, no hace nada y el usuario puede seguir editando
            } else {
                // Crear nuevo documento
                resultado = await apiCrearDocumento(documento);

                // Si hay archivo temporal, asociarlo
                if (state.archivoTemporal) {
                    const archivo = document.getElementById('doc-archivo').files[0];
                    if (archivo) {
                        await apiSubirArchivo(resultado.id, archivo);
                    }
                }

                // Subir adjuntos temporales si hay
                if (state.adjuntosTemporales.length > 0) {
                    await subirAdjuntosTemporales(resultado.id);
                }

                mostrarToast('Documento creado correctamente');
                irABandejaCorrespondiente();
            }
        }
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
// MANEJO DE ADJUNTOS
// ============================================

function agregarAdjuntos() {
    const inputAdjunto = document.getElementById('nuevo-adjunto');
    const archivos = inputAdjunto.files;

    if (!archivos || archivos.length === 0) {
        mostrarToast('Seleccione al menos un archivo para adjuntar', 'error');
        return;
    }

    let agregados = 0;
    let duplicados = 0;

    // Procesar todos los archivos seleccionados
    for (const archivo of archivos) {
        // Verificar si ya existe un adjunto con el mismo nombre
        const yaExiste = state.adjuntosTemporales.some(adj => adj.name === archivo.name);
        if (yaExiste) {
            duplicados++;
            continue;
        }

        // Agregar al estado
        state.adjuntosTemporales.push(archivo);
        agregados++;
    }

    // Actualizar la lista visual
    renderizarAdjuntosForm();

    // Limpiar el input
    inputAdjunto.value = '';

    // Mostrar mensaje apropiado
    if (agregados > 0 && duplicados === 0) {
        mostrarToast(`${agregados} adjunto${agregados > 1 ? 's' : ''} agregado${agregados > 1 ? 's' : ''}`);
    } else if (agregados > 0 && duplicados > 0) {
        mostrarToast(`${agregados} agregado${agregados > 1 ? 's' : ''}, ${duplicados} duplicado${duplicados > 1 ? 's' : ''} omitido${duplicados > 1 ? 's' : ''}`);
    } else if (duplicados > 0) {
        mostrarToast('Los archivos ya están en la lista', 'error');
    }
}

function removerAdjunto(index) {
    state.adjuntosTemporales.splice(index, 1);
    renderizarAdjuntosForm();
}

async function removerAdjuntoExistente(adjuntoId) {
    const confirmacion = await Swal.fire({
        title: '¿Eliminar adjunto?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (confirmacion.isConfirmed) {
        try {
            await apiEliminarAdjunto(adjuntoId);
            mostrarToast('Adjunto eliminado');
            // Recargar el documento para actualizar la lista
            if (state.documentoActual) {
                const docActualizado = await apiObtenerDocumento(state.documentoActual.id);
                state.documentoActual = docActualizado;
                renderizarAdjuntosExistentes();
            }
        } catch (error) {
            mostrarToast('Error al eliminar adjunto: ' + error.message, 'error');
        }
    }
}

function renderizarAdjuntosForm() {
    const container = document.getElementById('lista-adjuntos-form');

    // Renderizar adjuntos existentes (si estamos editando)
    let htmlExistentes = '';
    if (state.documentoActual && state.documentoActual.adjuntos && state.documentoActual.adjuntos.length > 0) {
        htmlExistentes = '<div class="mb-3"><p class="text-sm font-medium text-gray-600 mb-2">Adjuntos guardados:</p>';
        htmlExistentes += state.documentoActual.adjuntos.map(adj => `
            <div class="flex items-center justify-between bg-white p-2 rounded border mb-1">
                <a href="${adj.archivo_local ? `${window.location.origin}/uploads/${adj.archivo_local}` : adj.enlace_drive}"
                   target="_blank" class="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    ${adj.nombre || adj.archivo_local || 'Adjunto'}
                </a>
                <button type="button" onclick="removerAdjuntoExistente(${adj.id})"
                        class="text-red-500 hover:text-red-700 p-1" title="Eliminar adjunto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
        htmlExistentes += '</div>';
    }

    // Renderizar adjuntos temporales (nuevos)
    let htmlTemporales = '';
    if (state.adjuntosTemporales.length > 0) {
        htmlTemporales = '<div><p class="text-sm font-medium text-gray-600 mb-2">Nuevos adjuntos por guardar:</p>';
        htmlTemporales += state.adjuntosTemporales.map((archivo, index) => `
            <div class="flex items-center justify-between bg-orange-100 p-2 rounded border border-orange-300 mb-1">
                <span class="text-sm text-gray-700 flex items-center gap-2">
                    <svg class="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
                    </svg>
                    ${archivo.name}
                </span>
                <button type="button" onclick="removerAdjunto(${index})"
                        class="text-red-500 hover:text-red-700 p-1" title="Quitar adjunto">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
        `).join('');
        htmlTemporales += '</div>';
    }

    container.innerHTML = htmlExistentes + htmlTemporales;
}

function renderizarAdjuntosExistentes() {
    renderizarAdjuntosForm();
}

async function subirAdjuntosTemporales(documentoId) {
    for (const archivo of state.adjuntosTemporales) {
        try {
            await apiAgregarAdjunto(documentoId, archivo, null, archivo.name);
        } catch (error) {
            console.error('Error al subir adjunto:', archivo.name, error);
        }
    }
    state.adjuntosTemporales = [];
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
        statusEl.innerHTML = `Archivo subido: <a href="${window.location.origin}/uploads/${resultado.archivo}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">${resultado.archivo}</a>`;
        mostrarToast('Archivo subido correctamente');
    } catch (error) {
        statusEl.innerHTML = '<span class="text-red-600">Error al subir archivo</span>';
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

            // Auto-seleccionar tipo basado en el número detectado
            if (resultado.numero_oficio) {
                if (resultado.numero_oficio.toLowerCase().includes('oficio')) {
                    document.getElementById('doc-tipo').value = 'oficio';
                    onTipoDocumentoChange();
                } else if (resultado.numero_oficio.toLowerCase().includes('carta')) {
                    // Si es carta NEMAEC (enviada)
                    document.getElementById('doc-tipo').value = 'carta-nemaec';
                    onTipoDocumentoChange();
                }
            }

            // Si la IA detectó un oficio de referencia, intentar seleccionarlo
            if (resultado.oficio_referencia) {
                console.log('Oficio de referencia detectado por IA:', resultado.oficio_referencia);
                // Esperar a que se carguen los oficios y luego seleccionar
                setTimeout(() => {
                    seleccionarOficioPorNumero(resultado.oficio_referencia);
                }, 500);
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
    document.getElementById('doc-tipo').value = 'carta-nemaec';
    onTipoDocumentoChange();

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
