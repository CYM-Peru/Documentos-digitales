import { PrismaClient } from '@prisma/client'
import { encrypt } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function updateSunatCredentials() {
  try {
    console.log('🔐 Actualizando credenciales SUNAT...')
    
    const settings = await prisma.organizationSettings.findFirst()
    
    if (!settings) {
      console.log('❌ No se encontró configuración de organización')
      return
    }
    
    // Nuevas credenciales SUNAT
    const newClientId = '220b9731-f42d-4a61-9065-e68e8a55a670'
    const newClientSecret = 'cjgXyOTSkSVLLAleuDtutA=='
    
    // Encriptar credenciales
    const encryptedClientId = encrypt(newClientId)
    const encryptedClientSecret = encrypt(newClientSecret)
    
    // Actualizar en base de datos
    await prisma.organizationSettings.update({
      where: { id: settings.id },
      data: {
        sunatClientId: encryptedClientId,
        sunatClientSecret: encryptedClientSecret,
        sunatEnabled: true
      }
    })
    
    console.log('✅ Credenciales SUNAT actualizadas correctamente')
    console.log('   Client ID:', newClientId.substring(0, 20) + '...')
    console.log('   Client Secret:', newClientSecret.substring(0, 10) + '...')
    console.log('   Enabled: true')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateSunatCredentials()
