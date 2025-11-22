import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteAllInvoices() {
  try {
    console.log('🗑️  BORRAR TODAS LAS FACTURAS\n')
    console.log('⚠️  Esto eliminará TODAS las facturas de la base de datos.')

    // Contar facturas actuales
    const count = await prisma.invoice.count()
    console.log(`📊 Total de facturas a borrar: ${count}\n`)

    if (count === 0) {
      console.log('✅ No hay facturas para borrar.')
      return
    }

    // Borrar todas las facturas
    const result = await prisma.invoice.deleteMany({})

    console.log('═══════════════════════════════════════════════════════════')
    console.log(`✅ COMPLETADO: ${result.count} facturas eliminadas`)
    console.log('═══════════════════════════════════════════════════════════\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteAllInvoices()
