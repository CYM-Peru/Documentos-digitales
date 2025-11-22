import { SqlServerService } from '../src/services/sqlserver'
import { decrypt } from '../src/lib/encryption'
import { prisma } from '../src/lib/prisma'

async function updateSqlServer() {
  const invoiceId = 'cmhjsy3t9000dcyo5r4qopzju'

  console.log('🔄 Actualizando factura en SQL Server...\n')

  // Obtener settings
  const settings = await prisma.organizationSettings.findFirst({
    where: {
      organization: {
        slug: 'azaleia'
      }
    }
  })

  if (!settings?.sqlServerEnabled) {
    console.log('⏭️ SQL Server no está habilitado')
    return
  }

  try {
    const sqlService = new SqlServerService({
      server: decrypt(settings.sqlServerHost!),
      database: settings.sqlServerDatabase!,
      user: decrypt(settings.sqlServerUser!),
      password: decrypt(settings.sqlServerPassword!),
      port: settings.sqlServerPort || 1433,
      encrypt: settings.sqlServerEncrypt,
      trustServerCertificate: settings.sqlServerTrustCert,
    })

    console.log('📊 Actualizando factura B003-00857663...')

    await sqlService.updateInvoice(invoiceId, {
      sunatVerified: true,
      sunatEstadoCp: '1'
    })

    console.log('✅ Factura actualizada en SQL Server')
    console.log('   Estado SUNAT: VÁLIDO')
    console.log('   SUNAT Verificado: SI')

    await sqlService.close()

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

updateSqlServer()
