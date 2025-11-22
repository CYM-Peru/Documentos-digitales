import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_PROMPT = `Analiza este comprobante electrónico peruano (SUNAT) y extrae EXACTAMENTE los siguientes datos estructurados.

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

2. Busca el título del documento en la parte superior del comprobante.
3. También puedes identificarlo por la serie: F### = Factura, B### = Boleta.

═══════════════════════════════════════════════════════════════════════════════
🔍 REGLAS DE EXTRACCIÓN Y VALIDACIÓN
═══════════════════════════════════════════════════════════════════════════════

DATOS DEL EMISOR:
- rucEmisor: RUC de 11 dígitos (formato: ^[0-9]{11}$)
- razonSocialEmisor: Razón social completa (busca después de "RUC:" o en cabecera)
- domicilioFiscalEmisor: Dirección fiscal completa del emisor

DATOS DEL RECEPTOR:
- rucReceptor: RUC del cliente (11 dígitos, si existe)
- dniReceptor: DNI del cliente (8 dígitos, formato: ^[0-9]{8}$, si existe)
- razonSocialReceptor: Nombre o razón social del cliente

DATOS DEL COMPROBANTE:
- serieNumero: Serie y correlativo (formatos válidos: ^[BF][0-9]{3}-[0-9]{8}$ o ^[A-Z][0-9]{3}-[0-9]+$)
  Ejemplos: F001-00012345, B092-00272073
- invoiceDate: Fecha de emisión en formato YYYY-MM-DD

MONTOS Y TOTALES:
- subtotal: OP GRAVADA o "Valor de Venta" (base imponible SIN IGV)
  Busca: "OP GRAVADA", "OP. GRAVADA", "BASE IMPONIBLE", "VALOR VENTA"

- igvMonto: Monto del IGV (NO el porcentaje, busca el monto en soles/dólares)
  Busca: "I.G.V.", "IGV 18%", "IMPUESTO"

- igvTasa: Tasa del IGV (generalmente 18.0, pero puede ser 10.0 o derivarse del cálculo)
  Si no está explícita, calcular: igvTasa = (igvMonto / subtotal) * 100

- totalAmount: IMPORTE TOTAL o "TOTAL A PAGAR" (incluye IGV)
  Busca: "TOTAL A PAGAR", "IMPORTE TOTAL", "TOTAL S/"
  NO uses el "TOTAL" simple si hay otros totales parciales

- currency: Moneda (generalmente "PEN" para Soles, "USD" para Dólares)
  Busca: "S/", "PEN", "SOLES" → PEN | "$", "USD", "DÓLARES" → USD

═══════════════════════════════════════════════════════════════════════════════
✅ VALIDACIONES Y CONSISTENCIA
═══════════════════════════════════════════════════════════════════════════════

1. VALIDACIÓN DE CÁLCULOS:
   Verifica que: subtotal + igvMonto ≈ totalAmount (tolerancia: ±0.05)
   Verifica que: (subtotal * igvTasa/100) ≈ igvMonto (tolerancia: ±0.05)

2. VALIDACIÓN DE FORMATOS:
   - RUC: exactamente 11 dígitos numéricos
   - DNI: exactamente 8 dígitos numéricos
   - Fecha: formato YYYY-MM-DD
   - Serie: debe coincidir con el tipo de documento

3. VALIDACIÓN DE CÓDIGO QR (si existe):
   Si hay un código QR SUNAT, extrae y valida:
   - RUC del emisor
   - Tipo de comprobante
   - Serie y número
   - Fecha de emisión
   - Total
   Los datos del QR deben coincidir con los datos visuales.

═══════════════════════════════════════════════════════════════════════════════
📤 FORMATO DE SALIDA JSON
═══════════════════════════════════════════════════════════════════════════════

Retorna ÚNICAMENTE un objeto JSON con esta estructura exacta:

{
  "documentType": "FACTURA ELECTRÓNICA",
  "documentTypeCode": "01",
  "vendorName": "Nombre comercial del emisor",
  "rucEmisor": "20123456789",
  "razonSocialEmisor": "EMPRESA S.A.C.",
  "domicilioFiscalEmisor": "Av. Principal 123, Lima, Perú",
  "serieNumero": "F001-00012345",
  "invoiceDate": "2025-11-02",
  "subtotal": 100.00,
  "igvTasa": 18.0,
  "igvMonto": 18.00,
  "totalAmount": 118.00,
  "currency": "PEN",
  "rucReceptor": "20987654321",
  "dniReceptor": null,
  "razonSocialReceptor": "CLIENTE S.A."
}

REGLAS FINALES:
- Si un campo no existe o no se puede leer, usa null
- Los números DEBEN ser números (Float), NO strings
- Las fechas DEBEN ser strings en formato YYYY-MM-DD
- NO incluyas comentarios en el JSON
- NO incluyas texto adicional fuera del JSON
- Responde SOLO con el JSON válido`

async function setDefaultPrompt() {
  try {
    console.log('🔄 Configurando prompt por defecto en la base de datos...')

    const settings = await prisma.organizationSettings.findFirst()

    if (!settings) {
      console.log('❌ No se encontró configuración de organización')
      return
    }

    await prisma.organizationSettings.update({
      where: { id: settings.id },
      data: {
        geminiPrompt: DEFAULT_PROMPT,
      },
    })

    console.log('✅ Prompt por defecto configurado exitosamente')
    console.log('\n📋 Prompt guardado:')
    console.log('─'.repeat(80))
    console.log(DEFAULT_PROMPT)
    console.log('─'.repeat(80))
    console.log('\n🌐 Ahora puedes verlo en: http://cockpit.azaleia.com.pe/admin')
    console.log('   Tab: 🤖 Gemini AI → Sección: Prompt Personalizado\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setDefaultPrompt()
