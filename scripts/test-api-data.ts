import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testData() {
  try {
    console.log('🔍 Probando que los datos se devuelven correctamente...\n')

    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        status: true,
        imageUrl: true,
        // ESTOS SON LOS CAMPOS QUE DEBE VER EL USUARIO:
        rucEmisor: true,
        razonSocialEmisor: true,
        serieNumero: true,
        subtotal: true,
        igvMonto: true,
        totalAmount: true,
        currency: true,
        documentType: true,
        documentTypeCode: true,
        createdAt: true,
      },
    })

    console.log(`📊 Total facturas: ${invoices.length}\n`)

    for (const inv of invoices) {
      console.log('─'.repeat(80))
      console.log(`ID: ${inv.id.substring(0, 12)}...`)
      console.log(`Estado: ${inv.status}`)
      console.log(`Creado: ${inv.createdAt}`)
      console.log('')
      console.log('DATOS QUE DEBE VER EL USUARIO EN EL FRONTEND:')
      console.log(`  ├─ RUC Emisor: ${inv.rucEmisor || '❌ NULL'}`)
      console.log(`  ├─ Razón Social: ${inv.razonSocialEmisor || '❌ NULL'}`)
      console.log(`  ├─ Serie-Número: ${inv.serieNumero || '❌ NULL'}`)
      console.log(`  ├─ Subtotal: ${inv.subtotal || '❌ NULL'}`)
      console.log(`  ├─ IGV: ${inv.igvMonto || '❌ NULL'}`)
      console.log(`  ├─ Total: ${inv.totalAmount || '❌ NULL'}`)
      console.log(`  ├─ Moneda: ${inv.currency || '❌ NULL'}`)
      console.log(`  └─ Tipo: ${inv.documentType || '❌ NULL'}`)
      console.log('')
    }

    console.log('═'.repeat(80))
    console.log('✅ SI VES DATOS ARRIBA = EL BACKEND FUNCIONA CORRECTAMENTE')
    console.log('❌ SI VES NULL = HAY UN PROBLEMA EN LA BASE DE DATOS')
    console.log('═'.repeat(80))

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testData()
