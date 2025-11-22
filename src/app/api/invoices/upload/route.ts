import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt, decryptObject } from '@/lib/encryption'
import { VisionService } from '@/services/vision'
import { GeminiService } from '@/services/gemini'
import { GoogleSheetsService } from '@/services/google-sheets'
import { N8nService } from '@/services/n8n'
import { SunatService } from '@/services/sunat'
import { DuplicateDetectionService } from '@/services/duplicateDetection'
import { SqlServerService } from '@/services/sqlserver'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const nroRendicion = formData.get('nroRendicion') as string | null
    const tipoOperacion = (formData.get('tipoOperacion') as string) || 'RENDICION'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Get organization settings
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.organizationId },
    })

    if (!settings) {
      return NextResponse.json(
        { error: 'Organization settings not configured' },
        { status: 400 }
      )
    }

    // Save file with preprocessing
    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)

    // Preprocesamiento y generación de thumbnails
    console.log('Preprocessing image and generating thumbnails...')

    const uploadDir = join(process.cwd(), 'public', 'uploads', session.user.organizationId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const baseName = file.name.replace(/\.[^/.]+$/, '') // Remove extension

    let originalBuffer = buffer
    let thumbnailBuffer: Buffer | null = null

    try {
      const image = sharp(buffer)
      const metadata = await image.metadata()

      console.log('📸 Original image:', {
        size: `${metadata.width}x${metadata.height}`,
        format: metadata.format,
        fileSize: `${(file.size / 1024).toFixed(0)}KB`
      })

      // 1️⃣ IMAGEN ORIGINAL optimizada (para Gemini + modal detalle)
      // Solo redimensionar si es MUY grande (> 4000px), mantener color
      if (metadata.width && metadata.width > 4000) {
        // @ts-ignore
        originalBuffer = await sharp(buffer)
          .resize(3000, 4000, {
            fit: 'inside',
            withoutEnlargement: true,
            kernel: 'lanczos3'
          })
          .jpeg({ quality: 85, progressive: true }) // Calidad 85, progressive para carga rápida
          .toBuffer()

        console.log('✓ Original optimized: 3000px max, quality 85')
      } else {
        // @ts-ignore
        originalBuffer = await sharp(buffer)
          .jpeg({ quality: 85, progressive: true })
          .toBuffer()

        console.log('✓ Original compressed: quality 85')
      }

      // 2️⃣ THUMBNAIL pequeño (para lista/grid) - RÁPIDO DE CARGAR
      // @ts-ignore
      thumbnailBuffer = await sharp(buffer)
        .resize(400, 600, {
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3'
        })
        .jpeg({ quality: 75, progressive: true }) // Calidad menor, mucho más liviano
        .toBuffer()

      console.log('✓ Thumbnail generated: 400x600px, quality 75')

    } catch (error) {
      console.error('Image processing error, applying fallback compression:', error)
      // Fallback: comprimir al menos la imagen original para evitar usar buffers muy grandes
      try {
        // @ts-ignore
        originalBuffer = await sharp(buffer)
          .resize(2000, 3000, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer()
        console.log('✓ Fallback compression applied')
      } catch (fallbackError) {
        console.error('Fallback compression also failed, image might be corrupted:', fallbackError)
        return NextResponse.json(
          { error: 'La imagen no pudo ser procesada. Por favor, intenta con otra imagen.' },
          { status: 400 }
        )
      }
    }

    // Guardar imagen original optimizada
    const fileName = `${timestamp}-${baseName}.jpg`
    const filePath = join(uploadDir, fileName)
    await writeFile(filePath, originalBuffer)
    const imageUrl = `/api/uploads/${session.user.organizationId}/${fileName}`

    // Guardar thumbnail
    let thumbnailUrl: string | null = null
    if (thumbnailBuffer) {
      const thumbFileName = `${timestamp}-${baseName}-thumb.jpg`
      const thumbFilePath = join(uploadDir, thumbFileName)
      await writeFile(thumbFilePath, thumbnailBuffer)
      thumbnailUrl = `/api/uploads/${session.user.organizationId}/${thumbFileName}`

      console.log('✅ Images saved:', {
        original: `${(originalBuffer.length / 1024).toFixed(0)}KB`,
        thumbnail: `${(thumbnailBuffer.length / 1024).toFixed(0)}KB`,
        ratio: `${((thumbnailBuffer.length / originalBuffer.length) * 100).toFixed(0)}% size`
      })
    }

    // Create initial invoice record
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        imageUrl,
        thumbnailUrl,
        imageName: file.name,
        imageSize: file.size,
        status: 'PROCESSING',
        nroRendicion: nroRendicion || undefined,
        tipoOperacion: tipoOperacion as any, // 'RENDICION' | 'CAJA_CHICA'
      },
    })

    // Process OCR in background usando la imagen optimizada
    processInvoiceOCR(invoice.id, originalBuffer, settings, imageUrl).catch(async (error) => {
      console.error('OCR processing error:', error)
      try {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message,
          },
        })
      } catch (updateError) {
        console.error('Failed to update invoice status after OCR error:', updateError)
      }
    })

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        imageUrl: invoice.imageUrl,
        status: invoice.status,
      },
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
}

