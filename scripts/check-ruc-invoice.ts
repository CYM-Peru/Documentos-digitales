import { prisma } from '../src/lib/prisma'

async function checkRUCInvoice() {
  const ruc = '10753667291'

  console.log(`🔍 Buscando factura con RUC ${ruc}...\n`)

  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [
        { rucEmisor: ruc },
        { rucReceptor: ruc },
      ]
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (!invoice) {
    console.log('❌ No se encontró factura con ese RUC')
    return
  }

  console.log('✅ FACTURA ENCONTRADA:\n')
  console.log('═══════════════════════════════════════════')
  console.log(`ID: ${invoice.id}`)
  console.log(`Serie-Número: ${invoice.serieNumero}`)
  console.log(`Status: ${invoice.status}`)
  console.log(`Tipo: ${invoice.documentType} (${invoice.documentTypeCode})`)
  console.log('')
  console.log('EMISOR:')
  console.log(`  RUC: ${invoice.rucEmisor}`)
  console.log(`  Razón Social: ${invoice.razonSocialEmisor}`)
  console.log(`  Vendor Name: ${invoice.vendorName}`)
  console.log('')
  console.log('RECEPTOR:')
  console.log(`  RUC: ${invoice.rucReceptor}`)
  console.log(`  DNI: ${invoice.dniReceptor}`)
  console.log(`  Razón Social: ${invoice.razonSocialReceptor}`)
  console.log('')
  console.log('MONTOS:')
  console.log(`  Subtotal: ${invoice.subtotal}`)
  console.log(`  IGV: ${invoice.igvMonto}`)
  console.log(`  Total: ${invoice.totalAmount}`)
  console.log(`  Moneda: ${invoice.currency}`)
  console.log('')
  console.log('FECHAS:')
  console.log(`  Fecha factura: ${invoice.invoiceDate}`)
  console.log(`  Creado: ${invoice.createdAt}`)
  console.log(`  Actualizado: ${invoice.updatedAt}`)
  console.log('')
  console.log('SUNAT:')
  console.log(`  Verificado: ${invoice.sunatVerified}`)
  console.log(`  Estado CP: ${invoice.sunatEstadoCp}`)
  console.log(`  Estado RUC: ${invoice.sunatEstadoRuc}`)
  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log('📋 DATOS COMPLETOS (JSON):\n')
  console.log(JSON.stringify(invoice, null, 2))

  await prisma.$disconnect()
}

checkRUCInvoice()
