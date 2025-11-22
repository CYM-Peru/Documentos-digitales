import { SqlServerService } from '../src/services/sqlserver'

const sqlService = new SqlServerService({
  server: 'localhost',
  database: 'AzaleiaPeru',
  user: 'sa',
  password: 'Azaleia.2025',
  port: 1433,
  encrypt: false,
  trustServerCertificate: true,
})

async function main() {
  try {
    console.log('📊 Conectando a SQL Server...')
    await sqlService.testConnection()

    console.log('\n🔍 Consultando estructura de CntCtaCajaChicaDocumentosIA...')
    const pool = await (sqlService as any).getPool()

    // Ver estructura de la tabla
    const columns = await pool.request().query(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'CntCtaCajaChicaDocumentosIA'
      ORDER BY ORDINAL_POSITION
    `)

    console.log('\n📋 Columnas de CntCtaCajaChicaDocumentosIA:')
    columns.recordset.forEach((col: any) => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH ? '('+col.CHARACTER_MAXIMUM_LENGTH+')' : ''})`)
    })

    // Ver datos de muestra
    const sample = await pool.request().query(`
      SELECT TOP 5 * FROM [dbo].[CntCtaCajaChicaDocumentosIA]
    `)

    console.log(`\n📊 Registros encontrados: ${sample.recordset.length}`)
    if (sample.recordset.length > 0) {
      console.log('\n🔍 Muestra de datos:')
      console.log(JSON.stringify(sample.recordset[0], null, 2))
    }

    // Buscar tabla de cabecera de cajas chicas
    console.log('\n\n🔍 Buscando tablas relacionadas con Caja Chica...')
    const tables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME LIKE '%Caja%Chica%'
      ORDER BY TABLE_NAME
    `)

    console.log('\n📋 Tablas encontradas:')
    tables.recordset.forEach((table: any) => {
      console.log(`  - ${table.TABLE_NAME}`)
    })

    await sqlService.close()
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
