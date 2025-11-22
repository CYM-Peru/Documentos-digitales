import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt, decryptObject } from '@/lib/encryption'
import { UBLXMLParser } from '@/services/xml-ubl-parser'
import { GoogleSheetsService } from '@/services/google-sheets'
import { SqlServerService } from '@/services/sqlserver'
import { SunatService } from '@/services/sunat'
import { DuplicateDetectionService } from '@/services/duplicateDetection'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

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

    // Validar que sea un archivo XML
    if (!file.name.toLowerCase().endsWith('.xml')) {
      return NextResponse.json({ error: 'Only XML files are allowed' }, { status: 400 })
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

    // Leer contenido del XML
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const xmlContent = buffer.toString('utf-8')

    // Validar que sea un XML UBL válido
    if (!UBLXMLParser.isValidUBL(xmlContent)) {
      return NextResponse.json(
        { error: 'Invalid UBL XML format. Please upload a valid electronic invoice XML.' },
        { status: 400 }
      )
    }

    // Parsear XML
    console.log('📄 Parseando XML UBL...')
    const ublData = await UBLXMLParser.parseInvoiceXML(xmlContent)

    console.log('✅ XML parseado correctamente:', {
      serieNumero: ublData.serieNumero,
      rucEmisor: ublData.rucEmisor,
      razonSocial: ublData.razonSocialEmisor,
      total: ublData.total,
      items: ublData.items.length,
    })

    // Guardar XML en el servidor
    const uploadDir = join(process.cwd(), 'public', 'uploads', session.user.organizationId, 'xmls')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const fileName = `${timestamp}-${file.name}`
    const filePath = join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    const xmlUrl = `/api/uploads/${session.user.organizationId}/xmls/${fileName}`

    console.log('💾 XML guardado en:', xmlUrl)

    // Convertir fecha ISO a Date
    let invoiceDate: Date | undefined
    if (ublData.issueDate) {
      try {
        invoiceDate = new Date(ublData.issueDate)
      } catch (error) {
        console.warn('⚠️ No se pudo convertir fecha:', ublData.issueDate)
      }
    }

    // Determinar tipo de documento
    const documentTypeCode = ublData.invoiceTypeCode
    let documentType = 'Factura Electrónica'
    if (documentTypeCode === '03') documentType = 'Boleta Electrónica'
    else if (documentTypeCode === '07') documentType = 'Nota de Crédito'
    else if (documentTypeCode === '08') documentType = 'Nota de Débito'

    // ═══════════════════════════════════════════════════════════════════
    // 🔍 VERIFICACIÓN DE DUPLICADOS
    // ═══════════════════════════════════════════════════════════════════
    let duplicateInfo: any = null

    const duplicateResult = await DuplicateDetectionService.checkDuplicate({
      rucEmisor: ublData.rucEmisor,
      serieNumero: ublData.serieNumero,
      organizationId: session.user.organizationId,
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

    // Crear registro de factura
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        imageUrl: xmlUrl, // Usar URL del XML como "imagen"
        imageName: file.name,
        imageSize: file.size,
        status: 'COMPLETED',
        nroRendicion: nroRendicion || undefined,
        tipoOperacion: tipoOperacion as any,

        // Datos básicos
        vendorName: ublData.razonSocialEmisor,
        invoiceNumber: ublData.serieNumero,
        invoiceDate: invoiceDate,
        totalAmount: ublData.total,
        taxAmount: ublData.igv,
        currency: ublData.documentCurrencyCode || 'PEN',

        // Datos específicos de facturas peruanas
        documentType: documentType,
        documentTypeCode: documentTypeCode,
        rucEmisor: ublData.rucEmisor,
        razonSocialEmisor: ublData.razonSocialEmisor,
        domicilioFiscalEmisor: ublData.direccionEmisor,
        rucReceptor: ublData.rucReceptor,
        razonSocialReceptor: ublData.razonSocialReceptor,
        serieNumero: ublData.serieNumero,
        subtotal: ublData.subtotal,
        igvTasa: 18,
        igvMonto: ublData.igv,

        // Detección de duplicados
        isDuplicate: duplicateInfo?.isDuplicate || false,
        duplicateOfId: duplicateInfo?.duplicateOfId || null,
        duplicateDetectionMethod: duplicateInfo?.detectionMethod || null,

        // Datos del XML UBL (convertir a JSON puro para Prisma)
        ocrData: JSON.parse(JSON.stringify({
          source: 'xml-ubl',
          ublData: ublData,
          items: ublData.items,
        })),
        rawOcrResponse: JSON.parse(JSON.stringify(ublData)),
      },
      include: { organization: true, user: true },
    })

    console.log('✅ Factura creada con ID:', invoice.id)

    // ═══════════════════════════════════════════════════════════════════
    // 🧠 VALIDACIÓN INTELIGENTE SUNAT (opcional, solo si no es duplicado)
    // ═══════════════════════════════════════════════════════════════════
    if (
      !duplicateInfo?.isDuplicate &&
      settings.sunatEnabled &&
      settings.sunatClientId &&
      settings.sunatClientSecret &&
      settings.sunatRuc
    ) {
      try {
        console.log('🧠 Validando comprobante con SUNAT...')

        const sunatService = new SunatService({
          clientId: decrypt(settings.sunatClientId),
          clientSecret: decrypt(settings.sunatClientSecret),
          rucEmpresa: settings.sunatRuc,
        })

        const datosParaSunat = SunatService.convertirDatosParaSunat({
          rucEmisor: ublData.rucEmisor,
          documentTypeCode: ublData.invoiceTypeCode,
          serieNumero: ublData.serieNumero,
          invoiceDate: invoiceDate,
          totalAmount: ublData.total,
        })

        if (datosParaSunat) {
          const { resultado, intentos, variacionUsada } =
            await sunatService.validarComprobanteConReintentos(datosParaSunat)

          const interpretacion = SunatService.interpretarEstado(resultado.estadoCp)

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              sunatVerified: interpretacion.valido,
              sunatEstadoCp: resultado.estadoCp,
              sunatEstadoRuc: resultado.estadoRuc,
              sunatObservaciones: resultado.observaciones || [],
              sunatVerifiedAt: new Date(),
              sunatRetries: intentos,
            },
          })

          console.log(
            `✅ SUNAT - Verificación: ${interpretacion.mensaje} (${intentos} intentos${
              variacionUsada ? `, ${variacionUsada}` : ''
            })`
          )
        }
      } catch (error) {
        console.error('❌ SUNAT - Error en validación:', error)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 📊 ENVIAR A GOOGLE SHEETS
    // ═══════════════════════════════════════════════════════════════════
    if (settings.googleServiceAccount && settings.googleSheetsId) {
      try {
        console.log('📊 Enviando a Google Sheets...')
        const googleService = new GoogleSheetsService({
          serviceAccount: decryptObject(settings.googleServiceAccount),
          sheetsId: settings.googleSheetsId,
          driveFolderId: settings.googleDriveFolderId || undefined,
        })

        const rowId = await googleService.appendInvoice({
          id: invoice.id,
          status: invoice.status,
          vendorName: invoice.vendorName ?? undefined,
          invoiceNumber: invoice.invoiceNumber ?? undefined,
          invoiceDate: invoice.invoiceDate ?? undefined,
          totalAmount: invoice.totalAmount ?? undefined,
          currency: invoice.currency ?? undefined,
          taxAmount: invoice.taxAmount ?? undefined,
          imageUrl: `${process.env.NEXTAUTH_URL}${xmlUrl}`,
          createdAt: invoice.createdAt,
          documentType: invoice.documentType ?? undefined,
          documentTypeCode: invoice.documentTypeCode ?? undefined,
          rucEmisor: invoice.rucEmisor ?? undefined,
          razonSocialEmisor: invoice.razonSocialEmisor ?? undefined,
          domicilioFiscalEmisor: invoice.domicilioFiscalEmisor ?? undefined,
          rucReceptor: invoice.rucReceptor ?? undefined,
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
        })

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { googleSheetsRowId: rowId },
        })

        console.log('✅ Google Sheets - Guardado correctamente')
      } catch (error: any) {
        console.error('❌ Google Sheets error:', error.message)
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🗄️ ENVIAR A SQL SERVER
    // ═══════════════════════════════════════════════════════════════════
    if (
      settings.sqlServerEnabled &&
      settings.sqlServerHost &&
      settings.sqlServerDatabase &&
      settings.sqlServerUser &&
      settings.sqlServerPassword
    ) {
      try {
        console.log('🗄️ Enviando a SQL Server...')
        const sqlService = new SqlServerService({
          server: decrypt(settings.sqlServerHost),
          database: settings.sqlServerDatabase,
          user: decrypt(settings.sqlServerUser),
          password: decrypt(settings.sqlServerPassword),
          port: settings.sqlServerPort || 1433,
          encrypt: settings.sqlServerEncrypt,
          trustServerCertificate: settings.sqlServerTrustCert,
        })

        // Convertir items UBL a formato SQL Server
        const items = ublData.items.map((item) => ({
          itemNumber: item.numeroLinea,
          cantidad: item.cantidad,
          descripcion: item.descripcion,
          codigoProducto: item.codigoProducto,
          precioUnitario: item.precioUnitario,
          totalItem: item.precioTotal,
        }))

        await sqlService.insertInvoice({
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
          items: items,
        })

        await sqlService.close()
        console.log('✅ SQL Server - Guardado correctamente')
      } catch (error: any) {
        console.error('❌ SQL Server error:', error.message)
      }
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        serieNumero: invoice.serieNumero,
        rucEmisor: invoice.rucEmisor,
        razonSocialEmisor: invoice.razonSocialEmisor,
        total: invoice.totalAmount,
        status: invoice.status,
        isDuplicate: invoice.isDuplicate,
        items: ublData.items,
      },
    })
  } catch (error: any) {
    console.error('XML upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process XML' },
      { status: 500 }
    )
  }
}
