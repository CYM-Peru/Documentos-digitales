import { prisma } from '../src/lib/prisma'
import { SqlServerService } from '../src/services/sqlserver'
import { decrypt } from '../src/lib/encryption'

async function main() {
  const invoiceId = 'cmhutrco50003g6kyx8fgtr5n'

  console.log(`🔄 Reinsertando factura ${invoiceId} en SQL Server...`)

  // Obtener la factura con todos sus datos
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  if (!invoice) {
    console.error('❌ Factura no encontrada')
    return
  }

  console.log('✅ Factura encontrada:', invoice.serieNumero)
  console.log('   Usuario:', invoice.user?.email)
  console.log('   Proveedor:', invoice.razonSocialEmisor)
  console.log('   Total:', invoice.totalAmount)

  // Obtener configuración de SQL Server
  const settings = await prisma.organizationSettings.findFirst({
    where: {
      organizationId: invoice.organizationId,
      sqlServerEnabled: true,
    },
  })

  if (!settings || !settings.sqlServerHost) {
    console.error('❌ SQL Server no configurado')
    return
  }

  // Conectar a SQL Server (desencriptar campos)
  const sqlService = new SqlServerService({
    server: decrypt(settings.sqlServerHost),
    port: settings.sqlServerPort || 1433,
    database: decrypt(settings.sqlServerDatabase!),
    user: decrypt(settings.sqlServerUser!),
    password: decrypt(settings.sqlServerPassword!),
    encrypt: false,
    trustServerCertificate: true,
  })

  // Primero borrar la factura si existe en SQL Server
  try {
    await sqlService.deleteInvoice(invoice.id)
    console.log('🗑️  Factura eliminada de SQL Server (si existía)')
  } catch (error) {
    console.log('   (No existía en SQL Server, continuando...)')
  }

  // Extraer items del OCR data
  let items: any[] = []
  const ocrData = invoice.ocrData as any

  if (ocrData?.rawData?.items && Array.isArray(ocrData.rawData.items) && ocrData.rawData.items.length > 0) {
    items = ocrData.rawData.items.map((item: any, index: number) => ({
      itemNumber: item.numero || index + 1,
      cantidad: item.cantidad || 0,
      descripcion: item.descripcion || '',
      codigoProducto: item.codigoProducto || undefined,
      precioUnitario: item.precioVentaUnitario || item.valorUnitario || 0,
      totalItem: item.totalItem || 0,
    }))

    console.log(`📦 ${items.length} items encontrados en la factura`)
    items.forEach((item, idx) => {
      console.log(`   Item ${idx + 1}: ${item.descripcion?.substring(0, 50)}... (Código: ${item.codigoProducto?.substring(0, 30) || 'N/A'})`)
    })
  } else {
    console.log('📦 Sin items individuales')
  }

  // Reinsertar en SQL Server
  try {
    const rowsInserted = await sqlService.insertInvoice({
      id: invoice.id,
      invoiceDate: invoice.invoiceDate ?? undefined,
      status: invoice.status ?? 'COMPLETED',
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

    console.log(`✅ ${rowsInserted} fila(s) insertada(s) en SQL Server correctamente`)
  } catch (error: any) {
    console.error('❌ Error al insertar en SQL Server:', error.message)
    throw error
  } finally {
    await sqlService.close()
  }

  await prisma.$disconnect()
  console.log('✅ Proceso completado')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
