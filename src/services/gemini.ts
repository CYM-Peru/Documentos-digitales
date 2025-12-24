import { GoogleGenerativeAI } from '@google/generative-ai'

interface GeminiCredentials {
  apiKey: string
  model?: string
  customPrompt?: string
}

interface ExtractedInvoiceData {
  documentType?: string
  documentTypeCode?: string
  vendorName?: string
  rucEmisor?: string
  razonSocialEmisor?: string
  domicilioFiscalEmisor?: string
  serieNumero?: string
  invoiceNumber?: string
  invoiceDate?: Date
  subtotal?: number
  igvTasa?: number
  igvMonto?: number
  totalAmount?: number
  taxAmount?: number
  currency?: string
  rucReceptor?: string
  dniReceptor?: string
  razonSocialReceptor?: string
  qrCode?: string  // Contenido del código QR extraído
}

export class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: string
  private customPrompt?: string

  constructor(credentials: GeminiCredentials) {
    this.genAI = new GoogleGenerativeAI(credentials.apiKey)
    this.model = credentials.model || 'gemini-2.0-flash-exp'
    this.customPrompt = credentials.customPrompt
  }

  async analyzeInvoice(imageBuffer: Buffer): Promise<ExtractedInvoiceData> {
    try {
      console.log(`🤖 Gemini Vision - Analizando factura con IA real (${this.model})...`)

      const model = this.genAI.getGenerativeModel({ model: this.model })

      // Usar prompt personalizado si existe, sino usar el por defecto
      // Formato TOON (Token-Oriented Object Notation) - optimizado para LLMs
      const defaultPrompt = `Extrae datos de este comprobante peruano. Retorna JSON.

TIPOS_DOCUMENTO
documentType | documentTypeCode | identificadores
FACTURA ELECTRÓNICA | 01 | título "FACTURA", serie F###
BOLETA DE VENTA | 03 | título "BOLETA", serie B###
NOTA DE CRÉDITO | 07 | título "NOTA DE CRÉDITO"
NOTA DE DÉBITO | 08 | título "NOTA DE DÉBITO"
RECIBO POR HONORARIOS | 12 | título "RECIBO POR HONORARIOS"
RECIBO DE LUZ | SP | empresa luz (PLUZ, ENEL, LUZ DEL SUR), "Nro. Recibo"
RECIBO DE AGUA | SP | empresa agua (SEDAPAL), "Nro. Recibo"
RECIBO DE GAS | SP | empresa gas (CALIDDA), "Nro. Recibo"
RECIBO DE SERVICIO | SP | otros servicios públicos, "Nro. Recibo"
RECIBO DE TELÉFONO | SP | empresa telecom (MOVISTAR, CLARO, ENTEL, BITEL, TELEFÓNICA)
RECIBO DE INTERNET | SP | servicio internet (MOVISTAR, CLARO, WIN)
RECIBO SIMPLE | 98 | palabra "RECIBO", "Nº" en color rojo/destacado, sin serie formal
TICKET/VALE | 99 | sin RUC, tickets de taxi/tienda/mercado
PLANILLA MOVILIDAD | MOVILIDAD | formulario gastos transporte

CAMPOS_EXTRAER
campo | buscar | formato | notas
documentType | título documento | string | según tabla TIPOS_DOCUMENTO
documentTypeCode | - | string | código según tipo
rucEmisor | "RUC:" 11 dígitos | ^[0-9]{11}$ | null si ticket simple
razonSocialEmisor | después de RUC o cabecera | string | nombre negocio si no hay razón social
vendorName | nombre comercial visible | string | igual a razonSocialEmisor
domicilioFiscalEmisor | dirección fiscal | string | null en tickets
serieNumero | serie-número | ^[BF][0-9]{3}-[0-9]+$ | ver NÚMERO_RECIBO para recibos simples
invoiceNumber | igual serieNumero | string | número principal del documento
invoiceDate | "FECHA" DD/MM/YYYY | YYYY-MM-DD | convertir formato peruano
subtotal | "OP GRAVADA" "VALOR VENTA" | float | null en tickets sin IGV
igvTasa | porcentaje IGV | float | 18.0 típico, null si no aplica
igvMonto | monto IGV en soles | float | null en tickets sin IGV
totalAmount | "TOTAL" "IMPORTE" "S/." "LA CANTIDAD DE" | float | SIEMPRE extraer, campo más importante
currency | "S/" "PEN" "SOLES" | PEN/USD | default PEN
rucReceptor | RUC cliente 11 dígitos | string | null si no existe
dniReceptor | DNI cliente 8 dígitos | ^[0-9]{8}$ | null si no existe
razonSocialReceptor | "RECIBÍ DE" nombre cliente | string | persona que paga
qrCode | contenido QR SUNAT | string | formato RUC|TipoDoc|Serie|...|Hash

CRÍTICO_EMISOR_RECEPTOR (en recibos de servicios públicos/telecom)
  EMISOR = empresa de servicios (quien emite/cobra)
  RECEPTOR = cliente que paga
  Ejemplo MOVISTAR: rucEmisor="20100017491", razonSocialEmisor="TELEFONICA DEL PERU S.A.A."
  Ejemplo CLARO: rucEmisor="20467534026", razonSocialEmisor="AMERICA MOVIL PERU S.A.C."
  Si ves "CALZADOS AZALEIA" en recibo de luz/teléfono → es el RECEPTOR, no emisor

RUCs_SERVICIOS_COMUNES
  20100017491 = TELEFONICA DEL PERU (MOVISTAR)
  20467534026 = AMERICA MOVIL (CLARO)
  20514194353 = ENTEL PERU
  20601960550 = VIETTEL (BITEL)
  20269985900 = ENEL DISTRIBUCION
  20331898008 = LUZ DEL SUR
  20100152356 = SEDAPAL

NÚMERO_RECIBO (IMPORTANTE - buscar etiqueta explícita)
  buscar_etiquetas: "Nro. Recibo" "Número de Recibo" "N° Recibo" "Nro Recibo" "Recibo N°" "Recibo Nro"
  buscar_también: "Nº" "N°" "No." seguido de números (en recibos simples, usualmente en COLOR ROJO)
  ubicación: esquina superior derecha, cerca del título, en COLOR ROJO o destacado
  REGLA: el número está DESPUÉS de la etiqueta, NO antes
  FORMATO_SALIDA: serie-numero → "1-XXXXXX" (serie "1", guión, número del recibo)
  guardar_en: serieNumero e invoiceNumber
  ejemplo: "Nº 001611" → serieNumero="1-001611", invoiceNumber="1-001611"
  ejemplo: "Nº 001601" → serieNumero="1-001601", invoiceNumber="1-001601"
  ejemplo: "Nro. Recibo: 12345678" → serieNumero="1-12345678"

RECIBOS_INTERNOS_AZALEIA (recibos de caja chica de la empresa)
  identificar: título "calzados azaleia RECIBO" o "Azaleia Perú S.A."
  rucEmisor: SIEMPRE "20374412524" (RUC de Azaleia Perú)
  razonSocialEmisor: "CALZADOS AZALEIA PERU S.A." o "AZALEIA PERU S.A."
  documentType: "RECIBO SIMPLE"
  documentTypeCode: "98"
  serieNumero: formato "1-XXXXXX" donde XXXXXX es el número en rojo (Nº)
  campos_extraer:
    - Nº XXXXXX (en rojo) → serieNumero "1-XXXXXX"
    - Fecha (DD/MM/YY) → invoiceDate
    - S/. XX.XX → totalAmount
    - RECIBÍ DE → razonSocialReceptor (persona que recibe el dinero)
    - POR CONCEPTO → descripción del gasto

SERVICIOS_PÚBLICOS (Luz, Agua, Gas, Teléfono)
  tipo_documento: "RECIBO DE SERVICIO" o específico ("RECIBO DE LUZ", "RECIBO DE AGUA")
  documentTypeCode: "SP" (Servicio Público)
  campos_específicos:
    - Nro. Recibo / Número de Recibo → serieNumero, invoiceNumber
    - Código de Suministro / Nro. Suministro → guardar en descripción
    - Período / Mes de Consumo → guardar en descripción
    - Total a Pagar / Importe Total → totalAmount
    - Fecha de Vencimiento → invoiceDate
    - RUC de la empresa de servicios → rucEmisor
  empresas_comunes: PLUZ, ENEL, LUZ DEL SUR, SEDAPAL, CALIDDA

FECHA_PERUANA
  formato_entrada: DD/MM/YY o DD/MM/YYYY
  formato_salida: YYYY-MM-DD
  ejemplo: "21/10/25" → "2025-10-21"
  primer_número: DÍA (01-31)
  segundo_número: MES (01-12)

VALIDACIONES
  facturas: subtotal + igvMonto ≈ totalAmount (±0.05)
  tickets: solo totalAmount requerido
  recibos: totalAmount + número recibo requeridos

OUTPUT_JSON (estructura plana, sin anidar)
{
  "documentType": "string",
  "documentTypeCode": "string",
  "vendorName": "string|null",
  "rucEmisor": "string|null",
  "razonSocialEmisor": "string|null",
  "domicilioFiscalEmisor": "string|null",
  "serieNumero": "string|null",
  "invoiceNumber": "string|null",
  "invoiceDate": "YYYY-MM-DD|null",
  "subtotal": "float|null",
  "igvTasa": "float|null",
  "igvMonto": "float|null",
  "totalAmount": "float",
  "currency": "PEN|USD",
  "rucReceptor": "string|null",
  "dniReceptor": "string|null",
  "razonSocialReceptor": "string|null",
  "qrCode": "string|null"
}

EJEMPLOS
tipo | serieNumero | totalAmount | rucEmisor
FACTURA | F001-00012345 | 118.00 | 20123456789
BOLETA | B092-00272073 | 50.00 | 20123456789
RECIBO SIMPLE (Azaleia) | 1-001611 | 3.50 | 20374412524
RECIBO SIMPLE (Azaleia) | 1-001601 | 100.00 | 20374412524
RECIBO DE LUZ | S810-0005176310 | 9.50 | 20390413751
RECIBO DE AGUA | 87654321 | 45.00 | 20100152356
TICKET | null | 25.50 | null

REGLAS
- números: float NO string
- fechas: string YYYY-MM-DD
- null si no existe
- SOLO JSON válido, sin texto extra
- totalAmount SIEMPRE requerido`

      const prompt = this.customPrompt || defaultPrompt

      const imageParts = [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          },
        },
      ]

      const result = await model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = response.text()

      console.log('🤖 Gemini Vision - Respuesta recibida')
      console.log('📄 Gemini RAW Response (primeros 500 chars):', text.substring(0, 500))

      // Extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('❌ Gemini no retornó JSON válido. Respuesta completa:', text)
        throw new Error('Gemini no retornó JSON válido')
      }

      console.log('📋 JSON extraído:', jsonMatch[0].substring(0, 300))

      const data = JSON.parse(jsonMatch[0])

      // Convertir fecha si existe
      if (data.invoiceDate) {
        data.invoiceDate = new Date(data.invoiceDate)
      }

      console.log('✅ Gemini Vision - Datos extraídos:', {
        vendorName: data.vendorName || 'NOT FOUND',
        rucEmisor: data.rucEmisor || 'NOT FOUND',
        serieNumero: data.serieNumero || 'NOT FOUND',
        subtotal: data.subtotal || 'NOT FOUND',
        igvMonto: data.igvMonto || 'NOT FOUND',
        totalAmount: data.totalAmount || 'NOT FOUND',
      })

      return data
    } catch (error) {
      console.error('❌ Gemini Vision error:', error)
      throw new Error('Failed to analyze invoice with Gemini Vision')
    }
  }

  /**
   * Analiza una imagen de planilla de movilidad y extrae los datos estructurados
   */
  async analyzePlanillaMovilidad(imageBuffer: Buffer): Promise<{
    nombresApellidos?: string
    cargo?: string
    dni?: string
    centroCosto?: string
    periodo?: string
    gastos: Array<{
      fechaGasto: string
      motivo?: string
      origen?: string
      destino?: string
      montoViaje: number
    }>
    totalViaje: number
    totalGeneral: number
  }> {
    try {
      console.log(`🚗 Gemini Vision - Analizando planilla de movilidad (${this.model})...`)

      const model = this.genAI.getGenerativeModel({ model: this.model })

      const prompt = `Analiza esta PLANILLA DE MOVILIDAD y extrae los datos estructurados.

Una planilla de movilidad es un documento interno que registra gastos de transporte/movilidad de un trabajador.

═══════════════════════════════════════════════════════════════════════════════
📋 DATOS A EXTRAER
═══════════════════════════════════════════════════════════════════════════════

DATOS DEL TRABAJADOR:
- nombresApellidos: Nombre completo del trabajador (busca: "NOMBRES Y APELLIDOS", "TRABAJADOR", "NOMBRE")
- cargo: Puesto o cargo del trabajador (busca: "CARGO", "PUESTO")
- dni: Documento de identidad (8 dígitos, busca: "DNI", "DOCUMENTO")
- centroCosto: Centro de costo o área (busca: "CENTRO DE COSTO", "ÁREA", "DEPARTAMENTO")
- periodo: Período de la planilla (busca: "PERIODO", "MES", formato: "NOVIEMBRE 2025" o similar)

DETALLE DE GASTOS (lista de viajes):
Para cada fila/registro de gasto, extrae:
- fechaGasto: Fecha del viaje en formato YYYY-MM-DD
  ⚠️ IMPORTANTE: Las fechas peruanas son DD/MM/YYYY (día/mes/año)
  Ejemplo: "03/11/2025" = 3 de noviembre → retorna "2025-11-03"
- motivo: Motivo o razón del viaje (busca: "MOTIVO", "CONCEPTO", "DESCRIPCIÓN")
- origen: Lugar de origen (busca: "ORIGEN", "DESDE", "DE")
- destino: Lugar de destino (busca: "DESTINO", "HASTA", "A")
- montoViaje: Monto del viaje en soles (busca: "IMPORTE", "MONTO", "S/")

TOTALES:
- totalViaje: Suma total de todos los montos de viaje
- totalGeneral: Total general de la planilla

═══════════════════════════════════════════════════════════════════════════════
📤 FORMATO DE SALIDA JSON
═══════════════════════════════════════════════════════════════════════════════

{
  "nombresApellidos": "JUAN CARLOS PÉREZ RODRÍGUEZ",
  "cargo": "VENDEDOR",
  "dni": "12345678",
  "centroCosto": "VENTAS LIMA",
  "periodo": "NOVIEMBRE 2025",
  "gastos": [
    {
      "fechaGasto": "2025-11-01",
      "motivo": "Visita a cliente",
      "origen": "Oficina central",
      "destino": "San Isidro",
      "montoViaje": 15.00
    },
    {
      "fechaGasto": "2025-11-01",
      "motivo": "Retorno a oficina",
      "origen": "San Isidro",
      "destino": "Oficina central",
      "montoViaje": 15.00
    }
  ],
  "totalViaje": 30.00,
  "totalGeneral": 30.00
}

REGLAS:
- Si un campo no existe o no se puede leer, usa null (excepto gastos que debe ser array vacío)
- Los montos DEBEN ser números (Float), NO strings
- Las fechas DEBEN ser strings en formato YYYY-MM-DD
- Extrae TODOS los gastos/viajes que veas en la planilla
- Si hay una tabla de gastos, extrae cada fila como un elemento del array
- Responde SOLO con el JSON válido, sin texto adicional`

      const imageParts = [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          },
        },
      ]

      const result = await model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = response.text()

      console.log('🚗 Gemini Vision - Respuesta planilla recibida')
      console.log('📄 Gemini RAW Response (primeros 500 chars):', text.substring(0, 500))

      // Extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('❌ Gemini no retornó JSON válido. Respuesta completa:', text)
        throw new Error('Gemini no retornó JSON válido para planilla')
      }

      const data = JSON.parse(jsonMatch[0])

      console.log('✅ Gemini Vision - Datos planilla extraídos:', {
        nombresApellidos: data.nombresApellidos || 'NOT FOUND',
        cargo: data.cargo || 'NOT FOUND',
        dni: data.dni || 'NOT FOUND',
        gastosCount: data.gastos?.length || 0,
        totalGeneral: data.totalGeneral || 0,
      })

      return {
        nombresApellidos: data.nombresApellidos || null,
        cargo: data.cargo || null,
        dni: data.dni || null,
        centroCosto: data.centroCosto || null,
        periodo: data.periodo || null,
        gastos: data.gastos || [],
        totalViaje: data.totalViaje || 0,
        totalGeneral: data.totalGeneral || 0,
      }
    } catch (error) {
      console.error('❌ Gemini Vision planilla error:', error)
      throw new Error('Failed to analyze planilla with Gemini Vision')
    }
  }

  /**
   * Analiza una imagen de planilla de gastos reparables y extrae los datos estructurados
   */
  async analyzePlanillaGastoReparable(imageBuffer: Buffer): Promise<{
    nombresApellidos?: string
    cargo?: string
    dni?: string
    centroCosto?: string
    periodo?: string
    items: Array<{
      fechaGasto: string
      tipoDoc?: string
      concepto?: string
      tipoGasto?: string
      importe: number
    }>
    totalGeneral: number
  }> {
    try {
      console.log(`📄 Gemini Vision - Analizando planilla de gastos reparables (${this.model})...`)

      const model = this.genAI.getGenerativeModel({ model: this.model })

      const prompt = `Analiza esta PLANILLA DE GASTOS REPARABLES y extrae los datos estructurados.

Una planilla de gastos reparables es un documento interno que registra gastos sin comprobante de pago formal (gastos menores, taxis sin recibo, compras sin factura, etc).

═══════════════════════════════════════════════════════════════════════════════
📋 DATOS A EXTRAER
═══════════════════════════════════════════════════════════════════════════════

DATOS DEL TRABAJADOR:
- nombresApellidos: Nombre completo del trabajador (busca: "NOMBRES Y APELLIDOS", "TRABAJADOR", "NOMBRE")
- cargo: Puesto o cargo del trabajador (busca: "CARGO", "PUESTO")
- dni: Documento de identidad (8 dígitos, busca: "DNI", "DOCUMENTO")
- centroCosto: Centro de costo o área (busca: "CENTRO DE COSTO", "ÁREA", "DEPARTAMENTO", "CC")
- periodo: Período de la planilla (busca: "PERIODO", "MES", formato: "DICIEMBRE 2025" o similar)

DETALLE DE GASTOS (lista de items):
Para cada fila/registro de gasto, extrae:
- fechaGasto: Fecha del gasto en formato YYYY-MM-DD
  ⚠️ IMPORTANTE: Las fechas peruanas son DD/MM/YYYY (día/mes/año)
  Ejemplo: "15/12/2025" = 15 de diciembre → retorna "2025-12-15"
- tipoDoc: Tipo de documento (busca: "TIPO DOC", "TIPO DOCUMENTO")
  Valores comunes: "RECIBO", "BOLETA", "TICKET", "NINGUNO", "SIN COMPROBANTE"
- concepto: Concepto o descripción del gasto (busca: "CONCEPTO", "DESCRIPCIÓN", "DETALLE")
  Ejemplos: "Taxi", "Almuerzo", "Copias", "Útiles oficina"
- tipoGasto: Categoría o tipo de gasto (busca: "TIPO GASTO", "CATEGORÍA")
  Valores comunes: "MOVILIDAD", "ALIMENTACIÓN", "MATERIALES", "VARIOS"
- importe: Monto del gasto en soles (busca: "IMPORTE", "MONTO", "S/")

TOTAL:
- totalGeneral: Suma total de todos los importes

═══════════════════════════════════════════════════════════════════════════════
📤 FORMATO DE SALIDA JSON
═══════════════════════════════════════════════════════════════════════════════

{
  "nombresApellidos": "MARIA ELENA TORRES VEGA",
  "cargo": "ASISTENTE ADMINISTRATIVA",
  "dni": "87654321",
  "centroCosto": "ADMINISTRACIÓN",
  "periodo": "DICIEMBRE 2025",
  "items": [
    {
      "fechaGasto": "2025-12-01",
      "tipoDoc": "NINGUNO",
      "concepto": "Taxi a reunión con proveedor",
      "tipoGasto": "MOVILIDAD",
      "importe": 12.00
    },
    {
      "fechaGasto": "2025-12-02",
      "tipoDoc": "TICKET",
      "concepto": "Almuerzo de trabajo",
      "tipoGasto": "ALIMENTACIÓN",
      "importe": 25.00
    },
    {
      "fechaGasto": "2025-12-03",
      "tipoDoc": "RECIBO",
      "concepto": "Copias y anillados",
      "tipoGasto": "MATERIALES",
      "importe": 8.50
    }
  ],
  "totalGeneral": 45.50
}

REGLAS:
- Si un campo no existe o no se puede leer, usa null (excepto items que debe ser array vacío)
- Los importes DEBEN ser números (Float), NO strings
- Las fechas DEBEN ser strings en formato YYYY-MM-DD
- Extrae TODOS los gastos/items que veas en la planilla
- Si hay una tabla de gastos, extrae cada fila como un elemento del array
- Responde SOLO con el JSON válido, sin texto adicional`

      const imageParts = [
        {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg',
          },
        },
      ]

      const result = await model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = response.text()

      console.log('📄 Gemini Vision - Respuesta gasto reparable recibida')
      console.log('📄 Gemini RAW Response (primeros 500 chars):', text.substring(0, 500))

      // Extraer JSON de la respuesta
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('❌ Gemini no retornó JSON válido. Respuesta completa:', text)
        throw new Error('Gemini no retornó JSON válido para planilla de gastos reparables')
      }

      const data = JSON.parse(jsonMatch[0])

      console.log('✅ Gemini Vision - Datos gasto reparable extraídos:', {
        nombresApellidos: data.nombresApellidos || 'NOT FOUND',
        cargo: data.cargo || 'NOT FOUND',
        dni: data.dni || 'NOT FOUND',
        itemsCount: data.items?.length || 0,
        totalGeneral: data.totalGeneral || 0,
      })

      return {
        nombresApellidos: data.nombresApellidos || null,
        cargo: data.cargo || null,
        dni: data.dni || null,
        centroCosto: data.centroCosto || null,
        periodo: data.periodo || null,
        items: data.items || [],
        totalGeneral: data.totalGeneral || 0,
      }
    } catch (error) {
      console.error('❌ Gemini Vision gasto reparable error:', error)
      throw new Error('Failed to analyze planilla gasto reparable with Gemini Vision')
    }
  }
}
