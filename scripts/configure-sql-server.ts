import { prisma } from '../src/lib/prisma'
import { encrypt } from '../src/lib/encryption'

/**
 * Script para configurar SQL Server en una organización
 *
 * INSTRUCCIONES:
 * 1. Edita las credenciales abajo
 * 2. Ejecuta: npx tsx scripts/configure-sql-server.ts
 */

async function configureSqlServer() {
  console.log('🔧 Configurando SQL Server para organización...\n')

  // ════════════════════════════════════════════════════════════
  // 📝 CONFIGURA TUS CREDENCIALES AQUÍ
  // ════════════════════════════════════════════════════════════
  const config = {
    organizationSlug: 'azaleia', // Slug de tu organización
    sqlServerEnabled: true,

    // Para SQL Server LOCAL (on-premise):
    sqlServerHost: 'localhost',  // o IP del servidor (ej: 192.168.1.100)
    // Si usas instancia nombrada: 'localhost\\SQLEXPRESS'

    sqlServerPort: 1433,
    sqlServerDatabase: 'AzaleiaPeru',
    sqlServerUser: 'sa',  // o tu usuario SQL
    sqlServerPassword: 'tu_password',

    // IMPORTANTE para SQL Server LOCAL (no Azure):
    sqlServerEncrypt: false, // false para SQL Server local sin SSL
    sqlServerTrustCert: true, // true para SQL Server local

    // Si tu SQL Server LOCAL SÍ usa SSL:
    // sqlServerEncrypt: true,
    // sqlServerTrustCert: true,
  }

  try {
    // Buscar organización
    console.log(`🔍 Buscando organización: ${config.organizationSlug}`)
    const organization = await prisma.organization.findUnique({
      where: { slug: config.organizationSlug },
    })

    if (!organization) {
      throw new Error(`Organización "${config.organizationSlug}" no encontrada`)
    }

    console.log(`✅ Organización encontrada: ${organization.name}\n`)

    // Encriptar credenciales sensibles
    console.log('🔐 Encriptando credenciales...')
    const encryptedHost = encrypt(config.sqlServerHost)
    const encryptedUser = encrypt(config.sqlServerUser)
    const encryptedPassword = encrypt(config.sqlServerPassword)
    console.log('✅ Credenciales encriptadas\n')

    // Buscar o crear settings
    console.log('📝 Actualizando configuración de organización...')
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: organization.id },
      update: {
        sqlServerEnabled: config.sqlServerEnabled,
        sqlServerHost: encryptedHost,
        sqlServerPort: config.sqlServerPort,
        sqlServerDatabase: config.sqlServerDatabase,
        sqlServerUser: encryptedUser,
        sqlServerPassword: encryptedPassword,
        sqlServerEncrypt: config.sqlServerEncrypt,
        sqlServerTrustCert: config.sqlServerTrustCert,
      },
      create: {
        organizationId: organization.id,
        sqlServerEnabled: config.sqlServerEnabled,
        sqlServerHost: encryptedHost,
        sqlServerPort: config.sqlServerPort,
        sqlServerDatabase: config.sqlServerDatabase,
        sqlServerUser: encryptedUser,
        sqlServerPassword: encryptedPassword,
        sqlServerEncrypt: config.sqlServerEncrypt,
        sqlServerTrustCert: config.sqlServerTrustCert,
      },
    })

    console.log('✅ Configuración guardada correctamente\n')

    console.log('═══════════════════════════════════════════')
    console.log('✅ SQL SERVER CONFIGURADO EXITOSAMENTE')
    console.log('═══════════════════════════════════════════\n')

    console.log('📊 Configuración aplicada:')
    console.log('─────────────────────────────────────────────')
    console.log('Organización:', organization.name)
    console.log('Habilitado:', config.sqlServerEnabled)
    console.log('Servidor:', config.sqlServerHost)
    console.log('Base de datos:', config.sqlServerDatabase)
    console.log('Puerto:', config.sqlServerPort)
    console.log('SSL/TLS:', config.sqlServerEncrypt)
    console.log('─────────────────────────────────────────────\n')

    console.log('✨ Ahora las facturas se enviarán automáticamente a SQL Server')
    console.log('   al mismo tiempo que a Google Sheets (si está configurado)\n')
  } catch (error: any) {
    console.error('❌ ERROR:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

configureSqlServer()
