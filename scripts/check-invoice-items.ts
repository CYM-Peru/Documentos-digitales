import { prisma } from '../src/lib/prisma'

async function checkInvoiceItems() {
  const serieNumero = 'B002-00058549'

  console.log(`🔍 Buscando factura ${serieNumero}...\n`)

  const invoice = await prisma.invoice.findFirst({
    where: { serieNumero },
    orderBy: { createdAt: 'desc' }
  })

  if (!invoice) {
    console.log('❌ Factura no encontrada')
    return
  }

  console.log('✅ FACTURA ENCONTRADA:\n')
  console.log('═══════════════════════════════════════════')
  console.log(`ID: ${invoice.id}`)
  console.log(`Serie-Número: ${invoice.serieNumero}`)
  console.log(`Status: ${invoice.status}`)
  console.log(`RUC Emisor: ${invoice.rucEmisor}`)
  console.log(`Razón Social: ${invoice.razonSocialEmisor}`)
  console.log('')
  console.log('MONTOS:')
  console.log(`  Subtotal: ${invoice.subtotal}`)
  console.log(`  IGV: ${invoice.igvMonto}`)
  console.log(`  Total: ${invoice.totalAmount}`)
  console.log('')

  // Verificar si hay items en ocrData
  if (invoice.ocrData) {
    const ocrData = invoice.ocrData as any

    console.log('📋 DATOS OCR:\n')

    if (ocrData.rawData?.items) {
      console.log(`Items en rawData: ${ocrData.rawData.items.length}`)
      console.log('')

      if (ocrData.rawData.items.length > 0) {
        console.log('ITEMS EXTRAÍDOS POR OCR:\n')
        ocrData.rawData.items.forEach((item: any, i: number) => {
          console.log(`Item ${i + 1}:`)
          console.log(`  Cantidad: ${item.cantidad}`)
          console.log(`  Descripción: ${item.descripcion}`)
          console.log(`  Código: ${item.codigoProducto || 'N/A'}`)
          console.log(`  Precio Unit: ${item.precioUnitario}`)
          console.log(`  Total: ${item.totalItem}`)
          console.log('')
        })
      } else {
        console.log('⚠️ Array de items VACÍO')
      }
    } else {
      console.log('⚠️ NO hay items en rawData')
    }

    // Mostrar estructura completa
    console.log('\n═══════════════════════════════════════════')
    console.log('📊 ESTRUCTURA COMPLETA DE ocrData.rawData.items:\n')
    console.log(JSON.stringify(ocrData.rawData?.items || [], null, 2))
  }

  await prisma.$disconnect()
}

checkInvoiceItems()
