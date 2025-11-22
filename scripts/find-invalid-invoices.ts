import { prisma } from '../src/lib/prisma'

async function findInvalidInvoices() {
  console.log('🔍 Buscando facturas marcadas como NO VÁLIDAS en SUNAT...\n')

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { sunatEstadoCp: '0' }, // NO EXISTE
        { sunatVerified: false },
        { sunatVerified: null },
      ],
      status: 'COMPLETED',
      rucEmisor: { not: null },
      serieNumero: { not: null },
    },
    select: {
      id: true,
      serieNumero: true,
      rucEmisor: true,
      razonSocialEmisor: true,
      documentType: true,
      documentTypeCode: true,
      invoiceDate: true,
      totalAmount: true,
      subtotal: true,
      igvMonto: true,
      currency: true,
      sunatVerified: true,
      sunatEstadoCp: true,
      sunatRetries: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`📊 Encontradas: ${invoices.length} facturas\n`)
  console.log('═══════════════════════════════════════════════════════════════════════════════')

  invoices.forEach((inv, index) => {
    console.log(`\n${index + 1}. ${inv.serieNumero}`)
    console.log(`   RUC: ${inv.rucEmisor} - ${inv.razonSocialEmisor}`)
    console.log(`   Tipo: ${inv.documentType} (${inv.documentTypeCode})`)
    console.log(`   Fecha: ${inv.invoiceDate}`)
    console.log(`   Total: ${inv.currency} ${inv.totalAmount}`)
    console.log(`   Subtotal: ${inv.subtotal}, IGV: ${inv.igvMonto}`)
    console.log(`   SUNAT: ${inv.sunatVerified === true ? '✅ VÁLIDO' : inv.sunatVerified === false ? '❌ NO VÁLIDO' : '⚠️ NO VERIFICADO'}`)
    console.log(`   Estado CP: ${inv.sunatEstadoCp || 'N/A'} (${inv.sunatRetries || 0} reintentos)`)
    console.log(`   ID: ${inv.id}`)
  })

  console.log('\n═══════════════════════════════════════════════════════════════════════════════')
  console.log(`\n📋 RESUMEN:`)
  console.log(`Total facturas a revisar: ${invoices.length}`)

  await prisma.$disconnect()
}

findInvalidInvoices()
