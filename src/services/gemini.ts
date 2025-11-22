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
      const defaultPrompt = `Analiza este comprobante electrónico peruano (SUNAT) y extrae EXACTAMENTE los siguientes datos estructurados.

Este sistema procesa tres tipos de documentos:
1. 📄 COMPROBANTES ELECTRÓNICOS (Facturas, Boletas, etc.) para Rendiciones y Cajas Chicas
2. 💰 CAJAS CHICAS (Comprobantes de gastos menores sin factura formal)
3. 🚗 PLANILLAS DE MOVILIDAD (Gastos de transporte y movilidad)

═══════════════════════════════════════════════════════════════════════════════
📋 IDENTIFICACIÓN DEL TIPO DE DOCUMENTO
═══════════════════════════════════════════════════════════════════════════════

1. Identifica el tipo de comprobante según SUNAT Catálogo 01:
   - FACTURA ELECTRÓNICA → código "01"
   - BOLETA DE VENTA ELECTRÓNICA → código "03"
   - NOTA DE CRÉDITO ELECTRÓNICA → código "07"
   - NOTA DE DÉBITO ELECTRÓNICA → código "08"
   - GUÍA DE REMISIÓN ELECTRÓNICA → código "09"
   - RECIBO POR HONORARIOS ELECTRÓNICO → código "12"
   - COMPROBANTE DE RETENCIÓN ELECTRÓNICO → código "20"
   - COMPROBANTE DE PERCEPCIÓN ELECTRÓNICO → código "40"
   - TICKET/VALE (sin RUC) → código "99" (para Caja Chica)
   - PLANILLA DE MOVILIDAD → código "MOVILIDAD" (documento interno)

2. Busca el título del documento en la parte superior del comprobante.
3. También puedes identificarlo por la serie: F### = Factura, B### = Boleta.
4. IMPORTANTE - CAJAS CHICAS:
   - Tickets sin RUC del emisor son válidos para Caja Chica
   - Tickets de supermercados, farmacias, taxis, etc.
   - Recibos simples sin serie ni RUC
   - Boletas de venta de pequeños comercios
5. IMPORTANTE - PLANILLAS DE MOVILIDAD:
   - Documentos internos con gastos de transporte
   - Pueden ser formularios impresos o manuscritos
   - Incluyen: fecha, origen, destino, monto, motivo del viaje

═══════════════════════════════════════════════════════════════════════════════
🔍 REGLAS DE EXTRACCIÓN Y VALIDACIÓN
═══════════════════════════════════════════════════════════════════════════════

DATOS DEL EMISOR:
- rucEmisor: RUC de 11 dígitos (formato: ^[0-9]{11}$)
  ⚠️ IMPORTANTE PARA CAJA CHICA:
  * Si es un ticket/vale SIN RUC visible → usa "00000000000" o null
  * Tickets de taxi, tiendas pequeñas, mercados → pueden no tener RUC
  * Esto es VÁLIDO para Caja Chica (gastos menores)

- razonSocialEmisor: Razón social completa (busca después de "RUC:" o en cabecera)
  * Si no hay razón social, extrae el nombre del negocio visible
  * Ejemplos: "TAXI", "BODEGA SAN MARTIN", "FARMACIA", etc.

- domicilioFiscalEmisor: Dirección fiscal completa del emisor
  * Puede ser null en tickets simples

DATOS DEL RECEPTOR:
- rucReceptor: RUC del cliente (11 dígitos, si existe)
- dniReceptor: DNI del cliente (8 dígitos, formato: ^[0-9]{8}$, si existe)
- razonSocialReceptor: Nombre o razón social del cliente
  * En Cajas Chicas, generalmente es el nombre del empleado

DATOS DEL COMPROBANTE:
- serieNumero: Serie y correlativo (formatos válidos: ^[BF][0-9]{3}-[0-9]{8}$ o ^[A-Z][0-9]{3}-[0-9]+$)
  Ejemplos: F001-00012345, B092-00272073

- invoiceDate: Fecha de emisión en formato YYYY-MM-DD
  ⚠️ IMPORTANTE - FORMATO DE FECHA PERUANA:
  * Los comprobantes peruanos usan formato DD/MM/YYYY (día/mes/año)
  * Ejemplo: "03/11/2025" = 3 de noviembre de 2025 → debes retornar "2025-11-03"
  * Ejemplo: "15/01/2025" = 15 de enero de 2025 → debes retornar "2025-01-15"
  * NO confundas día con mes: el primer número es siempre el DÍA (01-31)
  * El segundo número es siempre el MES (01-12)
  * Busca: "FECHA DE EMISIÓN", "FECHA EMIS", "EMITIDO EL", "FECHA:"

MONTOS Y TOTALES:
- subtotal: OP GRAVADA o "Valor de Venta" (base imponible SIN IGV)
  Busca: "OP GRAVADA", "OP. GRAVADA", "BASE IMPONIBLE", "VALOR VENTA"

  ⚠️ CASOS ESPECIALES:
  * CAJA CHICA - Tickets sin IGV desglosado:
    - Si solo muestra "TOTAL", usa ese valor como totalAmount
    - subtotal puede ser null o igual a totalAmount
    - igvMonto puede ser 0 o null

  * PLANILLAS DE MOVILIDAD:
    - El "monto" o "importe" es el totalAmount
    - subtotal e IGV generalmente no aplican

- igvMonto: Monto del IGV (NO el porcentaje, busca el monto en soles/dólares)
  Busca: "I.G.V.", "IGV 18%", "IMPUESTO"
  * En tickets de Caja Chica sin IGV desglosado → usa 0 o null

- igvTasa: Tasa del IGV (generalmente 18.0, pero puede ser 10.0 o derivarse del cálculo)
  Si no está explícita, calcular: igvTasa = (igvMonto / subtotal) * 100
  * En tickets sin IGV → usa 0 o null

- totalAmount: IMPORTE TOTAL o "TOTAL A PAGAR" (incluye IGV)
  Busca: "TOTAL A PAGAR", "IMPORTE TOTAL", "TOTAL S/", "TOTAL", "MONTO"
  * En Caja Chica: puede ser el único monto visible → SIEMPRE extrae este valor
  * En Planillas de Movilidad: busca "TOTAL VIAJE", "TOTAL DÍA", "TOTAL GENERAL"

- currency: Moneda (generalmente "PEN" para Soles, "USD" para Dólares)
  Busca: "S/", "PEN", "SOLES" → PEN | "$", "USD", "DÓLARES" → USD
  * Por defecto: "PEN" si no se especifica (Perú usa Soles)

═══════════════════════════════════════════════════════════════════════════════
✅ VALIDACIONES Y CONSISTENCIA
═══════════════════════════════════════════════════════════════════════════════

1. VALIDACIÓN DE CÁLCULOS:
   Para COMPROBANTES ELECTRÓNICOS formales:
   - Verifica que: subtotal + igvMonto ≈ totalAmount (tolerancia: ±0.05)
   - Verifica que: (subtotal * igvTasa/100) ≈ igvMonto (tolerancia: ±0.05)

   Para CAJA CHICA (tickets simples):
   - Si NO hay IGV desglosado → totalAmount es suficiente
   - subtotal puede ser null o igual a totalAmount
   - NO falles la validación si faltan datos de IGV

   Para PLANILLAS DE MOVILIDAD:
   - Solo valida que totalAmount sea consistente
   - Suma de montos de viaje + montos de día debe coincidir con total general

2. VALIDACIÓN DE FORMATOS:
   - RUC: exactamente 11 dígitos numéricos (puede ser "00000000000" para Caja Chica)
   - DNI: exactamente 8 dígitos numéricos
   - Fecha: formato YYYY-MM-DD
   - Serie: debe coincidir con el tipo de documento (puede ser null para Caja Chica)

3. VALIDACIÓN DE CÓDIGO QR (si existe):
   Si hay un código QR SUNAT, extrae el CONTENIDO COMPLETO del código QR.
   El código QR de SUNAT contiene todos los datos del comprobante separados por "|"
   Formato típico: RUC|TipoDoc|Serie|Numero|IGV|Total|Fecha|TipoDocReceptor|NumDocReceptor|Hash

   IMPORTANTE: Extrae el texto completo del QR y retórnalo en el campo "qrCode"
   Los datos del QR deben coincidir con los datos visuales del comprobante.

═══════════════════════════════════════════════════════════════════════════════
📤 FORMATO DE SALIDA JSON
═══════════════════════════════════════════════════════════════════════════════

Retorna ÚNICAMENTE un objeto JSON con esta estructura PLANA (NO anidada):

{
  "documentType": "FACTURA ELECTRÓNICA",
  "documentTypeCode": "01",
  "vendorName": "Nombre comercial del emisor",
  "rucEmisor": "20123456789",
  "razonSocialEmisor": "EMPRESA S.A.C.",
  "domicilioFiscalEmisor": "Av. Principal 123, Lima, Perú",
  "serieNumero": "F001-00012345",
  "invoiceNumber": "F001-00012345",
  "invoiceDate": "2025-11-02",
  "subtotal": 100.00,
  "igvTasa": 18.0,
  "igvMonto": 18.00,
  "totalAmount": 118.00,
  "currency": "PEN",
  "rucReceptor": "20987654321",
  "dniReceptor": null,
  "razonSocialReceptor": "CLIENTE S.A.",
  "qrCode": "20123456789|01|F001|00012345|18.00|118.00|02/11/2025|6|20987654321|xyz123"
}

EJEMPLOS DE RESPUESTAS:

EJEMPLO 1 - Factura Electrónica (caso completo):
{
  "documentType": "FACTURA ELECTRÓNICA",
  "documentTypeCode": "01",
  "vendorName": "COMERCIAL XYZ",
  "rucEmisor": "20123456789",
  "razonSocialEmisor": "COMERCIAL XYZ S.A.C.",
  "domicilioFiscalEmisor": "Av. Principal 123, Lima",
  "serieNumero": "F001-00012345",
  "invoiceNumber": "F001-00012345",
  "invoiceDate": "2025-11-19",
  "subtotal": 100.00,
  "igvTasa": 18.0,
  "igvMonto": 18.00,
  "totalAmount": 118.00,
  "currency": "PEN",
  "rucReceptor": "20987654321",
  "razonSocialReceptor": "EMPRESA ABC S.A."
}

EJEMPLO 2 - Ticket de Caja Chica (sin RUC, sin IGV desglosado):
{
  "documentType": "TICKET/VALE",
  "documentTypeCode": "99",
  "vendorName": "FARMACIA SAN JUAN",
  "rucEmisor": null,
  "razonSocialEmisor": "FARMACIA SAN JUAN",
  "domicilioFiscalEmisor": null,
  "serieNumero": null,
  "invoiceNumber": null,
  "invoiceDate": "2025-11-19",
  "subtotal": null,
  "igvTasa": null,
  "igvMonto": null,
  "totalAmount": 25.50,
  "currency": "PEN",
  "rucReceptor": null,
  "razonSocialReceptor": "Juan Pérez"
}

EJEMPLO 3 - Planilla de Movilidad:
{
  "documentType": "PLANILLA DE MOVILIDAD",
  "documentTypeCode": "MOVILIDAD",
  "vendorName": "TRANSPORTE INTERNO",
  "rucEmisor": null,
  "razonSocialEmisor": null,
  "domicilioFiscalEmisor": null,
  "serieNumero": null,
  "invoiceNumber": null,
  "invoiceDate": "2025-11-19",
  "subtotal": null,
  "igvTasa": null,
  "igvMonto": null,
  "totalAmount": 150.00,
  "currency": "PEN",
  "rucReceptor": null,
  "razonSocialReceptor": "María González"
}

IMPORTANTE:
- NO uses objetos anidados como "emisor": {...} o "comprobante": {...}
- TODOS los campos deben estar en el nivel raíz del JSON
- serieNumero debe incluir la serie Y número completos (ej: "B092-00272073")
- Para Caja Chica: campos como rucEmisor, serieNumero pueden ser null
- Para Planillas: la mayoría de campos pueden ser null excepto totalAmount

REGLAS FINALES:
- Si un campo no existe o no se puede leer, usa null
- Los números DEBEN ser números (Float), NO strings
- Las fechas DEBEN ser strings en formato YYYY-MM-DD
- NO incluyas comentarios en el JSON
- NO incluyas texto adicional fuera del JSON
- Responde SOLO con el JSON válido
- FLEXIBILIDAD: No falles si faltan datos en tickets simples o planillas
- PRIORIDAD: totalAmount es el campo MÁS IMPORTANTE, siempre extráelo`

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
}
