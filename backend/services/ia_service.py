"""
Servicio de análisis de documentos con IA (OpenAI API)
Con soporte OCR para PDFs con texto no extraíble
"""
import os
import json
import re
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv

# Cargar .env desde el directorio del backend
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(env_path)

# Configuración de OCR
try:
    import pytesseract
    from pdf2image import convert_from_path
    from PIL import Image

    # Configurar rutas de Tesseract y Poppler en Windows
    TESSERACT_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    POPPLER_PATH = r"C:\Users\NEERIVADENEIRA\poppler\poppler-24.08.0\Library\bin"

    if os.path.exists(TESSERACT_PATH):
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH

    OCR_DISPONIBLE = True
    print("OCR habilitado correctamente")
except ImportError as e:
    OCR_DISPONIBLE = False
    POPPLER_PATH = None
    print(f"OCR no disponible: {e}")


def extraer_texto_ocr(ruta_pdf: str, solo_primera_pagina: bool = True) -> str:
    """
    Extrae texto de un PDF usando OCR (Tesseract).
    Útil cuando pdfplumber no puede extraer texto correctamente.

    Args:
        ruta_pdf: Ruta al archivo PDF
        solo_primera_pagina: Si es True, solo procesa la primera página (más rápido)

    Returns:
        Texto extraído con OCR
    """
    if not OCR_DISPONIBLE:
        print("OCR no disponible - pytesseract o pdf2image no instalados")
        return ""

    try:
        print(f"Iniciando OCR para: {ruta_pdf}")

        # Convertir PDF a imágenes
        if solo_primera_pagina:
            images = convert_from_path(
                ruta_pdf,
                first_page=1,
                last_page=1,
                poppler_path=POPPLER_PATH,
                dpi=300  # Mayor DPI = mejor calidad de OCR
            )
        else:
            images = convert_from_path(
                ruta_pdf,
                poppler_path=POPPLER_PATH,
                dpi=300
            )

        texto_ocr = ""
        for i, imagen in enumerate(images):
            print(f"Procesando página {i + 1} con OCR...")
            # Extraer texto con Tesseract (inglés funciona bien para números y texto formal)
            texto_pagina = pytesseract.image_to_string(imagen, lang='eng')
            texto_ocr += texto_pagina + "\n"

        print(f"OCR completado. Caracteres extraídos: {len(texto_ocr)}")
        return texto_ocr

    except Exception as e:
        print(f"Error en OCR: {e}")
        return ""


def extraer_numero_con_ocr(ruta_pdf: str) -> str:
    """
    Extrae específicamente el número de oficio/carta usando OCR.
    Solo procesa la primera página donde suele estar el encabezado.
    IMPORTANTE: Busca el número en el ENCABEZADO, ignorando la sección de referencias.

    Args:
        ruta_pdf: Ruta al archivo PDF

    Returns:
        Número de oficio encontrado o cadena vacía
    """
    texto_ocr = extraer_texto_ocr(ruta_pdf, solo_primera_pagina=True)

    if not texto_ocr:
        return ""

    print("=" * 50)
    print("TEXTO OCR (primeros 500 caracteres):")
    print(texto_ocr[:500])
    print("=" * 50)

    # Extraer solo el texto del ENCABEZADO (antes de "Referencia", "Señor", "De mi consideración")
    # Esto evita capturar números de oficios mencionados en la sección de referencias
    texto_encabezado = texto_ocr
    for marcador in ['Referencia', 'REFERENCIA', 'Señor', 'SEÑOR', 'Señora', 'SEÑORA', 'De mi consideración']:
        pos = texto_ocr.find(marcador)
        if pos > 0 and pos < len(texto_encabezado):
            texto_encabezado = texto_ocr[:pos]

    print("=" * 50)
    print("TEXTO ENCABEZADO (para extraer número):")
    print(texto_encabezado[:300])
    print("=" * 50)

    # Buscar patrones de número de oficio/carta en el ENCABEZADO
    patrones = [
        # Carta N° 001-2026-NEMAEC/PRESIDENCIA (formato NEMAEC - prioridad alta)
        r'Carta\s*N[°º]?\s*(\d{3})\s*-\s*(\d{4})\s*-\s*(NEMAEC/PRESIDENCIA)',
        # OFICIO N° 000035-2026-MIDIS/FONCODES/UGPE
        r'OFICIO\s*N[°º]?\s*(\d{5,6})\s*-\s*(\d{4})\s*-\s*(\S+)',
        # CARTA N° 000035-2026-MIDIS/FONCODES/UGPE
        r'CARTA\s*N[°º]?\s*(\d{5,6})\s*-\s*(\d{4})\s*-\s*(\S+)',
        # Formatos más flexibles
        r'OFICIO\s*N[°º]?\s*(\d{3,6})\s*-\s*(\d{4})',
        r'CARTA\s*N[°º]?\s*(\d{3,6})\s*-\s*(\d{4})',
    ]

    for patron in patrones:
        match = re.search(patron, texto_encabezado, re.IGNORECASE)
        if match:
            grupos = match.groups()
            anio = grupos[1]
            sufijo = grupos[2] if len(grupos) > 2 else "MIDIS/FONCODES/UGPE"

            # Verificar si es formato NEMAEC (3 dígitos) o estándar (5 dígitos)
            if "NEMAEC" in sufijo:
                numero = grupos[0].zfill(3)
                resultado = f"Carta N° {numero}-{anio}-{sufijo}"
            else:
                numero = grupos[0].zfill(5)
                # Determinar si es oficio o carta
                tipo = "OFICIO" if "OFICIO" in patron else "CARTA"
                resultado = f"{tipo} N°{numero}-{anio}-{sufijo}"

            print(f"Número encontrado con OCR (del encabezado): {resultado}")
            return resultado

    print("No se encontró número de oficio/carta con OCR en el encabezado")
    return ""


