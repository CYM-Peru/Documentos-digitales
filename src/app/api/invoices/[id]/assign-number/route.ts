import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import sql from 'mssql'

/**
 * PATCH /api/invoices/[id]/assign-number
 * Asigna o actualiza el número de rendición/caja chica de una factura
 * Si la factura está COMPLETED, intenta reenviar a SQL Server
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { nroRendicion } = await request.json()

    if (!nroRendicion) {
      return NextResponse.json(
        { error: 'Número de rendición/caja chica es requerido' },
        { status: 400 }
      )
    }

    // Obtener la factura
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Verificar que pertenece a la misma organización
    if (invoice.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Actualizar el número en PostgreSQL
    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: { nroRendicion },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    })

    // Si la factura está COMPLETED y tiene tipoOperacion, intentar enviar a SQL Server
    if (
      updatedInvoice.status === 'COMPLETED' &&
      updatedInvoice.tipoOperacion &&
      (updatedInvoice.tipoOperacion === 'RENDICION' ||
        updatedInvoice.tipoOperacion === 'CAJA_CHICA')
    ) {
      let pool: sql.ConnectionPool | null = null

      try {
        console.log(
          `📤 Intentando enviar factura ${params.id} a SQL Server con número ${nroRendicion}...`
        )

        // Conectar a SQL Server con timeout más corto para detectar problemas rápido
        const config: sql.config = {
          user: 'cpalomino',
          password: 'azaleia.2018',
          server: '190.119.245.254',
          database: 'AzaleiaPeru',
          port: 1433,
          options: {
            encrypt: false,
            trustServerCertificate: true,
          },
          connectionTimeout: 10000, // 10 segundos para conectar
          requestTimeout: 30000,    // 30 segundos para queries
        }

        pool = await sql.connect(config)

        // Preparar datos según el tipo
        const tipoDocumento = updatedInvoice.documentTypeCode || '01'
        const numDoc = updatedInvoice.serieNumero || updatedInvoice.invoiceNumber || ''
        const rucProveedor = updatedInvoice.rucEmisor || ''
        const razonSocial = updatedInvoice.razonSocialEmisor || updatedInvoice.vendorName || ''
        const totalDocumento = updatedInvoice.totalAmount || 0
        const invoiceId = params.id

        let result: any

        if (updatedInvoice.tipoOperacion === 'RENDICION') {
          // Primero verificar si ya existe
          const existsCheck = await pool
            .request()
            .input('ID', sql.NVarChar(255), invoiceId)
            .query(`SELECT COUNT(*) as count FROM [dbo].[CntCtaRendicionDocumentosIA] WHERE [ID] = @ID`)

          const exists = existsCheck.recordset[0].count > 0

          if (exists) {
            // UPDATE si ya existe
            console.log(`📝 Registro ya existe en CntCtaRendicionDocumentosIA, actualizando...`)
            result = await pool
              .request()
              .input('ID', sql.NVarChar(255), invoiceId)
              .input('NroRend', sql.Int, parseInt(nroRendicion))
              .query(`
                UPDATE [dbo].[CntCtaRendicionDocumentosIA]
                SET [NroRend] = @NroRend
                WHERE [ID] = @ID
              `)
          } else {
            // INSERT si no existe
            result = await pool
              .request()
              .input('ID', sql.NVarChar(255), invoiceId)
              .input('NroRend', sql.Int, parseInt(nroRendicion))
              .input('TipoDocumento', sql.VarChar(2), tipoDocumento)
              .input('NumDoc', sql.VarChar(50), numDoc)
              .input('RucProveedor', sql.VarChar(11), rucProveedor)
              .input('RazonSocial', sql.VarChar(200), razonSocial)
              .input('TotalDocumento', sql.Decimal(18, 2), totalDocumento)
              .query(`
                INSERT INTO [dbo].[CntCtaRendicionDocumentosIA]
                  ([ID], [NroRend], [Tipo Documento], [Serie-Número], [RUC Emisor], [Razón Social Emisor], [Total Factura], [Fecha])
                VALUES
                  (@ID, @NroRend, @TipoDocumento, @NumDoc, @RucProveedor, @RazonSocial, @TotalDocumento, GETDATE())
              `)
          }
        } else {
          // CAJA_CHICA - Verificar si ya existe
          const existsCheck = await pool
            .request()
            .input('ID', sql.NVarChar(255), invoiceId)
            .query(`SELECT COUNT(*) as count FROM [dbo].[CntCtaCajaChicaDocumentosIA] WHERE [ID] = @ID`)

          const exists = existsCheck.recordset[0].count > 0

          if (exists) {
            // UPDATE si ya existe
            console.log(`📝 Registro ya existe en CntCtaCajaChicaDocumentosIA, actualizando...`)
            result = await pool
              .request()
              .input('ID', sql.NVarChar(255), invoiceId)
              .input('NroRend', sql.Int, parseInt(nroRendicion))
              .query(`
                UPDATE [dbo].[CntCtaCajaChicaDocumentosIA]
                SET [NroRend] = @NroRend
                WHERE [ID] = @ID
              `)
          } else {
            // INSERT si no existe
            result = await pool
              .request()
              .input('ID', sql.NVarChar(255), invoiceId)
              .input('NroRend', sql.Int, parseInt(nroRendicion))
              .input('TipoDocumento', sql.VarChar(2), tipoDocumento)
              .input('NumDoc', sql.VarChar(50), numDoc)
              .input('RucProveedor', sql.VarChar(11), rucProveedor)
              .input('RazonSocial', sql.VarChar(200), razonSocial)
              .input('TotalDocumento', sql.Decimal(18, 2), totalDocumento)
              .query(`
                INSERT INTO [dbo].[CntCtaCajaChicaDocumentosIA]
                  ([ID], [NroRend], [Tipo Documento], [Serie-Número], [RUC Emisor], [Razón Social Emisor], [Total Factura], [Fecha])
                VALUES
                  (@ID, @NroRend, @TipoDocumento, @NumDoc, @RucProveedor, @RazonSocial, @TotalDocumento, GETDATE())
              `)
          }
        }

        console.log(
          `✅ Factura ${params.id} enviada exitosamente a SQL Server (${result.rowsAffected[0]} filas)`
        )

        return NextResponse.json({
          success: true,
          message: 'Número asignado y factura enviada a SQL Server exitosamente',
          invoice: updatedInvoice,
          sqlServerInserted: true,
        })
      } catch (sqlError: any) {
        console.error('Error al enviar a SQL Server:', sqlError)

        // Determinar tipo de error para mensaje más descriptivo
        let errorMessage = 'Número asignado, pero hubo un error al enviar a SQL Server'
        if (sqlError.message?.includes('connect') || sqlError.message?.includes('timeout')) {
          errorMessage = 'Número asignado localmente. SQL Server no disponible (timeout de conexión)'
        } else if (sqlError.message?.includes('duplicate') || sqlError.message?.includes('PRIMARY KEY')) {
          errorMessage = 'Número asignado. El registro ya existe en SQL Server'
        }

        // Aún así devolver éxito porque el número se asignó en PostgreSQL
        return NextResponse.json({
          success: true,
          message: errorMessage,
          invoice: updatedInvoice,
          sqlServerInserted: false,
          sqlServerError: sqlError.message,
        })
      } finally {
        // Siempre cerrar la conexión
        if (pool) {
          try {
            await pool.close()
          } catch (closeError) {
            console.error('Error cerrando conexión SQL Server:', closeError)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Número asignado exitosamente',
      invoice: updatedInvoice,
    })
  } catch (error: any) {
    console.error('Error assigning number:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to assign number' },
      { status: 500 }
    )
  }
}
