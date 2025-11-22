import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkInvoices() {
  try {
    console.log('🔍 Revisando últimas facturas procesadas...\n')

    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        status: true,
        createdAt: true,
        // Datos básicos
        rucEmisor: true,
        razonSocialEmisor: true,
        serieNumero: true,
        totalAmount: true,
        subtotal: true,
        igvMonto: true,
        // Verificación SUNAT
        sunatVerified: true,
        sunatEstadoCp: true,
        sunatEstadoRuc: true,
        // OCR Data
        ocrData: true,
      },
    })

    for (const invoice of invoices) {
      console.log('═══════════════════════════════════════════════════════════')
      console.log(`📄 Invoice ID: ${invoice.id}`)
      console.log(`   Status: ${invoice.status}`)
      console.log(`   Fecha: ${invoice.createdAt}`)
      console.log('')
      console.log('📊 DATOS EXTRAÍDOS POR IA:')
      console.log(`   RUC Emisor: ${invoice.rucEmisor || 'NO EXTRAÍDO'}`)
      console.log(`   Razón Social: ${invoice.razonSocialEmisor || 'NO EXTRAÍDO'}`)
      console.log(`   Serie-Número: ${invoice.serieNumero || 'NO EXTRAÍDO'}`)
      console.log(`   Subtotal: ${invoice.subtotal || 'NO EXTRAÍDO'}`)
      console.log(`   IGV: ${invoice.igvMonto || 'NO EXTRAÍDO'}`)
      console.log(`   Total: ${invoice.totalAmount || 'NO EXTRAÍDO'}`)
      console.log('')
      console.log('🔐 VERIFICACIÓN SUNAT:')
      console.log(`   Verificado: ${invoice.sunatVerified === true ? '✅ SÍ' : invoice.sunatVerified === false ? '❌ NO' : '⚠️ NO VERIFICADO'}`)
      console.log(`   Estado CP: ${invoice.sunatEstadoCp || 'N/A'}`)
      console.log(`   Estado RUC: ${invoice.sunatEstadoRuc || 'N/A'}`)
      console.log('')

      if (invoice.ocrData) {
        console.log('📋 OCR DATA (rawData):')
        const ocrData = invoice.ocrData as any
        console.log(JSON.stringify(ocrData, null, 2))
      } else {
        console.log('⚠️ NO HAY OCR DATA')
      }
      console.log('')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkInvoices()
