import { PrismaClient } from '@prisma/client'
import sql from 'mssql'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Checking Caja Chica sync between PostgreSQL and SQL Server...\n')

    // 1. Get invoices from PostgreSQL with CAJA_CHICA type
    const invoices = await prisma.invoice.findMany({
      where: {
        tipoOperacion: 'CAJA_CHICA',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        vendorName: true,
        invoiceNumber: true,
        serieNumero: true,
        totalAmount: true,
        status: true,
        nroRendicion: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    console.log(`Found ${invoices.length} Caja Chica invoices in PostgreSQL:\n`)

    invoices.forEach((invoice, idx) => {
      console.log(`${idx + 1}. ID: ${invoice.id}`)
      console.log(`   Vendor: ${invoice.vendorName || 'N/A'}`)
      console.log(`   Serie/Número: ${invoice.serieNumero || invoice.invoiceNumber || 'N/A'}`)
      console.log(`   Amount: S/ ${invoice.totalAmount || 0}`)
      console.log(`   Status: ${invoice.status}`)
      console.log(`   Nro Caja Chica/Rendición: ${invoice.nroRendicion || 'N/A'}`)
      console.log(`   Created by: ${invoice.user?.name || invoice.user?.email || 'N/A'}`)
      console.log(`   Created at: ${invoice.createdAt}`)
      console.log()
    })

    // 2. Connect to SQL Server and check CntCtaCajaChicaDocumentosIA
    const config = {
      user: 'AdminAzaleia',
      password: 'Azaleia.2025',
      server: '190.117.103.67',
      database: 'AzaleiaPeru',
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      requestTimeout: 30000,
    }

    console.log('Connecting to SQL Server...')
    const pool = await sql.connect(config)

    const result = await pool.request().query(`
      SELECT
        NroCajaChica,
        NumDoc,
        RucProveedor,
        RazonSocial,
        TotalDocumento,
        FecReg
      FROM AzaleiaPeru.[dbo].[CntCtaCajaChicaDocumentosIA]
      ORDER BY FecReg DESC
    `)

    console.log(`\nFound ${result.recordset.length} documents in SQL Server:\n`)

    result.recordset.forEach((doc, idx) => {
      console.log(`${idx + 1}. Nro Caja Chica: ${doc.NroCajaChica}`)
      console.log(`   NumDoc: ${doc.NumDoc}`)
      console.log(`   RUC: ${doc.RucProveedor}`)
      console.log(`   Razón Social: ${doc.RazonSocial}`)
      console.log(`   Total: S/ ${doc.TotalDocumento}`)
      console.log(`   Fecha: ${doc.FecReg}`)
      console.log()
    })

    // 3. Find missing documents
    console.log('\n=== ANALYSIS ===\n')

    const completedInvoices = invoices.filter((inv) => inv.status === 'COMPLETED')
    const sqlServerDocs = new Set(
      result.recordset.map((doc) => `${doc.NumDoc}-${doc.RucProveedor}`)
    )

    console.log(`Completed invoices in PostgreSQL: ${completedInvoices.length}`)
    console.log(`Documents in SQL Server: ${result.recordset.length}\n`)

    const missing = completedInvoices.filter((inv) => {
      const key = `${inv.serieNumero || inv.invoiceNumber || ''}-${inv.vendorName || ''}`
      return !sqlServerDocs.has(key)
    })

    if (missing.length > 0) {
      console.log(`⚠️  ${missing.length} completed invoice(s) NOT found in SQL Server:\n`)
      missing.forEach((inv) => {
        console.log(`  - ID: ${inv.id}`)
        console.log(`    Serie/Número: ${inv.serieNumero || inv.invoiceNumber || 'N/A'}`)
        console.log(`    Vendor: ${inv.vendorName || 'N/A'}`)
        console.log(`    Amount: S/ ${inv.totalAmount || 0}`)
        console.log(`    Nro Caja Chica/Rendición: ${inv.nroRendicion || 'N/A'}`)
        console.log()
      })
    } else {
      console.log('✅ All completed invoices are in SQL Server')
    }

    await pool.close()
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