async function processInvoiceOCR(
  invoiceId: string,
  imageBuffer: Buffer,
  settings: any,
  imageUrl: string
) {
  try {
    let ocrData: any = {}

    // PRIORIDAD 1: Gemini Vision AI (IA REAL)
    if (settings.geminiApiKey) {
      console.log('🤖 processInvoiceOCR - Usando GEMINI VISION AI (IA REAL)')
      const geminiApiKey = decrypt(settings.geminiApiKey)

      const geminiService = new GeminiService({
        apiKey: geminiApiKey,
        model: settings.geminiModel || 'gemini-2.0-flash-exp',
        customPrompt: settings.geminiPrompt || undefined,
      })

      console.log('🤖 processInvoiceOCR - Calling Gemini analyzeInvoice...')
      const geminiData = await geminiService.analyzeInvoice(imageBuffer)
      console.log('🤖 processInvoiceOCR - Gemini completed successfully')

      // Convertir datos de Gemini al formato esperado
      // Soportar AMBOS formatos: plano (viejo) y anidado rawData (nuevo)
      const rawData = (geminiData as any).rawData || geminiData
      const emisor = rawData.emisor || {}
      const receptor = rawData.receptor || {}
      const montos = rawData.montos || {}
      const comprobante = rawData.comprobante || {}

      ocrData = {
        // Tipo de documento (puede estar en raíz o en rawData)
        documentType: geminiData.documentType || rawData.documentType,
        documentTypeCode: geminiData.documentTypeCode || rawData.documentTypeCode,

        // Datos del emisor (priorizar estructura anidada)
        rucEmisor: emisor.ruc || geminiData.rucEmisor,
        razonSocialEmisor: emisor.razonSocial || geminiData.razonSocialEmisor,
        domicilioFiscalEmisor: emisor.domicilioFiscal || geminiData.domicilioFiscalEmisor,
        vendorName: emisor.nombreComercial || emisor.razonSocial || geminiData.vendorName || geminiData.razonSocialEmisor,

        // Datos del receptor
        rucReceptor: receptor.numeroDocumento || geminiData.rucReceptor,
        dniReceptor: geminiData.dniReceptor,
        razonSocialReceptor: receptor.razonSocial || geminiData.razonSocialReceptor,

        // Datos del comprobante
        serieNumero: comprobante.serieNumero || geminiData.serieNumero,
        invoiceNumber: comprobante.serieNumero || geminiData.invoiceNumber || geminiData.serieNumero,
        invoiceDate: geminiData.invoiceDate || (comprobante.fechaEmision ? new Date(comprobante.fechaEmision) : undefined),

        // Montos (priorizar estructura anidada)
        subtotal: montos.subtotal || geminiData.subtotal,
        igvTasa: montos.igv?.tasa || geminiData.igvTasa || 18,
        igvMonto: montos.igv?.monto || geminiData.igvMonto,
        totalAmount: montos.importeTotal || geminiData.totalAmount,
        taxAmount: montos.igv?.monto || geminiData.igvMonto || geminiData.taxAmount,
        currency: montos.moneda || geminiData.currency || 'PEN',

        // Código QR extraído (para detección de duplicados)
        qrCode: geminiData.qrCode || rawData.qrCode,

        // Guardar datos completos
        rawData: geminiData,
      }

      console.log('✅ Datos mapeados correctamente:', {
        rucEmisor: ocrData.rucEmisor,
        razonSocialEmisor: ocrData.razonSocialEmisor,
        serieNumero: ocrData.serieNumero,
        subtotal: ocrData.subtotal,
        igvMonto: ocrData.igvMonto,
        totalAmount: ocrData.totalAmount,
      })
    }
    // FALLBACK: Google Cloud Vision OCR (método antiguo)
    else if (settings.googleServiceAccount) {
      console.log('📄 processInvoiceOCR - Usando Google Cloud Vision OCR (método antiguo)')
      const serviceAccount = decryptObject(settings.googleServiceAccount) as any

      const visionService = new VisionService({
        serviceAccount: serviceAccount,
      })

      console.log('📄 processInvoiceOCR - Calling analyzeExpense...')
      ocrData = await visionService.analyzeExpense(imageBuffer)
      console.log('📄 processInvoiceOCR - analyzeExpense completed successfully')
    } else {
      console.log('❌ processInvoiceOCR - No OCR provider configured')
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🔍 VERIFICACIÓN DE DUPLICADOS (HÍBRIDO: QR + RUC+Serie+Número)
    // ═══════════════════════════════════════════════════════════════════
    let duplicateInfo: any = null
    let qrCodeHash: string | null = null

    // Generar hash del QR code si existe
    if (ocrData.qrCode) {
      qrCodeHash = DuplicateDetectionService.hashQrCode(ocrData.qrCode)
    }

    // Obtener factura actual con organizationId
    const currentInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (currentInvoice) {
      const duplicateResult = await DuplicateDetectionService.checkDuplicate({
        qrCode: ocrData.qrCode,
        rucEmisor: ocrData.rucEmisor,
        serieNumero: ocrData.serieNumero,
        organizationId: currentInvoice.organizationId,
      })

      if (duplicateResult.isDuplicate && duplicateResult.duplicateInvoice) {
        duplicateInfo = {
          isDuplicate: true,
          duplicateOfId: duplicateResult.duplicateInvoice.id,
          detectionMethod: duplicateResult.detectionMethod,
          confidence: duplicateResult.confidence,
          originalInvoice: {
            id: duplicateResult.duplicateInvoice.id,
            serieNumero: duplicateResult.duplicateInvoice.serieNumero,
            fecha: duplicateResult.duplicateInvoice.createdAt,
          },
        }

        console.log('⚠️ DUPLICADO DETECTADO:', duplicateInfo)
      }
    }

    // Update invoice with OCR data + duplicate detection + QR code
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'COMPLETED',
        ocrData: ocrData,
        rawOcrResponse: ocrData.rawData,
        vendorName: ocrData.vendorName,
        invoiceNumber: ocrData.invoiceNumber,
        invoiceDate: ocrData.invoiceDate,
        totalAmount: ocrData.totalAmount,
        taxAmount: ocrData.taxAmount,
        currency: ocrData.currency,
        // Campos específicos para facturas peruanas
        documentType: ocrData.documentType,
        documentTypeCode: ocrData.documentTypeCode,
        rucEmisor: ocrData.rucEmisor,
        razonSocialEmisor: ocrData.razonSocialEmisor,
        domicilioFiscalEmisor: ocrData.domicilioFiscalEmisor,
        rucReceptor: ocrData.rucReceptor,
        dniReceptor: ocrData.dniReceptor,
        razonSocialReceptor: ocrData.razonSocialReceptor,
        serieNumero: ocrData.serieNumero,
        subtotal: ocrData.subtotal,
        igvTasa: ocrData.igvTasa,
        igvMonto: ocrData.igvMonto,
        // QR Code y detección de duplicados
        qrCode: ocrData.qrCode,
        qrCodeHash: qrCodeHash,
        isDuplicate: duplicateInfo?.isDuplicate || false,
        duplicateOfId: duplicateInfo?.duplicateOfId || null,
        duplicateDetectionMethod: duplicateInfo?.detectionMethod || null,
      },
    })

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { organization: true, user: true },
    })

    if (!invoice) return

    // ═══════════════════════════════════════════════════════════════════
    // 🧠 VALIDACIÓN INTELIGENTE SUNAT (con reintentos automáticos)
    // ═══════════════════════════════════════════════════════════════════
    // Solo validar si NO es duplicado (ahorrar llamadas API)
    if (
      !duplicateInfo?.isDuplicate &&
      settings.sunatEnabled &&
      settings.sunatClientId &&
      settings.sunatClientSecret &&
      settings.sunatRuc
    ) {
      try {
        console.log('🧠 Validando comprobante con SUNAT (modo inteligente)...')

        const sunatService = new SunatService({
          clientId: decrypt(settings.sunatClientId),
          clientSecret: decrypt(settings.sunatClientSecret),
          rucEmpresa: settings.sunatRuc,
        })

        // Convertir datos extraídos por IA al formato SUNAT
        const datosParaSunat = SunatService.convertirDatosParaSunat({
          rucEmisor: invoice.rucEmisor ?? undefined,
          documentTypeCode: invoice.documentTypeCode ?? undefined,
          serieNumero: invoice.serieNumero ?? undefined,
          invoiceDate: invoice.invoiceDate ?? undefined,
          totalAmount: invoice.totalAmount ?? undefined,
        })

        if (datosParaSunat) {
          // 🚀 Usar validación inteligente con reintentos
          const { resultado, intentos, variacionUsada } =
            await sunatService.validarComprobanteConReintentos(datosParaSunat)

          const interpretacion = SunatService.interpretarEstado(resultado.estadoCp)

          // Actualizar factura con resultado de verificación SUNAT
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              sunatVerified: interpretacion.valido,
              sunatEstadoCp: resultado.estadoCp,
              sunatEstadoRuc: resultado.estadoRuc,
              sunatObservaciones: resultado.observaciones || [],
              sunatVerifiedAt: new Date(),
              sunatRetries: intentos,
            },
          })

          if (variacionUsada) {
            console.log(
              `✅ SUNAT - Verificación completada con ${variacionUsada}: ${interpretacion.mensaje} (${intentos} intentos)`
            )
          } else {
            console.log(
              `✅ SUNAT - Verificación completada: ${interpretacion.mensaje} (${intentos} intentos)`
            )
          }
        } else {
          console.log('⚠️ SUNAT - Datos insuficientes para validar')
        }
      } catch (error) {
        console.error('❌ SUNAT - Error en validación:', error)
        // No fallar el proceso si SUNAT falla, solo registrar
      }
    } else if (duplicateInfo?.isDuplicate) {
      console.log('⏭️ SUNAT - Omitiendo validación (factura duplicada)')
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🏢 CONSULTA AUTOMÁTICA DE RUC (información del emisor)
    // ═══════════════════════════════════════════════════════════════════
    if (
      !duplicateInfo?.isDuplicate &&
      settings.sunatEnabled &&
      settings.sunatClientId &&
      settings.sunatClientSecret &&
      settings.sunatRuc &&
      invoice.rucEmisor
    ) {
      try {
        console.log('🏢 Consultando información del RUC emisor:', invoice.rucEmisor)

        const sunatService = new SunatService({
          clientId: decrypt(settings.sunatClientId),
          clientSecret: decrypt(settings.sunatClientSecret),
          rucEmpresa: settings.sunatRuc,
        })

        const rucData = await sunatService.consultarRuc(invoice.rucEmisor)
        const estadoInterpretado = SunatService.interpretarEstadoRuc(rucData.descEstado)

        // Construir dirección completa desde domicilio fiscal
        let direccionCompleta = ''
        if (rucData.domicilioFiscal) {
          const df = rucData.domicilioFiscal
          if (df.descTipvia && df.descNomvia) {
            direccionCompleta = `${df.descTipvia} ${df.descNomvia}`
            if (df.descNumer) direccionCompleta += ` ${df.descNumer}`
            if (df.descInterior) direccionCompleta += ` Int. ${df.descInterior}`
            if (df.descDpto) direccionCompleta += ` Dpto. ${df.descDpto}`
            if (df.descDist) direccionCompleta += `, ${df.descDist}`
            if (df.descProv) direccionCompleta += `, ${df.descProv}`
            if (df.descDep) direccionCompleta += `, ${df.descDep}`
          }
        }

        // Actualizar factura con información oficial de SUNAT
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            razonSocialEmisor: rucData.ddpNombre,
            vendorName: rucData.ddpNombre, // ✅ También actualizar vendorName
            domicilioFiscalEmisor: direccionCompleta || invoice.domicilioFiscalEmisor,
          },
        })

        // ✅ IMPORTANTE: Actualizar el objeto invoice en memoria con los datos corregidos
        // para que Google Sheets reciba los datos oficiales de SUNAT, no los de la IA
        invoice.razonSocialEmisor = rucData.ddpNombre
        invoice.vendorName = rucData.ddpNombre // ✅ También en memoria
        invoice.domicilioFiscalEmisor = direccionCompleta || invoice.domicilioFiscalEmisor

        console.log(`✅ RUC - Información oficial actualizada: ${rucData.ddpNombre} (${estadoInterpretado.mensaje})`)
        console.log(`   📝 Datos corregidos que se exportarán a Sheets:`)
        console.log(`      Razón Social: ${invoice.razonSocialEmisor}`)
        console.log(`      Domicilio: ${invoice.domicilioFiscalEmisor}`)

        // Alerta si el RUC no está activo
        if (!estadoInterpretado.activo) {
          console.warn(`⚠️ RUC - ALERTA: El RUC ${invoice.rucEmisor} NO está activo: ${estadoInterpretado.mensaje}`)
        }
      } catch (error) {
        console.error('❌ RUC - Error en consulta:', error)
        // No fallar el proceso si la consulta RUC falla, solo registrar
      }
    }

    // Send to Google Sheets
    console.log('📊 Verificando configuración Google Sheets...', {
      hasServiceAccount: !!settings.googleServiceAccount,
      sheetsId: settings.googleSheetsId,
    })

    if (settings.googleServiceAccount && settings.googleSheetsId) {
      console.log('📊 Iniciando envío a Google Sheets...')
      try {
        const googleService = new GoogleSheetsService({
          serviceAccount: decryptObject(settings.googleServiceAccount),
          sheetsId: settings.googleSheetsId,
          driveFolderId: settings.googleDriveFolderId,
        })

        console.log('📊 Agregando factura a Google Sheets...')
        let rowId: number = 0
        console.log('📊 ANTES de await appendInvoice')
        rowId = await googleService.appendInvoice({
          id: invoice.id,
          status: invoice.status,
          vendorName: invoice.vendorName ?? undefined,
          invoiceNumber: invoice.invoiceNumber ?? undefined,
          invoiceDate: invoice.invoiceDate ?? undefined,
          totalAmount: invoice.totalAmount ?? undefined,
          currency: invoice.currency ?? undefined,
          taxAmount: invoice.taxAmount ?? undefined,
          imageUrl: `${process.env.NEXTAUTH_URL}${imageUrl}`,
          createdAt: invoice.createdAt,
          // Campos específicos para facturas peruanas
          documentType: invoice.documentType ?? undefined,
          documentTypeCode: invoice.documentTypeCode ?? undefined,
          rucEmisor: invoice.rucEmisor ?? undefined,
          razonSocialEmisor: invoice.razonSocialEmisor ?? undefined,
          domicilioFiscalEmisor: invoice.domicilioFiscalEmisor ?? undefined,
          rucReceptor: invoice.rucReceptor ?? undefined,
          dniReceptor: invoice.dniReceptor ?? undefined,
          razonSocialReceptor: invoice.razonSocialReceptor ?? undefined,
          serieNumero: invoice.serieNumero ?? undefined,
          subtotal: invoice.subtotal ?? undefined,
          igvTasa: invoice.igvTasa ?? undefined,
          igvMonto: invoice.igvMonto ?? undefined,
          // Verificación SUNAT
          sunatVerified: invoice.sunatVerified ?? undefined,
          sunatEstadoCp: invoice.sunatEstadoCp ?? undefined,
          sunatEstadoRuc: invoice.sunatEstadoRuc ?? undefined,
          sunatObservaciones: invoice.sunatObservaciones ?? undefined,
          sunatVerifiedAt: invoice.sunatVerifiedAt ?? undefined,
          // Usuario
          userName: invoice.user?.name ?? undefined,
          userEmail: invoice.user?.email ?? undefined,
        })
        console.log('📊 DESPUÉS de await appendInvoice')
        console.log('✅ appendInvoice returned, rowId:', rowId)
        console.log('📊 Tipo de rowId:', typeof rowId, 'Valor:', rowId)

        // ═══════════════════════════════════════════════════════════════════
        // 📋 PESTAÑA PERSONALIZADA PARA AMANDA
        // ═══════════════════════════════════════════════════════════════════
        console.log('📋 Verificando usuario para pestaña personalizada:', {
          userEmail: invoice.user?.email,
          isAmanda: invoice.user?.email === 'aarroyo@azaleia.com.pe'
        })

        if (invoice.user?.email === 'aarroyo@azaleia.com.pe') {
          console.log('📋 Usuario especial detectado: Amanda - Guardando en pestaña "Amanda"')
          try {
            // Crear pestaña si no existe
            await googleService.createUserSheet('Amanda')

            // Agregar factura a la pestaña personalizada
            await googleService.appendInvoiceToUserSheet({
              id: invoice.id,
              status: invoice.status,
              vendorName: invoice.vendorName ?? undefined,
              invoiceNumber: invoice.invoiceNumber ?? undefined,
              invoiceDate: invoice.invoiceDate ?? undefined,
              totalAmount: invoice.totalAmount ?? undefined,
              currency: invoice.currency ?? undefined,
              taxAmount: invoice.taxAmount ?? undefined,
              imageUrl: `${process.env.NEXTAUTH_URL}${imageUrl}`,
              createdAt: invoice.createdAt,
              documentType: invoice.documentType ?? undefined,
              documentTypeCode: invoice.documentTypeCode ?? undefined,
              rucEmisor: invoice.rucEmisor ?? undefined,
              razonSocialEmisor: invoice.razonSocialEmisor ?? undefined,
              domicilioFiscalEmisor: invoice.domicilioFiscalEmisor ?? undefined,
              rucReceptor: invoice.rucReceptor ?? undefined,
              dniReceptor: invoice.dniReceptor ?? undefined,
              razonSocialReceptor: invoice.razonSocialReceptor ?? undefined,
              serieNumero: invoice.serieNumero ?? undefined,
              subtotal: invoice.subtotal ?? undefined,
              igvTasa: invoice.igvTasa ?? undefined,
              igvMonto: invoice.igvMonto ?? undefined,
              sunatVerified: invoice.sunatVerified ?? undefined,
              sunatEstadoCp: invoice.sunatEstadoCp ?? undefined,
              sunatEstadoRuc: invoice.sunatEstadoRuc ?? undefined,
              sunatObservaciones: invoice.sunatObservaciones ?? undefined,
              sunatVerifiedAt: invoice.sunatVerifiedAt ?? undefined,
              userName: invoice.user?.name ?? undefined,
              userEmail: invoice.user?.email ?? undefined,
            }, 'Amanda')

            console.log('✅ Factura guardada en pestaña "Amanda"')
          } catch (amandaError) {
            console.error('❌ Error guardando en pestaña Amanda (no crítico):', amandaError)
            // No fallar el proceso completo si falla la pestaña personalizada
          }
        }

        // Actualizar invoice con googleSheetsRowId
        console.log('📊 Actualizando invoice con googleSheetsRowId:', rowId)
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { googleSheetsRowId: rowId },
        })
        console.log('✅ Invoice actualizado correctamente')
      } catch (error: any) {
        console.error('❌ Google Sheets error:', error)
        console.error('❌ Error message:', error?.message)
        console.error('❌ Error stack:', error?.stack)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🗄️ ENVIAR A SQL SERVER (CntCtaRendicionDocumentosIA)
    // ═══════════════════════════════════════════════════════════════════
    if (
      settings.sqlServerEnabled &&
      settings.sqlServerHost &&
      settings.sqlServerDatabase &&
      settings.sqlServerUser &&
      settings.sqlServerPassword
    ) {
      console.log('🗄️ Iniciando envío a SQL Server...')
      try {
        const sqlService = new SqlServerService({
          server: decrypt(settings.sqlServerHost),
          database: settings.sqlServerDatabase,
          user: decrypt(settings.sqlServerUser),
          password: decrypt(settings.sqlServerPassword),
          port: settings.sqlServerPort || 1433,
          encrypt: settings.sqlServerEncrypt,
          trustServerCertificate: settings.sqlServerTrustCert,
        })

        // Extraer items de ocrData si existen
        let items: Array<{
          itemNumber: number
          cantidad: number
          descripcion: string
          codigoProducto?: string
          precioUnitario: number
          totalItem: number
        }> | undefined

        if (invoice.ocrData && typeof invoice.ocrData === 'object') {
          const ocrData = invoice.ocrData as any
          if (ocrData.rawData?.items && Array.isArray(ocrData.rawData.items) && ocrData.rawData.items.length > 0) {
            items = ocrData.rawData.items.map((item: any, index: number) => {
              // Buscar precio unitario en múltiples campos
              const precioUnitario = item.precioVentaUnitario || item.valorUnitario || item.valorVenta || 0
              const cantidad = item.cantidad || 0
              // Calcular total del item si no está disponible
              const totalItem = item.totalItem || (precioUnitario * cantidad)

              return {
                itemNumber: item.numero || index + 1,
                cantidad: cantidad,
                descripcion: item.descripcion || '',
                codigoProducto: item.codigoProducto || undefined,
                precioUnitario: precioUnitario,
                totalItem: totalItem,
              }
            })
            if (items) {
              console.log(`📦 SQL Server - Enviando ${items.length} items`)
            }
          }
        }

        // Insertar factura en SQL Server (tabla correspondiente según tipo de operación)
        const invoiceData = {
          id: invoice.id,
          status: invoice.status,
          invoiceDate: invoice.invoiceDate ?? undefined,
          rucEmisor: invoice.rucEmisor ?? undefined,
          razonSocialEmisor: invoice.razonSocialEmisor ?? undefined,
          serieNumero: invoice.serieNumero ?? undefined,
          documentType: invoice.documentType ?? undefined,
          documentTypeCode: invoice.documentTypeCode ?? undefined,
          subtotal: invoice.subtotal ?? undefined,
          igvMonto: invoice.igvMonto ?? undefined,
          totalAmount: invoice.totalAmount ?? undefined,
          currency: invoice.currency ?? undefined,
          sunatVerified: invoice.sunatVerified ?? undefined,
          sunatEstadoCp: invoice.sunatEstadoCp ?? undefined,
          nroRendicion: invoice.nroRendicion ?? undefined,
          usuario: invoice.user?.email || undefined,
          items: items, // ✅ Ahora sí enviamos los items
        }

        let rowsInserted: number
        if (invoice.tipoOperacion === 'CAJA_CHICA') {
          console.log('💰 SQL Server - Insertando en CntCtaCajaChicaDocumentosIA')
          rowsInserted = await sqlService.insertCajaChicaInvoice(invoiceData)
        } else {
          console.log('📋 SQL Server - Insertando en CntCtaRendicionDocumentosIA')
          rowsInserted = await sqlService.insertInvoice(invoiceData)
        }

        console.log(`✅ SQL Server - ${rowsInserted} fila(s) insertada(s) correctamente`)

        // Cerrar conexión
        await sqlService.close()
      } catch (error: any) {
        console.error('❌ SQL Server error:', error.message)
        // No fallar el proceso completo si SQL Server falla
      }
    } else {
      console.log('⏭️ SQL Server - Deshabilitado o no configurado')
    }

    // Send to n8n webhook
    if (settings.n8nWebhookUrl) {
      try {
        const n8nService = new N8nService(settings.n8nWebhookUrl)

        const executionId = await n8nService.sendInvoiceProcessed({
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          vendorName: invoice.vendorName ?? undefined,
          invoiceNumber: invoice.invoiceNumber ?? undefined,
          totalAmount: invoice.totalAmount ?? undefined,
          status: 'COMPLETED',
          imageUrl: `${process.env.NEXTAUTH_URL}${imageUrl}`,
        })

        if (executionId) {
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: { n8nExecutionId: executionId },
          })
        }
      } catch (error) {
        console.error('n8n webhook error:', error)
      }
    }
  } catch (error) {
    console.error('OCR processing error:', error)
    throw error
  }
}