def extraer_oficio_referencia(texto: str) -> str:
    """
    Extrae el número de oficio de referencia de una carta.
    Busca en la sección "Referencia:" el número de OFICIO.
    """
    # Buscar la sección de referencia
    patrones_referencia = [
        # Referencia: a) OFICIO N° 000336-2025-MIDIS/FONCODES/UGPE
        r'Referencia[:\s]+(?:[a-z]\)[\s]*)?(OFICIO\s*N[°º]?\s*\d{5,6}\s*-\s*\d{4}\s*-\s*\S+)',
        # Ref: OFICIO N° 000336-2025-MIDIS/FONCODES/UGPE
        r'Ref[.:\s]+(?:[a-z]\)[\s]*)?(OFICIO\s*N[°º]?\s*\d{5,6}\s*-\s*\d{4}\s*-\s*\S+)',
        # OFICIO N° después de Referencia en cualquier formato
        r'Referencia[^O]*(OFICIO\s*N[°º]?\s*\d{5,6}\s*-\s*\d{4}\s*-\s*[A-Z/]+)',
    ]

    for patron in patrones_referencia:
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            oficio = match.group(1).strip()
            # Normalizar formato: OFICIO N°XXXXX-YYYY-SUFIJO
            oficio = re.sub(r'\s+', '', oficio)  # Quitar espacios extra
            oficio = re.sub(r'N[°º]?', 'N°', oficio)  # Normalizar N°
            print(f"Oficio de referencia encontrado: {oficio}")
            return oficio

    return ""


def extraer_numero_oficio(texto: str) -> str:
    """
    Extrae el número de oficio combinando información del nombre del archivo y del contenido del PDF.
    Formato final: "OFICIO N°00030-2026-MIDIS/FONCODES/UGPE"
    IMPORTANTE: Busca el número en el ENCABEZADO, ignorando la sección de referencias.
    """
    numero_correlativo = ""
    anio = ""

    # 1. Buscar el número correlativo en el nombre del archivo (si no es nombre corto de Windows)
    match_nombre = re.search(r'NOMBRE DEL ARCHIVO:\s*(.+?)\.pdf', texto, re.IGNORECASE)
    if match_nombre:
        nombre_archivo = match_nombre.group(1).strip()
        # Ignorar nombres cortos de Windows (como OFICIO~1)
        if '~' not in nombre_archivo:
            # Buscar patrón: OFICIO-000030-2026 o similar
            patron_numero = re.search(r'(\d{5,6})[- ]?(\d{4})', nombre_archivo)
            if patron_numero:
                numero_correlativo = patron_numero.group(1)
                anio = patron_numero.group(2)

    # 2. Si no encontramos en el nombre, buscar en el contenido del PDF
    #    PERO solo en el ENCABEZADO (antes de "Referencia", "Señor", etc.)
    if not numero_correlativo:
        # Extraer solo el texto del ENCABEZADO para evitar capturar números de la sección de referencias
        texto_encabezado = texto
        for marcador in ['Referencia', 'REFERENCIA', 'Señor', 'SEÑOR', 'Señora', 'SEÑORA', 'De mi consideración']:
            pos = texto.find(marcador)
            if pos > 0 and pos < len(texto_encabezado):
                texto_encabezado = texto[:pos]

        # Primero buscar formato NEMAEC: Carta N° 001-2026-NEMAEC/PRESIDENCIA
        patron_nemaec = re.search(r'Carta\s*N[°º]?\s*(\d{3})\s*-\s*(\d{4})\s*-\s*(NEMAEC/PRESIDENCIA)', texto_encabezado, re.IGNORECASE)
        if patron_nemaec:
            numero_correlativo = patron_nemaec.group(1).zfill(3)
            anio = patron_nemaec.group(2)
            return f"Carta N° {numero_correlativo}-{anio}-NEMAEC/PRESIDENCIA"

        # Buscar "OFICIO N°00030-2026" con número explícito en el encabezado
        patron_pdf = re.search(r'OFICIO\s*N[°º]?\s*(\d{5,6})\s*-\s*(\d{4})', texto_encabezado, re.IGNORECASE)
        if patron_pdf:
            numero_correlativo = patron_pdf.group(1)
            anio = patron_pdf.group(2)

    # 3. Si aún no tenemos número, NO inventar uno - dejar que la IA lo extraiga
    # Pero sí extraer el año si lo encontramos
    if not anio:
        patron_anio = re.search(r'-\s*(202\d)\s*-\s*MIDIS', texto)
        if patron_anio:
            anio = patron_anio.group(1)
        else:
            anio = "2026"  # Año por defecto

    # 4. Formatear el número correlativo (5 dígitos) solo si lo encontramos
    if numero_correlativo:
        numero_correlativo = numero_correlativo.zfill(5)
        return f"OFICIO N°{numero_correlativo}-{anio}-MIDIS/FONCODES/UGPE"

    # Si no encontramos número, retornar vacío para que la IA lo maneje
    return ""


