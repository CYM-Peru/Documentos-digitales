import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function checkDuplicates() {
  console.log('🔍 Verificando facturas duplicadas...\n')

  try {
    // Obtener todas las facturas marcadas como duplicadas
    const duplicates = await prisma.invoice.findMany({
      where: { isDuplicate: true },
      select: {
        id: true,
        serieNumero: true,
        razonSocialEmisor: true,
        totalAmount: true,
        isDuplicate: true,
        duplicateOfId: true,
        duplicateDetectionMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    })

    if (duplicates.length === 0) {
      console.log('✅ No hay facturas marcadas como duplicadas')
      console.log('\n💡 Para probar la funcionalidad:')
      console.log('   1. Sube una factura')
      console.log('   2. Espera a que se procese')
      console.log('   3. Vuelve a subir LA MISMA factura')
      console.log('   4. Verás el badge "DUPLICADO" en rojo con animación\n')
    } else {
      console.log(`⚠️ ENCONTRADAS ${duplicates.length} FACTURAS DUPLICADAS:\n`)

      for (const dup of duplicates) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`📋 ID: ${dup.id}`)
        console.log(`   Serie: ${dup.serieNumero || 'N/A'}`)
        console.log(`   Emisor: ${dup.razonSocialEmisor || 'N/A'}`)
        console.log(`   Total: S/ ${dup.totalAmount || 'N/A'}`)
        console.log(`   Fecha: ${dup.createdAt}`)
        console.log(`   🔗 Duplicado de: ${dup.duplicateOfId}`)
        console.log(`   🔍 Método: ${dup.duplicateDetectionMethod === 'qr' ? '📱 Código QR' : '🔍 RUC + Serie + Número'}`)
        console.log('')
      }

      console.log('\n✅ Estas facturas mostrarán el badge "DUPLICADO" en la interfaz')
    }

    // También mostrar estadísticas
    const total = await prisma.invoice.count()
    const duplicateCount = await prisma.invoice.count({ where: { isDuplicate: true }})

    console.log('\n📊 ESTADÍSTICAS:')
    console.log(`   Total de facturas: ${total}`)
    console.log(`   Facturas únicas: ${total - duplicateCount}`)
    console.log(`   Facturas duplicadas: ${duplicateCount}`)
    console.log(`   Porcentaje de duplicados: ${((duplicateCount/total)*100).toFixed(1)}%`)

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicates()
