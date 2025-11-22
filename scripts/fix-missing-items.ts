import { prisma } from '../src/lib/prisma'
import { SqlServerService } from '../src/services/sqlserver'
import { decrypt } from '../src/lib/encryption'

async function fixMissingItems() {
  console.log('🔧 Corrigiendo items faltantes en SQL Server...\n')

  // Obtener settings
  const settings = await prisma.organizationSettings.findFirst({
    where: {
      organization: { slug: 'azaleia' },
      sqlServerEnabled: true,
    },
  })

  if (!settings?.sqlServerHost) {
    console.log('❌ SQL Server no configurado')
    return
  }

  const sqlService = new SqlServerService({
    server: decrypt(settings.sqlServerHost),
    database: settings.sqlServerDatabase!,
    user: decrypt(settings.sqlServerUser!),
    password: decrypt(settings.sqlServerPassword!),
    port: settings.sqlServerPort || 1433,
    encrypt: settings.sqlServerEncrypt,
    trustServerCertificate: settings.sqlServerTrustCert,
  })

  // Buscar la factura específica
  const invoice = await prisma.invoice.findFirst({
    where: { serieNumero: 'B002-00058549' },
    orderBy: { createdAt: 'desc' },
  })

  if (!invoice) {
    console.log('❌ Factura no encontrada')
    await sqlService.close()
    return
  }

  console.log('📄 Factura encontrada:')
  console.log(`   ID: ${invoice.id}`)
  console.log(`   Serie: ${invoice.serieNumero}`)
  console.log(`   Total: ${invoice.totalAmount}`)
  console.log('')

  // Extraer items
  if (invoice.ocrData && typeof invoice.ocrData === 'object') {
    const ocrData = invoice.ocrData as any
    if (ocrData.rawData?.items && Array.isArray(ocrData.rawData.items) && ocrData.rawData.items.length > 0) {
      const items = ocrData.rawData.items.map((item: any, index: number) => ({
        itemNumber: item.numero || index + 1,
        cantidad: item.cantidad || 0,
        descripcion: item.descripcion || '',
        codigoProducto: item.codigoProducto || undefined,
        precioUnitario: item.precioVentaUnitario || item.valorUnitario || 0,
        totalItem: item.totalItem || 0,
      }))

      console.log(`📦 Items extraídos: ${items.length}\n`)
      items.forEach((item: any) => {
        console.log(`Item ${item.itemNumber}:`)
        console.log(`  Cantidad: ${item.cantidad}`)
        console.log(`  Descripción: ${item.descripcion}`)
        console.log(`  Precio Unit: ${item.precioUnitario}`)
        console.log(`  Total: ${item.totalItem}`)
        console.log('')
      })

      // Eliminar registro actual (sin items)
      console.log('🗑️ Eliminando registro antiguo sin items...')
      await sqlService.deleteInvoice(invoice.id)

      // Insertar con items
      console.log('📝 Insertando con items completos...')
      const rowsInserted = await sqlService.insertInvoice({
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
        items: items,
      })

      console.log(`\n✅ SQL Server - ${rowsInserted} fila(s) insertada(s)`)
    } else {
      console.log('⚠️ No hay items en ocrData')
    }
  } else {
    console.log('⚠️ No hay ocrData')
  }

  await sqlService.close()
  await prisma.$disconnect()

  console.log('\n═══════════════════════════════════════════')
  console.log('✅ CORRECCIÓN COMPLETADA')
  console.log('═══════════════════════════════════════════\n')
}

fixMissingItems()
