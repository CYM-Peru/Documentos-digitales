import { prisma } from '../src/lib/prisma'

async function checkReciboItems() {
  const invoiceId = 'cmhupsmtb0001ddsx9af2o6z4'

  console.log('🔍 Verificando items del Recibo por Honorarios...\n')

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  })

  if (!invoice) {
    console.log('❌ Factura no encontrada')
    return
  }

  console.log('✅ RECIBO POR HONORARIOS:\n')
  console.log('═══════════════════════════════════════════')
  console.log(`ID: ${invoice.id}`)
  console.log(`Serie-Número: ${invoice.serieNumero}`)
  console.log(`Tipo: ${invoice.documentType}`)
  console.log(`RUC Emisor: ${invoice.rucEmisor}`)
  console.log(`Razón Social: ${invoice.razonSocialEmisor}`)
  console.log('')
  console.log('MONTOS:')
  console.log(`  Subtotal: ${invoice.subtotal}`)
  console.log(`  IGV: ${invoice.igvMonto}`)
  console.log(`  Total: ${invoice.totalAmount}`)
  console.log('')

  if (invoice.ocrData) {
    const ocrData = invoice.ocrData as any

    console.log('📋 ITEMS EN ocrData.rawData:')
    if (ocrData.rawData?.items) {
      console.log(`  Array de items existe: ${Array.isArray(ocrData.rawData.items) ? 'SÍ' : 'NO'}`)
      console.log(`  Cantidad de items: ${ocrData.rawData.items.length}`)
      console.log('')

      if (ocrData.rawData.items.length > 0) {
        console.log('  ITEMS ENCONTRADOS:\n')
        ocrData.rawData.items.forEach((item: any, i: number) => {
          console.log(`  Item ${i + 1}:`)
          console.log(JSON.stringify(item, null, 4))
          console.log('')
        })
      } else {
        console.log('  ⚠️ Array de items VACÍO')
      }
    } else {
      console.log('  ❌ NO existe rawData.items')
    }

    console.log('\n📊 INFORMACIÓN ADICIONAL:')
    if (ocrData.rawData?.informacionAdicional) {
      console.log(`  Observaciones: ${ocrData.rawData.informacionAdicional.observaciones || 'N/A'}`)
      console.log(`  Condiciones Pago: ${ocrData.rawData.informacionAdicional.condicionesPago || 'N/A'}`)
    }
  }

  console.log('\n═══════════════════════════════════════════')

  await prisma.$disconnect()
}

checkReciboItems()
