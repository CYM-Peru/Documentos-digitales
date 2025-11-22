import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function generateApiKey() {
  try {
    console.log('╔═══════════════════════════════════════════╗')
    console.log('║   🔑 GENERADOR DE API KEYS                ║')
    console.log('╚═══════════════════════════════════════════╝\n')

    // Obtener la organización
    const org = await prisma.organization.findFirst()

    if (!org) {
      console.log('❌ No se encontró ninguna organización')
      return
    }

    // Generar una API Key segura (32 bytes = 64 caracteres hex)
    const apiKey = 'az_' + randomBytes(32).toString('hex')

    // Fecha de expiración (1 año desde hoy)
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1)

    // Guardar en la base de datos
    const newKey = await prisma.apiKey.create({
      data: {
        key: apiKey,
        name: `API Key - ${new Date().toLocaleDateString('es-PE')}`,
        orgId: org.id,
        active: true,
        expiresAt,
      },
    })

    console.log('✅ API Key generada exitosamente\n')
    console.log('─'.repeat(80))
    console.log(`   🔑 API Key: ${apiKey}`)
    console.log(`   📛 Nombre: ${newKey.name}`)
    console.log(`   🏢 Organización: ${org.name}`)
    console.log(`   📅 Expira: ${expiresAt.toLocaleDateString('es-PE')}`)
    console.log(`   ✅ Estado: ACTIVA`)
    console.log('─'.repeat(80))
    console.log('\n📋 CÓMO USAR LA API:\n')
    console.log('1️⃣  Listar todas las facturas:')
    console.log('   curl -H "X-API-Key: ' + apiKey + '" \\')
    console.log('        https://cockpit.azaleia.com.pe/api/public/invoices\n')
    console.log('2️⃣  Obtener una factura específica:')
    console.log('   curl -H "X-API-Key: ' + apiKey + '" \\')
    console.log('        https://cockpit.azaleia.com.pe/api/public/invoices/{id}\n')
    console.log('3️⃣  Filtrar por estado y fecha:')
    console.log('   curl -H "X-API-Key: ' + apiKey + '" \\')
    console.log('        "https://cockpit.azaleia.com.pe/api/public/invoices?status=COMPLETED&startDate=2025-11-01"\n')
    console.log('⚠️  IMPORTANTE: Guarda esta API Key en un lugar seguro.')
    console.log('    No podrás verla de nuevo una vez que cierres esta ventana.\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateApiKey()
