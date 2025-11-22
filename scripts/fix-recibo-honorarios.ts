import { SqlServerService } from '../src/services/sqlserver'

async function fixReciboHonorarios() {
  const invoiceId = 'cmhupsmtb0001ddsx9af2o6z4'

  console.log('🔧 Corrigiendo Recibo por Honorarios en SQL Server...\n')

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

    console.log('📋 Datos actuales (antes de la corrección):')
    const before = await pool.request().query(`
      SELECT
        [Cantidad Items], [Item #], [Cantidad],
        [Descripción Producto], [Precio Unitario], [Total Item]
      FROM [dbo].[CntCtaRendicionDocumentosIA]
      WHERE [ID] = '${invoiceId}'
    `)
    console.log(before.recordset[0])
    console.log('')

    console.log('🔄 Actualizando registro...')
    await pool.request().query(`
      UPDATE [dbo].[CntCtaRendicionDocumentosIA]
      SET
        [Cantidad Items] = 0,
        [Item #] = NULL,
        [Cantidad] = 1,
        [Descripción Producto] = 'SERVICIO PROFESIONAL',
        [Código Producto] = NULL,
        [Precio Unitario] = 1200,
        [Total Item] = 1200
      WHERE [ID] = '${invoiceId}'
    `)

    console.log('✅ Actualizado correctamente\n')

    console.log('📋 Datos nuevos (después de la corrección):')
    const after = await pool.request().query(`
      SELECT
        [Cantidad Items], [Item #], [Cantidad],
        [Descripción Producto], [Precio Unitario], [Total Item]
      FROM [dbo].[CntCtaRendicionDocumentosIA]
      WHERE [ID] = '${invoiceId}'
    `)
    console.log(after.recordset[0])

    await sqlService.close()

    console.log('\n═══════════════════════════════════════════')
    console.log('✅ RECIBO POR HONORARIOS CORREGIDO')
    console.log('═══════════════════════════════════════════\n')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    await sqlService.close()
  }
}

fixReciboHonorarios()