class IAService:
    """
    Servicio para análisis de documentos institucionales usando OpenAI.
    Genera título, asunto y resumen de manera automática.
    """

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None

    def analizar_documento(self, texto: str) -> dict:
        """
        Analiza el texto de un documento y genera título, asunto y resumen.

        Args:
            texto: Contenido textual del documento

        Returns:
            dict con titulo, asunto, resumen, exito y mensaje
        """
        if not self.client:
            return {
                "numero_oficio": "",
                "fecha": "",
                "remitente": "",
                "destinatario": "",
                "asunto": "",
                "resumen": "",
                "mensaje_whatsapp": "",
                "oficio_referencia": "",
                "exito": False,
                "mensaje": "API de IA no configurada. Configure OPENAI_API_KEY en .env"
            }

        if not texto or len(texto.strip()) < 50:
            return {
                "numero_oficio": "",
                "fecha": "",
                "remitente": "",
                "destinatario": "",
                "asunto": "",
                "resumen": "",
                "mensaje_whatsapp": "",
                "oficio_referencia": "",
                "exito": False,
                "mensaje": "El texto es muy corto para analizar. Se requieren al menos 50 caracteres."
            }

        # Log para depuración - ver primeras líneas del texto extraído
        # Usar repr() para evitar UnicodeEncodeError en Windows
        print("=" * 50)
        print("TEXTO EXTRAÍDO DEL PDF (primeros 1000 caracteres):")
        try:
            print(texto[:1000])
        except UnicodeEncodeError:
            print(f"[Texto con caracteres especiales - longitud: {len(texto[:1000])}]")
        print("=" * 50)

        prompt = f"""Analiza el siguiente documento institucional (oficio o carta) y extrae la información:

1. **Número de Oficio**: MUY IMPORTANTE - Busca el número de oficio:
   - PRIMERO busca en el NOMBRE DEL ARCHIVO (línea que dice "NOMBRE DEL ARCHIVO:").
     Ejemplo: "Oficio Nro 00003-2025-MIDIS FONCODES UGPE.pdf" → extraer "OFICIO N°00003-2025-MIDIS/FONCODES/UGPE"
   - Si el nombre tiene formato "OF00003" o "Oficio Nro 00003", extraer el número 00003
   - También busca en el encabezado del documento
   - El número correlativo tiene 5 dígitos (00001, 00003, 00031, etc.)
   - Formato final: "OFICIO N°00003-2025-MIDIS/FONCODES/UGPE"
   - Reemplaza espacios por guiones o barras según corresponda

2. **Fecha**: Extrae la fecha del documento en formato YYYY-MM-DD
3. **Remitente**: Persona que firma el documento (busca al final del documento)
4. **Destinatario**: Persona a quien va dirigido (busca después de "Señor:", "Sr.", "A:")
5. **Asunto**: El asunto principal del documento (máximo 200 caracteres)
6. **Resumen**: Resumen CONCISO de 2-3 líneas:
   - QUÉ PIDE el oficio (las acciones concretas, sin mencionar adjuntos)
   - PARA CUÁNDO (fechas límite si las hay)
   - NO menciones al destinatario
   - Sé directo, sin rodeos ni detalles innecesarios
   - Ejemplo: "Se solicita: 1) Convocar proceso de selección para contratista, 2) Validar la ficha técnica. Proyecto: CPNP Alfonso Ugarte."
   (máximo 350 caracteres)
7. **Mensaje WhatsApp**: Genera un mensaje corto para compartir por WhatsApp con este formato exacto:
   "[NÚMERO DE OFICIO COMPLETO]
   Asunto: [ASUNTO BREVE]
   Resumen: [Qué pide y para cuándo, sin mencionar adjuntos ni destinatario]"
   IMPORTANTE: Sé CONCISO y directo. Solo: qué pide + para cuándo + nombre del proyecto si aplica.

8. **Oficio de Referencia**: Si el documento es una CARTA que responde a un OFICIO:
   - Busca en la sección "Referencia:", "Ref:", "REF." o similar
   - La referencia puede tener formato con letras: "Referencia: a) OFICIO N°..." o "Referencia: OFICIO N°..."
   - Extrae SOLO el número del OFICIO (no convocatorias, no convenios)
   - Ejemplo 1: "Referencia: OFICIO N°00030-2026-MIDIS/FONCODES/UGPE" → extraer "OFICIO N°00030-2026-MIDIS/FONCODES/UGPE"
   - Ejemplo 2: "Referencia: a) OFICIO N° 000336-2025-MIDIS/FONCODES/UGPE" → extraer "OFICIO N°000336-2025-MIDIS/FONCODES/UGPE"
   - Si hay múltiples referencias (a, b, c), extrae solo el OFICIO, ignorando convocatorias
   - Si no hay referencia a un OFICIO, dejar vacío ""

IMPORTANTE:
- El NOMBRE DEL ARCHIVO es la fuente más confiable para el número de oficio
- Si el nombre del archivo tiene "00003" o similar, ese es el número correlativo
- No dejes espacios en blanco en el número de oficio
- En el resumen SIEMPRE indica qué quiere y para cuándo
- No inventes información

Documento a analizar:
---
{texto[:8000]}
---

Responde ÚNICAMENTE con un JSON válido:
{{
    "numero_oficio": "OFICIO N°00003-2025-MIDIS/FONCODES/UGPE",
    "fecha": "2025-12-29",
    "remitente": "nombre completo del remitente",
    "destinatario": "nombre completo del destinatario",
    "asunto": "asunto del documento",
    "resumen": "resumen indicando qué solicita y para cuándo",
    "mensaje_whatsapp": "OFICIO N°00003-2025-MIDIS/FONCODES/UGPE\\nAsunto: Solicitud de información\\nResumen: Se solicita a UGPE enviar información de proyectos para el 15 de enero 2025",
    "oficio_referencia": "OFICIO N°00030-2026-MIDIS/FONCODES/UGPE"
}}"""

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Extraer el texto de la respuesta
            content = response.choices[0].message.content.strip()

            # Limpiar posibles caracteres extra
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            # Parsear JSON
            resultado = json.loads(content)

            # Extraer datos
            asunto = resultado.get("asunto", "")[:500]
            resumen = resultado.get("resumen", "")

            # Extraer número de oficio del nombre del archivo o PDF (prioridad sobre IA)
            numero_oficio = extraer_numero_oficio(texto)
            if not numero_oficio:
                # Si no se pudo extraer, usar lo que devolvió la IA
                numero_oficio = resultado.get("numero_oficio", "")

            # Construir mensaje WhatsApp con formato correcto
            mensaje_whatsapp = f"{numero_oficio}\nAsunto: {asunto}\nResumen: {resumen}"

            # Extraer oficio de referencia: primero intentar con regex, luego usar lo de la IA
            oficio_referencia = extraer_oficio_referencia(texto)
            if not oficio_referencia:
                oficio_referencia = resultado.get("oficio_referencia", "")

            return {
                "numero_oficio": numero_oficio,
                "fecha": resultado.get("fecha", ""),
                "remitente": resultado.get("remitente", ""),
                "destinatario": resultado.get("destinatario", ""),
                "asunto": asunto,
                "resumen": resumen,
                "mensaje_whatsapp": mensaje_whatsapp,
                "oficio_referencia": oficio_referencia,
                "exito": True,
                "mensaje": "Análisis completado exitosamente"
            }

        except json.JSONDecodeError as e:
            return {
                "numero_oficio": "",
                "fecha": "",
                "remitente": "",
                "destinatario": "",
                "asunto": "",
                "resumen": "",
                "mensaje_whatsapp": "",
                "oficio_referencia": "",
                "exito": False,
                "mensaje": f"Error al procesar respuesta de IA: {str(e)}"
            }
        except Exception as e:
            return {
                "numero_oficio": "",
                "fecha": "",
                "remitente": "",
                "destinatario": "",
                "asunto": "",
                "resumen": "",
                "mensaje_whatsapp": "",
                "oficio_referencia": "",
                "exito": False,
                "mensaje": f"Error en análisis IA: {str(e)}"
            }


# Instancia global del servicio
ia_service = IAService()
