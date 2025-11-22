import { prisma } from '../src/lib/prisma'
import { SqlServerService } from '../src/services/sqlserver'

async function main() {
  const invoiceId = 'cmhuufznj0001e5idogxjwkjm' // B004-00224508

  console.log(`🔄 Reinsertando factura B004-00224508 en SQL Server...`)

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
  console.log('   N° Rendición:', invoice.nroRendicion)

  // Conectar a SQL Server con las credenciales correctas
  const sqlService = new SqlServerService({
    server: '190.119.245.254',
    port: 1433,
    database: 'AzaleiaPeru',
    user: 'cpalomino',
    password: 'azaleia.2018',
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

    console.log(`📦 ${items.length} items encontrados en la factura`)
    console.log('\nPrimeros 5 items con precios:')
    items.slice(0, 5).forEach((item, idx) => {
      console.log(`   Item ${idx + 1}: ${item.descripcion?.substring(0, 40)}`)
      console.log(`      Cantidad: ${item.cantidad}, Precio: ${item.precioUnitario}, Total: ${item.totalItem}`)
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

    console.log(`\n✅ ${rowsInserted} fila(s) insertada(s) en SQL Server correctamente`)
    console.log('\n🎉 ¡ÉXITO! La factura B004-00224508 ahora está en SQL Server con todos los precios')
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
