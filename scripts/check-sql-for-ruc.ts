import { SqlServerService } from '../src/services/sqlserver'

async function checkSQLForRUC() {
  const invoiceId = 'cmhupsmtb0001ddsx9af2o6z4'
  const ruc = '10753667291'

  console.log('🔍 Verificando si factura está en SQL Server...\n')

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
    // Verificar conexión
    await sqlService.testConnection()

    // Buscar por ID
    console.log(`\n📋 Buscando por ID: ${invoiceId}`)
    const existePorId = await sqlService.invoiceExists(invoiceId)
    console.log(`   Existe por ID: ${existePorId ? '✅ SÍ' : '❌ NO'}`)

    // Buscar por RUC Emisor
    console.log(`\n📋 Buscando por RUC Emisor: ${ruc}`)
    const pool = await (sqlService as any).getPool()
    const resultRUC = await pool
      .request()
      .query(`
        SELECT
          [ID],
          [Fecha],
          [Estado],
          [RUC Emisor],
          [Razón Social Emisor],
          [Serie-Número],
          [Tipo Documento],
          [Subtotal Factura],
          [IGV],
          [Total Factura],
          [Moneda],
          [SUNAT Verificado],
          [Estado SUNAT]
        FROM [dbo].[CntCtaRendicionDocumentosIA]
        WHERE [RUC Emisor] = '${ruc}'
      `)

    if (resultRUC.recordset.length > 0) {
      console.log(`   ✅ Encontrado: ${resultRUC.recordset.length} registro(s)`)
      console.log('\n📊 DATOS EN SQL SERVER:\n')
      resultRUC.recordset.forEach((row, i) => {
        console.log(`Registro ${i + 1}:`)
        console.log(JSON.stringify(row, null, 2))
        console.log('')
      })
    } else {
      console.log('   ❌ NO encontrado en SQL Server')
    }

    // Listar últimas 10 facturas para contexto
    console.log('\n📋 Últimas 10 facturas en SQL Server:\n')
    const resultUltimas = await pool
      .request()
      .query(`
        SELECT TOP 10
          [ID],
          [RUC Emisor],
          [Serie-Número],
          [Tipo Documento],
          [Total Factura],
          [Fecha]
        FROM [dbo].[CntCtaRendicionDocumentosIA]
        ORDER BY [Fecha] DESC
      `)

    resultUltimas.recordset.forEach((row, i) => {
      console.log(`${i + 1}. ID: ${row.ID}`)
      console.log(`   RUC: ${row['RUC Emisor']}`)
      console.log(`   Serie: ${row['Serie-Número']}`)
      console.log(`   Tipo: ${row['Tipo Documento']}`)
      console.log(`   Total: ${row['Total Factura']}`)
      console.log(`   Fecha: ${row.Fecha}`)
      console.log('')
    })

    await sqlService.close()
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    await sqlService.close()
  }
}

checkSQLForRUC()
