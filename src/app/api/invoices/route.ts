import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '500') // Aumentado para mostrar todos los docs
    const status = searchParams.get('status')
    const userId = searchParams.get('userId') // 🆕 Filtro por usuario
    const tipoOperacion = searchParams.get('tipoOperacion') // 🆕 Filtro por tipo de operación

    const where: any = {
      organizationId: session.user.organizationId,
    }

    // Solo estos roles pueden ver TODAS las facturas de la organización
    const canViewAll = ['SUPER_ADMIN', 'ORG_ADMIN', 'STAFF', 'VERIFICADOR', 'ADMIN', 'SUPERVISOR', 'APROBADOR'].includes(session.user.role)

    // Por defecto, todos los usuarios solo ven sus propias facturas
    // A menos que tengan un rol que permite ver todas
    if (!canViewAll) {
      // USER_L1, USER_L2, USER_L3 y cualquier otro rol solo ven sus propias facturas
      where.userId = session.user.id
    } else if (userId) {
      // Si puede ver todas Y se pasa filtro de usuario, filtrar por ese usuario
      where.userId = userId
    }

    if (status) {
      where.status = status
    }

    // Filtrar por tipo de operación
    if (tipoOperacion) {
      where.tipoOperacion = tipoOperacion
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Get invoices error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get invoices' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to delete invoices from SQL Server
 */
async function deleteFromSQLServer(invoiceIds: string[], organizationId: string) {
  try {
    // Get SQL Server settings
    const settings = await prisma.organizationSettings.findFirst({
      where: {
        organizationId,
        sqlServerEnabled: true,
      },
    })

    if (!settings?.sqlServerHost) {
      console.log('📊 SQL Server not enabled, skipping deletion')
      return
    }

    const sqlService = new SqlServerService({
      server: decrypt(settings.sqlServerHost),
      database: settings.sqlServerDatabase!,
      user: decrypt(settings.sqlServerUser!),
      password: decrypt(settings.sqlServerPassword!),
      port: settings.sqlServerPort || 1433,
      encrypt: settings.sqlServerEncrypt,
      trustServerCertificate: settings.sqlServerTrustCert,
    })

    console.log(`📊 SQL Server - Deleting ${invoiceIds.length} invoice(s)...`)

    for (const id of invoiceIds) {
      await sqlService.deleteInvoice(id)
    }

    await sqlService.close()
    console.log(`✅ SQL Server - ${invoiceIds.length} invoice(s) deleted`)
  } catch (error: any) {
    console.error('❌ SQL Server deletion error:', error.message)
    // Don't throw - SQL Server deletion is optional
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const ids = searchParams.get('ids')

    // Bulk delete
    if (ids) {
      const invoiceIds = ids.split(',')

      // Delete from PostgreSQL
      const result = await prisma.invoice.deleteMany({
        where: {
          id: { in: invoiceIds },
          organizationId: session.user.organizationId,
        },
      })

      // Delete from SQL Server (esperar para mantener consistencia)
      try {
        await deleteFromSQLServer(invoiceIds, session.user.organizationId)
      } catch (sqlError) {
        console.error('SQL Server deletion error (non-critical):', sqlError)
        // No fallar la operación completa si SQL Server falla
      }

      return NextResponse.json({
        success: true,
        deletedCount: result.count,
      })
    }

    // Single delete
    if (id) {
      await prisma.invoice.delete({
        where: {
          id,
          organizationId: session.user.organizationId,
        },
      })

      // Delete from SQL Server (esperar para mantener consistencia)
      try {
        await deleteFromSQLServer([id], session.user.organizationId)
      } catch (sqlError) {
        console.error('SQL Server deletion error (non-critical):', sqlError)
        // No fallar la operación completa si SQL Server falla
      }

      return NextResponse.json({
        success: true,
      })
    }

    return NextResponse.json(
      { error: 'No invoice ID provided' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Delete invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}
