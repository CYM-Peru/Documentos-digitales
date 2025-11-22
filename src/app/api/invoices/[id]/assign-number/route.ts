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
      try {
        console.log(
          `📤 Intentando enviar factura ${params.id} a SQL Server con número ${nroRendicion}...`
        )

        // Conectar a SQL Server
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

        const pool = await sql.connect(config)

        // Preparar datos según el tipo
        const tipoDocumento = updatedInvoice.documentTypeCode || '01' // Por defecto factura
        const numDoc = updatedInvoice.serieNumero || updatedInvoice.invoiceNumber || ''
        const rucProveedor = updatedInvoice.rucEmisor || ''
        const razonSocial = updatedInvoice.razonSocialEmisor || updatedInvoice.vendorName || ''
        const totalDocumento = updatedInvoice.totalAmount || 0

        let result: any

        if (updatedInvoice.tipoOperacion === 'RENDICION') {
          // Insertar en tabla de rendiciones
          result = await pool
            .request()
            .input('NroRend', sql.Int, parseInt(nroRendicion))
            .input('TipoDocumento', sql.VarChar(2), tipoDocumento)
            .input('NumDoc', sql.VarChar(50), numDoc)
            .input('RucProveedor', sql.VarChar(11), rucProveedor)
            .input('RazonSocial', sql.VarChar(200), razonSocial)
            .input('TotalDocumento', sql.Decimal(18, 2), totalDocumento)
            .query(`
              INSERT INTO AzaleiaPeru.[dbo].[CntCtaRendicionDocumentosIA]
                (NroRend, TipoDocumento, NumDoc, RucProveedor, RazonSocial, TotalDocumento, FecReg)
              VALUES
                (@NroRend, @TipoDocumento, @NumDoc, @RucProveedor, @RazonSocial, @TotalDocumento, GETDATE())
            `)
        } else {
          // Insertar en tabla de cajas chicas
          result = await pool
            .request()
            .input('NroCajaChica', sql.Int, parseInt(nroRendicion))
            .input('TipoDocumento', sql.VarChar(2), tipoDocumento)
            .input('NumDoc', sql.VarChar(50), numDoc)
            .input('RucProveedor', sql.VarChar(11), rucProveedor)
            .input('RazonSocial', sql.VarChar(200), razonSocial)
            .input('TotalDocumento', sql.Decimal(18, 2), totalDocumento)
            .query(`
              INSERT INTO AzaleiaPeru.[dbo].[CntCtaCajaChicaDocumentosIA]
                (NroCajaChica, TipoDocumento, NumDoc, RucProveedor, RazonSocial, TotalDocumento, FecReg)
              VALUES
                (@NroCajaChica, @TipoDocumento, @NumDoc, @RucProveedor, @RazonSocial, @TotalDocumento, GETDATE())
            `)
        }

        await pool.close()

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

        // Aún así devolver éxito porque el número se asignó en PostgreSQL
        return NextResponse.json({
          success: true,
          message: 'Número asignado, pero hubo un error al enviar a SQL Server',
          invoice: updatedInvoice,
          sqlServerInserted: false,
          sqlServerError: sqlError.message,
        })
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
