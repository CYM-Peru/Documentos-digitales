import { prisma } from '../src/lib/prisma'
import { SqlServerService } from '../src/services/sqlserver'
import { decrypt } from '../src/lib/encryption'

async function syncAllToSQL() {
  console.log('🔄 Sincronizando todas las facturas a SQL Server...\n')

  // Obtener settings SQL Server
  const settings = await prisma.organizationSettings.findFirst({
    where: {
      organization: { slug: 'azaleia' },
      sqlServerEnabled: true
    }
  })

  if (!settings) {
    console.log('❌ SQL Server no configurado')
    return
  }

  const sqlService = new SqlServerService({
    server: decrypt(settings.sqlServerHost!),
    database: settings.sqlServerDatabase!,
    user: decrypt(settings.sqlServerUser!),
    password: decrypt(settings.sqlServerPassword!),
    port: settings.sqlServerPort || 1433,
    encrypt: settings.sqlServerEncrypt,
    trustServerCertificate: settings.sqlServerTrustCert,
  })

  // Obtener todas las facturas completadas
  const invoices = await prisma.invoice.findMany({
    where: {
      status: 'COMPLETED',
      organization: { slug: 'azaleia' }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`📊 Total facturas: ${invoices.length}\n`)

  let insertadas = 0
  let actualizadas = 0
  let errores = 0

  for (const invoice of invoices) {
    try {
      // Verificar si ya existe
      const existe = await sqlService.invoiceExists(invoice.id)

      if (existe) {
        // Actualizar solo estado SUNAT
        await sqlService.updateInvoice(invoice.id, {
          sunatVerified: invoice.sunatVerified ?? undefined,
          sunatEstadoCp: invoice.sunatEstadoCp ?? undefined,
        })
        actualizadas++
        console.log(`✅ Actualizada: ${invoice.serieNumero}`)
      } else {
        // Insertar nueva
        await sqlService.insertInvoice({
          id: invoice.id,
          status: invoice.status,
          invoiceDate: invoice.invoiceDate ?? undefined,
          rucEmisor: invoice.rucEmisor ?? undefined,
          razonSocialEmisor: invoice.razonSocialEmisor ?? undefined,
          serieNumero: invoice.serieNumero ?? undefined,
          documentType: invoice.documentType ?? undefined,
          documentTypeCode: invoice.documentTypeCode ?? undefined,
          subtotal: invoice.subtotal ?? undefined,
          igvMonto: invoice.igvMonto ?? undefined,
          totalAmount: invoice.totalAmount ?? undefined,
          currency: invoice.currency ?? undefined,
          sunatVerified: invoice.sunatVerified ?? undefined,
          sunatEstadoCp: invoice.sunatEstadoCp ?? undefined,
        })
        insertadas++
        console.log(`✅ Insertada: ${invoice.serieNumero}`)
      }
    } catch (error: any) {
      console.log(`❌ Error: ${invoice.serieNumero} - ${error.message}`)
      errores++
    }
  }

  await sqlService.close()

  console.log('\n═══════════════════════════════════════════')
  console.log('📊 RESUMEN DE SINCRONIZACIÓN:')
  console.log('═══════════════════════════════════════════')
  console.log(`✅ Insertadas: ${insertadas}`)
  console.log(`🔄 Actualizadas: ${actualizadas}`)
  console.log(`❌ Errores: ${errores}`)
  console.log(`📋 Total procesadas: ${invoices.length}`)
  console.log('')

  await prisma.$disconnect()
}

syncAllToSQL()
