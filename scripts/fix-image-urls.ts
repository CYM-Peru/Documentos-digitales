import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function fixImageUrls() {
  console.log('🔧 Iniciando corrección de URLs de imágenes...')

  try {
    // Obtener todas las facturas
    const invoices = await prisma.invoice.findMany({
      select: {
        id: true,
        imageUrl: true,
        thumbnailUrl: true,
      },
    })

    console.log(`📊 Encontradas ${invoices.length} facturas`)

    let updated = 0
    let skipped = 0

    for (const invoice of invoices) {
      let needsUpdate = false
      const updates: any = {}

      // Corregir imageUrl si no tiene /api/
      if (invoice.imageUrl && !invoice.imageUrl.startsWith('/api/uploads')) {
        if (invoice.imageUrl.startsWith('/uploads')) {
          updates.imageUrl = invoice.imageUrl.replace('/uploads', '/api/uploads')
          needsUpdate = true
          console.log(`  ✓ ${invoice.id}: ${invoice.imageUrl} → ${updates.imageUrl}`)
        }
      }

      // Corregir thumbnailUrl si no tiene /api/
      if (invoice.thumbnailUrl && !invoice.thumbnailUrl.startsWith('/api/uploads')) {
        if (invoice.thumbnailUrl.startsWith('/uploads')) {
          updates.thumbnailUrl = invoice.thumbnailUrl.replace('/uploads', '/api/uploads')
          needsUpdate = true
          console.log(`  ✓ ${invoice.id}: ${invoice.thumbnailUrl} → ${updates.thumbnailUrl}`)
        }
      }

      if (needsUpdate) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: updates,
        })
        updated++
      } else {
        skipped++
      }
    }

    console.log(`\n✅ Corrección completada:`)
    console.log(`   - Actualizadas: ${updated}`)
    console.log(`   - Sin cambios: ${skipped}`)
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixImageUrls()
