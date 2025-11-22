import { SqlServerService } from '../src/services/sqlserver'

async function verifySQLItems() {
  const invoiceId = 'cmhurgobf00018a810jh2kzu2'

  console.log('🔍 Verificando items en SQL Server...\n')

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
        SELECT
          [ID],
          [Serie-Número],
          [Tipo Documento],
          [Cantidad Items],
          [Item #],
          [Cantidad],
          [Descripción Producto],
          [Código Producto],
          [Precio Unitario],
          [Total Item],
          [Subtotal Factura],
          [IGV],
          [Total Factura],
          [Moneda]
        FROM [dbo].[CntCtaRendicionDocumentosIA]
        WHERE [ID] = '${invoiceId}'
      `)

    if (result.recordset.length > 0) {
      console.log(`✅ Encontrado: ${result.recordset.length} registro(s)\n`)
      console.log('═══════════════════════════════════════════════════════════')

      result.recordset.forEach((row, i) => {
        console.log(`\nRegistro ${i + 1}:`)
        console.log(`  Serie-Número: ${row['Serie-Número']}`)
        console.log(`  Tipo: ${row['Tipo Documento']}`)
        console.log(`  Cantidad Items: ${row['Cantidad Items']}`)
        console.log(`  Item #: ${row['Item #']}`)
        console.log(`  Cantidad: ${row['Cantidad']}`)
        console.log(`  Descripción: ${row['Descripción Producto']}`)
        console.log(`  Código: ${row['Código Producto'] || 'NULL'}`)
        console.log(`  Precio Unit: ${row['Precio Unitario']}`)
        console.log(`  Total Item: ${row['Total Item']}`)
        console.log(`  Subtotal Factura: ${row['Subtotal Factura']}`)
        console.log(`  IGV: ${row['IGV']}`)
        console.log(`  Total Factura: ${row['Total Factura']}`)
        console.log(`  Moneda: ${row['Moneda']}`)
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

verifySQLItems()
