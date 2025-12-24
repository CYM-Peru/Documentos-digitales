import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'

/**
 * POST /api/planillas-movilidad/asociar
 * Asocia planillas aprobadas a una caja chica y las envía a SQL Server
 * Solo para VERIFICADOR y SUPER_ADMIN
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo VERIFICADOR y SUPER_ADMIN pueden asociar
    const canAssociate = ['VERIFICADOR', 'SUPER_ADMIN'].includes(session.user.role)
    if (!canAssociate) {
      return NextResponse.json(
        { error: 'No tienes permisos para esta operación' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { planillaIds, nroCajaChica, codLocal } = body

    if (!planillaIds || !Array.isArray(planillaIds) || planillaIds.length === 0) {
      return NextResponse.json(
        { error: 'Debes seleccionar al menos una planilla' },
        { status: 400 }
      )
    }

    if (!nroCajaChica) {
      return NextResponse.json(
        { error: 'Debes seleccionar una caja chica' },
        { status: 400 }
      )
    }

    // Obtener configuración de SQL Server
    const settings = await prisma.organizationSettings.findFirst({
      where: {
        organizationId: session.user.organizationId,
        sqlServerEnabled: true,
      },
    })

    // Actualizar planillas en PostgreSQL
    const updateResult = await prisma.movilidadPlanilla.updateMany({
      where: {
        id: { in: planillaIds },
        organizationId: session.user.organizationId,
        estadoAprobacion: 'APROBADA',
        nroCajaChica: null, // Solo si no tienen caja chica asignada
      },
      data: {
        nroCajaChica: nroCajaChica,
        tipoOperacion: 'CAJA_CHICA',
      },
    })

    console.log(`📋 ${updateResult.count} planillas asociadas a Caja Chica #${nroCajaChica}`)

    // Obtener las planillas actualizadas para enviar a SQL Server
    const planillasActualizadas = await prisma.movilidadPlanilla.findMany({
      where: {
        id: { in: planillaIds },
      },
      include: {
        gastos: true,
        user: {
          select: {
            name: true,
            email: true,
            sede: {
              select: {
                codLocal: true,
                nombre: true,
              },
            },
          },
        },
      },
    })

    // Enviar a SQL Server si está configurado
    let sqlServerResults: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: [],
    }

    if (settings?.sqlServerHost) {
      try {
        const sqlService = new SqlServerService({
          server: decrypt(settings.sqlServerHost),
          database: settings.sqlServerDatabase!,
          user: decrypt(settings.sqlServerUser!),
          password: decrypt(settings.sqlServerPassword!),
          port: settings.sqlServerPort || 1433,
          encrypt: settings.sqlServerEncrypt,
          trustServerCertificate: settings.sqlServerTrustCert,
        })

        for (const planilla of planillasActualizadas) {
          try {
            // Preparar datos para SQL Server
            const sqlData = {
              id: planilla.id,
              nroPlanilla: planilla.nroPlanilla || undefined,
              razonSocial: planilla.razonSocial || undefined,
              ruc: planilla.ruc || undefined,
              periodo: planilla.periodo || undefined,
              fechaEmision: planilla.fechaEmision || undefined,
              nombresApellidos: planilla.nombresApellidos || undefined,
              cargo: planilla.cargo || undefined,
              dni: planilla.dni || undefined,
              centroCosto: planilla.centroCosto || undefined,
              totalViaje: planilla.totalViaje,
              totalDia: planilla.totalDia,
              totalGeneral: planilla.totalGeneral,
              usuario: planilla.user.email || '',
              nroCajaChica: nroCajaChica,
              tipoOperacion: 'CAJA_CHICA' as const,
              codLocal: codLocal || planilla.user.sede?.codLocal || undefined,
              gastos: planilla.gastos.map((g) => ({
                fechaGasto: g.fechaGasto || undefined,
                dia: g.dia || undefined,
                mes: g.mes || undefined,
                anio: g.anio || undefined,
                motivo: g.motivo || undefined,
                origen: g.origen || undefined,
                destino: g.destino || undefined,
                montoViaje: g.montoViaje,
                montoDia: g.montoDia,
              })),
            }

            // Insertar en SQL Server
            await sqlService.insertMovilidadPlanilla(sqlData)
            await sqlService.insertMovilidadEnDocumentosIA(sqlData)

            sqlServerResults.success++
            console.log(`✅ Planilla ${planilla.nroPlanilla} enviada a SQL Server`)
          } catch (error: any) {
            sqlServerResults.failed++
            sqlServerResults.errors.push(`${planilla.nroPlanilla}: ${error.message}`)
            console.error(`❌ Error enviando planilla ${planilla.nroPlanilla}:`, error.message)
          }
        }

        await sqlService.close()
      } catch (error: any) {
        console.error('Error conectando a SQL Server:', error)
        sqlServerResults.errors.push(`Error de conexión: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updateResult.count} planilla(s) asociada(s) a Caja Chica #${nroCajaChica}`,
      asociadas: updateResult.count,
      sqlServer: {
        enabled: !!settings?.sqlServerHost,
        success: sqlServerResults.success,
        failed: sqlServerResults.failed,
        errors: sqlServerResults.errors,
      },
    })
  } catch (error: any) {
    console.error('Error asociando planillas:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to associate planillas' },
      { status: 500 }
    )
  }
}
