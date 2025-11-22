import { SqlServerService } from '../src/services/sqlserver'
import { prisma } from '../src/lib/prisma'
import { decrypt } from '../src/lib/encryption'
import * as fs from 'fs'
import * as path from 'path'

async function createMovilidadTables() {
  try {
    console.log('🚀 Iniciando creación de tablas de movilidad...')

    // Obtener configuración de SQL Server
    const settings = await prisma.organizationSettings.findFirst({
      where: {
        sqlServerEnabled: true,
      },
    })

    if (!settings?.sqlServerHost) {
      throw new Error('SQL Server no configurado')
    }

    console.log('📊 Conectando a SQL Server...')

    // Crear instancia de SQL Server
    const sqlService = new SqlServerService({
      server: decrypt(settings.sqlServerHost),
      database: settings.sqlServerDatabase!,
      user: decrypt(settings.sqlServerUser!),
      password: decrypt(settings.sqlServerPassword!),
      port: settings.sqlServerPort || 1433,
      encrypt: settings.sqlServerEncrypt,
      trustServerCertificate: settings.sqlServerTrustCert,
    })

    // Probar conexión
    await sqlService.testConnection()
    console.log('✅ Conexión exitosa')

    // Leer el script SQL
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'create-movilidad-table.sql'),
      'utf-8'
    )

    console.log('📝 Ejecutando script SQL...')

    // Ejecutar el script
    // @ts-ignore - accediendo al pool interno
    const pool = await sqlService['getPool']()

    // Dividir por GO statements (si los hay)
    const statements = sqlScript
      .split(/\n\s*GO\s*\n/i)
      .filter(s => s.trim().length > 0)

    for (const statement of statements) {
      if (statement.trim().length > 0) {
        await pool.request().query(statement)
      }
    }

    console.log('✅ Tablas creadas exitosamente:')
    console.log('   - CntCtaMovilidadPlanillas')
    console.log('   - CntCtaMovilidadGastos')

    // Cerrar conexión
    await sqlService.close()

    console.log('🎉 Proceso completado!')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createMovilidadTables()
