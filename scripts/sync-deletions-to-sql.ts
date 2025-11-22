import { prisma } from '../src/lib/prisma'
import { SqlServerService } from '../src/services/sqlserver'

async function syncDeletionsToSQL() {
  console.log('🔄 Sincronizando eliminaciones a SQL Server...\n')

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
    // Obtener todos los IDs en SQL Server
    console.log('📊 Obteniendo facturas de SQL Server...')
    const pool = await (sqlService as any).getPool()
    const sqlResult = await pool
      .request()
      .query(`
        SELECT DISTINCT [ID]
        FROM [dbo].[CntCtaRendicionDocumentosIA]
      `)

    const idsEnSQL = sqlResult.recordset.map((row: any) => row.ID)
    console.log(`   Total en SQL Server: ${idsEnSQL.length}`)

    // Obtener todos los IDs en PostgreSQL
    console.log('📊 Obteniendo facturas de PostgreSQL...')
    const invoicesEnPostgres = await prisma.invoice.findMany({
      select: { id: true }
    })

    const idsEnPostgres = new Set(invoicesEnPostgres.map(inv => inv.id))
    console.log(`   Total en PostgreSQL: ${idsEnPostgres.size}`)

    // Encontrar IDs que están en SQL pero NO en PostgreSQL
    const idsParaBorrar = idsEnSQL.filter((id: string) => !idsEnPostgres.has(id))

    console.log(`\n📋 Facturas a eliminar de SQL Server: ${idsParaBorrar.length}`)

    if (idsParaBorrar.length === 0) {
      console.log('✅ No hay facturas huérfanas. SQL Server está sincronizado.')
      await sqlService.close()
      return
    }

    console.log('\n⚠️ Las siguientes facturas serán eliminadas de SQL Server:\n')

    // Mostrar detalles de facturas a eliminar
    for (const id of idsParaBorrar) {
      const detalle = await pool
        .request()
        .query(`
          SELECT TOP 1
            [ID],
            [RUC Emisor],
            [Serie-Número],
            [Tipo Documento],
            [Total Factura],
            [Fecha]
          FROM [dbo].[CntCtaRendicionDocumentosIA]
          WHERE [ID] = '${id}'
        `)

      if (detalle.recordset.length > 0) {
        const row = detalle.recordset[0]
        console.log(`- ${row['Serie-Número']} (${row['Tipo Documento']})`)
        console.log(`  RUC: ${row['RUC Emisor']} | Total: ${row['Total Factura']} | Fecha: ${row.Fecha}`)
        console.log(`  ID: ${id}\n`)
      }
    }

    console.log('\n🗑️ Eliminando facturas huérfanas...\n')

    let eliminadas = 0
    for (const id of idsParaBorrar) {
      try {
        const result = await pool
          .request()
          .query(`
            DELETE FROM [dbo].[CntCtaRendicionDocumentosIA]
            WHERE [ID] = '${id}'
          `)

        if (result.rowsAffected[0] > 0) {
          console.log(`✅ Eliminado: ${id} (${result.rowsAffected[0]} fila(s))`)
          eliminadas += result.rowsAffected[0]
        }
      } catch (error: any) {
        console.log(`❌ Error eliminando ${id}: ${error.message}`)
      }
    }

    console.log('\n═══════════════════════════════════════════')
    console.log('📊 RESUMEN DE LIMPIEZA:')
    console.log('═══════════════════════════════════════════')
    console.log(`🗑️ Facturas eliminadas: ${eliminadas}`)
    console.log(`📋 IDs procesados: ${idsParaBorrar.length}`)
    console.log(`✅ SQL Server sincronizado con PostgreSQL`)
    console.log('')

    await sqlService.close()
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    await sqlService.close()
  }

  await prisma.$disconnect()
}

syncDeletionsToSQL()
