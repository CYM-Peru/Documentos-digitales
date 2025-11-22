import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrateInvoices() {
  try {
    console.log('🔄 Migrando facturas existentes con datos en rawData...\n')

    // Obtener todas las facturas COMPLETED sin datos en las columnas principales
    const invoices = await prisma.invoice.findMany({
      where: {
        status: 'COMPLETED',
        rucEmisor: null, // Si rucEmisor es null, significa que no se mapeó
      },
    })

    console.log(`📊 Encontradas ${invoices.length} facturas para migrar\n`)

    let updated = 0
    let skipped = 0

    for (const invoice of invoices) {
      try {
        const ocrData = invoice.ocrData as any

        if (!ocrData || !ocrData.rawData) {
          console.log(`⚠️ Skip ${invoice.id}: No tiene rawData`)
          skipped++
          continue
        }

        const rawData = ocrData.rawData
        const emisor = rawData.emisor || {}
        const receptor = rawData.receptor || {}
        const montos = rawData.montos || {}
        const comprobante = rawData.comprobante || {}

        // Extraer datos mapeados
        const mappedData = {
          documentType: rawData.documentType,
          documentTypeCode: rawData.documentTypeCode,

          rucEmisor: emisor.ruc,
          razonSocialEmisor: emisor.razonSocial,
          domicilioFiscalEmisor: emisor.domicilioFiscal,
          vendorName: emisor.nombreComercial || emisor.razonSocial,

          rucReceptor: receptor.numeroDocumento,
          razonSocialReceptor: receptor.razonSocial,

          serieNumero: comprobante.serieNumero,
          invoiceNumber: comprobante.serieNumero,
          invoiceDate: comprobante.fechaEmision ? new Date(comprobante.fechaEmision) : null,

          subtotal: montos.subtotal,
          igvTasa: montos.igv?.tasa || 18,
          igvMonto: montos.igv?.monto,
          totalAmount: montos.importeTotal,
          taxAmount: montos.igv?.monto,
          currency: montos.moneda || 'PEN',
        }

        // Actualizar factura
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: mappedData,
        })

        console.log(`✅ Migrado ${invoice.id}:`, {
          ruc: mappedData.rucEmisor,
          serie: mappedData.serieNumero,
          total: mappedData.totalAmount,
        })
        updated++

      } catch (error) {
        console.error(`❌ Error migrando ${invoice.id}:`, error)
        skipped++
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log(`✅ Migración completada:`)
    console.log(`   - Actualizadas: ${updated}`)
    console.log(`   - Omitidas: ${skipped}`)
    console.log(`   - Total: ${invoices.length}`)
    console.log('═══════════════════════════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ Error en migración:', error)
  } finally {
    await prisma.$disconnect()
  }
}

migrateInvoices()
