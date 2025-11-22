/**
 * Script de prueba para verificar cajas chicas de JACHUY
 */

import { PrismaClient } from '@prisma/client'
import { SqlServerService } from './src/services/sqlserver'
import { decrypt } from './src/lib/encryption'

const prisma = new PrismaClient()

async function testJachuy() {
  try {
    console.log('🔍 Buscando settings de SQL Server...')

    const settings = await prisma.organizationSettings.findFirst({
      where: {
        sqlServerEnabled: true,
      },
    })

    if (!settings?.sqlServerHost) {
      console.log('❌ No se encontró configuración de SQL Server')
      return
    }

    console.log('✅ Settings encontrados:', {
      host: decrypt(settings.sqlServerHost),
      database: settings.sqlServerDatabase,
      user: decrypt(settings.sqlServerUser!),
    })

    // Conectar a SQL Server
    const sqlService = new SqlServerService({
      server: decrypt(settings.sqlServerHost),
      database: settings.sqlServerDatabase!,
      user: decrypt(settings.sqlServerUser!),
      password: decrypt(settings.sqlServerPassword!),
      port: settings.sqlServerPort || 1433,
      encrypt: settings.sqlServerEncrypt,
      trustServerCertificate: settings.sqlServerTrustCert,
    })

    // Probar con 'jachuy' (minúsculas)
    console.log('\n📋 Probando con "jachuy" (minúsculas)...')
    const cajas1 = await sqlService.getCajasChicasPendientes('jachuy')
    console.log('Resultado:', cajas1)
    console.log('Cantidad de registros:', cajas1.length)

    // Probar con 'JACHUY' (mayúsculas)
    console.log('\n📋 Probando con "JACHUY" (mayúsculas)...')
    const cajas2 = await sqlService.getCajasChicasPendientes('JACHUY')
    console.log('Resultado:', cajas2)
    console.log('Cantidad de registros:', cajas2.length)

    // Cerrar conexión
    await sqlService.close()
    console.log('\n✅ Prueba completada')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testJachuy()
