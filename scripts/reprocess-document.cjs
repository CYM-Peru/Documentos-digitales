/**
 * Script para reprocesar un documento específico con OCR
 *
 * Uso: node scripts/reprocess-document.cjs <documentId>
 * Ejemplo: node scripts/reprocess-document.cjs cmjh9yms2000su4mu6wn8vz8x
 */

const { PrismaClient } = require('@prisma/client')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const CryptoJS = require('crypto-js')
const sql = require('mssql')
const fs = require('fs')
const path = require('path')

// Clave de encriptación (debe coincidir con la del sistema)
const ENCRYPTION_KEY = 'VZiDXD4ZTjgs4FuOlWdvDboOBm7ctFE3lUPRd/wa19E='

function decrypt(encryptedText) {
  if (!encryptedText) return ''
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.error('Error desencriptando:', error)
    return ''
  }
}

const prisma = new PrismaClient()

// Prompt mejorado para OCR
const IMPROVED_PROMPT = `Analiza este comprobante electrónico peruano (SUNAT) y extrae EXACTAMENTE los siguientes datos estructurados.

TIPOS DE DOCUMENTO SUNAT:
- FACTURA ELECTRÓNICA → código "01"
- BOLETA DE VENTA ELECTRÓNICA → código "03"
- NOTA DE CRÉDITO ELECTRÓNICA → código "07"
- NOTA DE DÉBITO ELECTRÓNICA → código "08"
- RECIBO POR HONORARIOS ELECTRÓNICO → código "12"
- RECIBO DE TELÉFONO → código "SP" (MOVISTAR, CLARO, ENTEL, BITEL)
- RECIBO DE INTERNET → código "SP" (servicios)
- RECIBO DE LUZ → código "SP" (ENEL, LUZ DEL SUR, PLUZ)
- RECIBO DE AGUA → código "SP" (SEDAPAL)
- TICKET/VALE → código "99"

⚠️ CRÍTICO - EMISOR vs RECEPTOR en recibos de servicios:
- El EMISOR es la EMPRESA DE SERVICIOS (quien emite el recibo)
- El RECEPTOR es el CLIENTE que paga el servicio
- Ejemplo: En un recibo de MOVISTAR, el emisor es TELEFONICA DEL PERU S.A.A. (RUC 20100017491)

RUCs de empresas de servicios comunes:
- 20100017491 = TELEFONICA DEL PERU S.A.A. (MOVISTAR)
- 20467534026 = AMERICA MOVIL PERU S.A.C. (CLARO)
- 20514194353 = ENTEL PERU S.A. (ENTEL)
- 20601960550 = VIETTEL PERU S.A.C. (BITEL)
- 20269985900 = ENEL DISTRIBUCION PERU S.A.A. (ENEL)
- 20331898008 = LUZ DEL SUR S.A.A.
- 20100152356 = SEDAPAL S.A.

CAMPOS A EXTRAER:
- documentType: Nombre completo del tipo (ej: "FACTURA ELECTRÓNICA", "RECIBO DE TELÉFONO")
- documentTypeCode: Código SUNAT (01, 03, SP, etc.)
- rucEmisor: RUC del EMISOR (empresa que emite/cobra)
- razonSocialEmisor: Nombre del EMISOR
- serieNumero: Serie y número completo (ej: "F001-00012345", "S810-0005255152")
- invoiceDate: Fecha en formato YYYY-MM-DD
- totalAmount: Monto total a pagar
- currency: "PEN" o "USD"
- rucReceptor: RUC del cliente (si existe)
- razonSocialReceptor: Nombre del cliente

Retorna ÚNICAMENTE un JSON válido con esta estructura plana.`

