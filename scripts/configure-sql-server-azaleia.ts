import { prisma } from '../src/lib/prisma'
import { encrypt } from '../src/lib/encryption'

/**
 * Script para configurar SQL Server para Azaleia
 * Credenciales: 190.119.245.254:1433
 */

async function configureSqlServer() {
  console.log('🔧 Configurando SQL Server para Azaleia...\n')

  const config = {
    organizationSlug: 'azaleia',
    sqlServerEnabled: true,
    sqlServerHost: '190.119.245.254',
    sqlServerPort: 1433,
    sqlServerDatabase: 'AzaleiaPeru',
    sqlServerUser: 'cpalomino',
    sqlServerPassword: 'azaleia.2018',
    sqlServerEncrypt: false, // SQL Server remoto sin SSL
    sqlServerTrustCert: true,
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
    console.log('Usuario:', config.sqlServerUser)
    console.log('SSL/TLS:', config.sqlServerEncrypt)
    console.log('─────────────────────────────────────────────\n')

    console.log('✨ Ahora las facturas se enviarán automáticamente a SQL Server')
    console.log('   Tabla: [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]\n')
  } catch (error: any) {
    console.error('❌ ERROR:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

configureSqlServer()
