import { SqlServerService } from '../src/services/sqlserver'

async function verifyReciboSQL() {
  const invoiceId = 'cmhupsmtb0001ddsx9af2o6z4' // E001-9

  console.log('🔍 Verificando Recibo por Honorarios en SQL Server...\n')

  const sqlService = new SqlServerService({
    server: '190.119.245.254',
    database: 'AzaleiaPeru',
    user: 'cpalomino',
    password: 'azaleia.2018',
    port: 1433,
    encrypt: false,
    trustServerCertificate: true,
  })

  try {
    const pool = await (sqlService as any).getPool()

    const result = await pool
      .request()
      .query(`
        SELECT *
        FROM [dbo].[CntCtaRendicionDocumentosIA]
        WHERE [ID] = '${invoiceId}'
      `)

    if (result.recordset.length > 0) {
      console.log(`✅ Encontrado: ${result.recordset.length} registro(s)\n`)
      console.log('═══════════════════════════════════════════════════════════')

      const row = result.recordset[0]
      console.log('📄 DATOS EN SQL SERVER:\n')

      Object.keys(row).forEach(key => {
        const value = row[key]
        const displayValue = value === null ? '❌ NULL' : value === '' ? '❌ VACÍO' : `✅ ${value}`
        console.log(`  ${key}: ${displayValue}`)
      })

      console.log('\n═══════════════════════════════════════════════════════════')
    } else {
      console.log('❌ No encontrado')
    }

    await sqlService.close()
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    await sqlService.close()
  }
}

verifyReciboSQL()
