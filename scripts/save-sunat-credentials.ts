import { PrismaClient } from '@prisma/client'
import { encrypt } from './src/lib/encryption'

const prisma = new PrismaClient()

// Credenciales que me proporcionó el usuario
const SUNAT_CREDENTIALS = {
  clientId: 'f23d42a8-e073-4499-b0c3-a895eaa7d929',
  clientSecret: '4pfZleue7tVAhieUhLvDMA==',
  ruc: '20609042148', // RUC de Azaleia
  enabled: true,
}

async function saveSunatCredentials() {
  try {
    console.log('╔═══════════════════════════════════════════╗')
    console.log('║   🔐 GUARDANDO CREDENCIALES SUNAT         ║')
    console.log('╚═══════════════════════════════════════════╝\n')

    const settings = await prisma.organizationSettings.findFirst()

    if (!settings) {
      console.log('❌ No se encontró configuración de organización')
      return
    }

    console.log('🔄 Encriptando credenciales...')

    // Encriptar credenciales sensibles
    const encryptedClientId = encrypt(SUNAT_CREDENTIALS.clientId)
    const encryptedClientSecret = encrypt(SUNAT_CREDENTIALS.clientSecret)

    await prisma.organizationSettings.update({
      where: { id: settings.id },
      data: {
        sunatClientId: encryptedClientId,
        sunatClientSecret: encryptedClientSecret,
        sunatRuc: SUNAT_CREDENTIALS.ruc,
        sunatEnabled: SUNAT_CREDENTIALS.enabled,
      },
    })

    console.log('✅ Credenciales SUNAT guardadas exitosamente\n')
    console.log('📋 Datos configurados:')
    console.log('─'.repeat(80))
    console.log(`   Client ID: ${SUNAT_CREDENTIALS.clientId}`)
    console.log(`   Client Secret: ${SUNAT_CREDENTIALS.clientSecret}`)
    console.log(`   RUC Azaleia: ${SUNAT_CREDENTIALS.ruc}`)
    console.log(`   Estado: ${SUNAT_CREDENTIALS.enabled ? '✅ ACTIVADO' : '⏸️  DESACTIVADO'}`)
    console.log('─'.repeat(80))
    console.log('\n🎯 ¿Qué sucede ahora?')
    console.log('   1. Cada factura que subas será analizada por Gemini AI')
    console.log('   2. Automáticamente se validará contra SUNAT')
    console.log('   3. Verás un badge "✓ SUNAT" si es válida')
    console.log('   4. O "⚠ No válido" si no está en SUNAT\n')
    console.log('🌐 Sistema listo - Recarga la app para probar!\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

saveSunatCredentials()