async function reprocessDocument(documentId) {
  console.log(`\n🔄 Reprocesando documento: ${documentId}\n`)

  try {
    // 1. Obtener el documento de PostgreSQL
    const invoice = await prisma.invoice.findUnique({
      where: { id: documentId },
      include: { organization: true, user: true }
    })

    if (!invoice) {
      console.error('❌ Documento no encontrado en la base de datos')
      return
    }

    console.log('📄 Documento encontrado:', {
      id: invoice.id,
      imageName: invoice.imageName,
      currentSerieNumero: invoice.serieNumero,
      currentRucEmisor: invoice.rucEmisor,
    })

    // 2. Obtener configuración de la organización
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: invoice.organizationId }
    })

    if (!settings?.geminiApiKey) {
      console.error('❌ No hay API key de Gemini configurada')
      return
    }

    // 3. Leer la imagen del disco
    const imagePath = path.join(process.cwd(), 'public', invoice.imageUrl.replace('/api/uploads/', 'uploads/'))
    console.log('📷 Leyendo imagen:', imagePath)

    if (!fs.existsSync(imagePath)) {
      console.error('❌ Imagen no encontrada en:', imagePath)
      return
    }

    const imageBuffer = fs.readFileSync(imagePath)
    console.log('✅ Imagen leída:', (imageBuffer.length / 1024).toFixed(0), 'KB')

    // 4. Procesar con Gemini
    const geminiApiKey = decrypt(settings.geminiApiKey)
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: settings.geminiModel || 'gemini-2.0-flash-exp' })

    console.log('🤖 Procesando con Gemini...')

    const imageParts = [{
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: 'image/jpeg',
      },
    }]

    const result = await model.generateContent([IMPROVED_PROMPT, ...imageParts])
    const response = await result.response
    const text = response.text()

    console.log('📝 Respuesta de Gemini (primeros 500 chars):', text.substring(0, 500))

    // Extraer JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('❌ No se pudo extraer JSON de la respuesta')
      return
    }

    const data = JSON.parse(jsonMatch[0])
    console.log('\n✅ Datos extraídos:', JSON.stringify(data, null, 2))

    // 5. Actualizar PostgreSQL
    console.log('\n📊 Actualizando PostgreSQL...')
    await prisma.invoice.update({
      where: { id: documentId },
      data: {
        documentType: data.documentType,
        documentTypeCode: data.documentTypeCode,
        rucEmisor: data.rucEmisor,
        razonSocialEmisor: data.razonSocialEmisor,
        vendorName: data.razonSocialEmisor || data.vendorName,
        serieNumero: data.serieNumero,
        invoiceNumber: data.serieNumero,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
        totalAmount: data.totalAmount,
        currency: data.currency || 'PEN',
        rucReceptor: data.rucReceptor,
        razonSocialReceptor: data.razonSocialReceptor,
        ocrData: data,
        status: 'COMPLETED',
      }
    })
    console.log('✅ PostgreSQL actualizado')

    // 6. Actualizar SQL Server si está habilitado
    if (settings.sqlServerEnabled && settings.sqlServerHost) {
      console.log('\n🗄️ Actualizando SQL Server...')

      const sqlConfig = {
        server: decrypt(settings.sqlServerHost),
        database: settings.sqlServerDatabase,
        user: decrypt(settings.sqlServerUser),
        password: decrypt(settings.sqlServerPassword),
        port: settings.sqlServerPort || 1433,
        options: {
          encrypt: settings.sqlServerEncrypt ?? false,
          trustServerCertificate: settings.sqlServerTrustCert ?? true,
        }
      }

      const pool = await sql.connect(sqlConfig)

      // Actualizar en CntCtaRendicionDocumentosIA
      const result1 = await pool.request()
        .input('ID', sql.NVarChar(255), documentId)
        .input('RUCEmisor', sql.NVarChar(50), data.rucEmisor)
        .input('RazonSocialEmisor', sql.NVarChar(255), data.razonSocialEmisor)
        .input('SerieNumero', sql.NVarChar(255), data.serieNumero)
        .input('TipoDocumento', sql.NVarChar(255), data.documentType)
        .input('TotalFactura', sql.Float, data.totalAmount)
        .query(`
          UPDATE [dbo].[CntCtaRendicionDocumentosIA]
          SET [RUC Emisor] = @RUCEmisor,
              [Razón Social Emisor] = @RazonSocialEmisor,
              [Serie-Número] = @SerieNumero,
              [Tipo Documento] = @TipoDocumento,
              [Total Factura] = @TotalFactura
          WHERE [ID] = @ID
        `)

      console.log('✅ CntCtaRendicionDocumentosIA:', result1.rowsAffected[0], 'filas actualizadas')

      // También actualizar en CntCtaCajaChicaDocumentosIA
      const result2 = await pool.request()
        .input('ID', sql.NVarChar(255), documentId)
        .input('RUCEmisor', sql.NVarChar(50), data.rucEmisor)
        .input('RazonSocialEmisor', sql.NVarChar(255), data.razonSocialEmisor)
        .input('SerieNumero', sql.NVarChar(255), data.serieNumero)
        .input('TipoDocumento', sql.NVarChar(255), data.documentType)
        .input('TotalFactura', sql.Float, data.totalAmount)
        .query(`
          UPDATE [dbo].[CntCtaCajaChicaDocumentosIA]
          SET [RUC Emisor] = @RUCEmisor,
              [Razón Social Emisor] = @RazonSocialEmisor,
              [Serie-Número] = @SerieNumero,
              [Tipo Documento] = @TipoDocumento,
              [Total Factura] = @TotalFactura
          WHERE [ID] = @ID
        `)

      console.log('✅ CntCtaCajaChicaDocumentosIA:', result2.rowsAffected[0], 'filas actualizadas')

      await pool.close()
    }

    console.log('\n🎉 Reprocesamiento completado exitosamente!')
    console.log('\nResumen de datos actualizados:')
    console.log('  - Tipo documento:', data.documentType)
    console.log('  - RUC Emisor:', data.rucEmisor)
    console.log('  - Razón Social:', data.razonSocialEmisor)
    console.log('  - Serie-Número:', data.serieNumero)
    console.log('  - Total:', data.totalAmount, data.currency || 'PEN')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar
const documentId = process.argv[2]
if (!documentId) {
  console.error('❌ Uso: node scripts/reprocess-document.cjs <documentId>')
  process.exit(1)
}

reprocessDocument(documentId)
