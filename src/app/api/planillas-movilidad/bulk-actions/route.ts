import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'

type BulkAction = 'APROBAR' | 'RECHAZAR' | 'DELETE'

interface BulkActionRequest {
  planillaIds: string[]
  action: BulkAction
  comentarios?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar que el usuario tiene permisos
    const allowedRoles = ['VERIFICADOR', 'SUPER_ADMIN', 'ORG_ADMIN', 'STAFF', 'APROBADOR']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para realizar acciones masivas' },
        { status: 403 }
      )
    }

    const body: BulkActionRequest = await request.json()
    const { planillaIds, action, comentarios } = body

    if (!planillaIds || !Array.isArray(planillaIds) || planillaIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos una planilla' },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Se requiere una acción' },
        { status: 400 }
      )
    }

    // Verificar que todas las planillas pertenecen a la organización
    const planillas = await prisma.movilidadPlanilla.findMany({
      where: {
        id: { in: planillaIds },
        organizationId: session.user.organizationId,
      },
      include: {
        gastos: true,
        user: {
          select: { name: true, email: true },
        },
      },
    })

    if (planillas.length !== planillaIds.length) {
      return NextResponse.json(
        { error: 'Algunas planillas no existen o no pertenecen a tu organización' },
        { status: 400 }
      )
    }

    let result = { affected: 0, message: '', errors: [] as string[] }

    switch (action) {
      case 'APROBAR': {
        // Solo aprobar las que están pendientes
        const pendientes = planillas.filter(p => p.estadoAprobacion === 'PENDIENTE_APROBACION')

        if (pendientes.length === 0) {
          return NextResponse.json(
            { error: 'No hay planillas pendientes para aprobar' },
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

        let sqlService: SqlServerService | null = null
        if (settings?.sqlServerHost) {
          try {
            sqlService = new SqlServerService({
              server: decrypt(settings.sqlServerHost),
              database: settings.sqlServerDatabase!,
              user: decrypt(settings.sqlServerUser!),
              password: decrypt(settings.sqlServerPassword!),
              port: settings.sqlServerPort || 1433,
              encrypt: settings.sqlServerEncrypt,
              trustServerCertificate: settings.sqlServerTrustCert,
            })
          } catch (err: any) {
            console.error('Error conectando a SQL Server:', err.message)
          }
        }

        for (const planilla of pendientes) {
          try {
            // Actualizar en PostgreSQL
            await prisma.movilidadPlanilla.update({
              where: { id: planilla.id },
              data: {
                estadoAprobacion: 'APROBADA',
                aprobadoPorId: session.user.id,
                aprobadoEn: new Date(),
                comentariosAprobacion: comentarios || null,
              },
            })

            // Insertar en SQL Server si está configurado
            if (sqlService) {
              try {
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
                  nroRendicion: planilla.nroRendicion || undefined,
                  nroCajaChica: planilla.nroCajaChica || undefined,
                  tipoOperacion:
                    planilla.tipoOperacion === 'RENDICION'
                      ? ('RENDICION' as const)
                      : planilla.tipoOperacion === 'CAJA_CHICA'
                      ? ('CAJA_CHICA' as const)
                      : undefined,
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

                await sqlService.insertMovilidadPlanilla(sqlData)

                if (sqlData.nroCajaChica || sqlData.nroRendicion) {
                  await sqlService.insertMovilidadEnDocumentosIA(sqlData)
                }
              } catch (err: any) {
                result.errors.push(`Error SQL Server (${planilla.nroPlanilla}): ${err.message}`)
              }
            }

            result.affected++
          } catch (err: any) {
            result.errors.push(`Error aprobando ${planilla.nroPlanilla}: ${err.message}`)
          }
        }

        if (sqlService) {
          await sqlService.close()
        }

        result.message = `${result.affected} planilla${result.affected > 1 ? 's' : ''} aprobada${result.affected > 1 ? 's' : ''}`
        break
      }

      case 'RECHAZAR': {
        // Solo rechazar las que están pendientes
        const pendientes = planillas.filter(p => p.estadoAprobacion === 'PENDIENTE_APROBACION')

        if (pendientes.length === 0) {
          return NextResponse.json(
            { error: 'No hay planillas pendientes para rechazar' },
            { status: 400 }
          )
        }

        const updateResult = await prisma.movilidadPlanilla.updateMany({
          where: {
            id: { in: pendientes.map(p => p.id) },
            organizationId: session.user.organizationId,
          },
          data: {
            estadoAprobacion: 'RECHAZADA',
            aprobadoPorId: session.user.id,
            aprobadoEn: new Date(),
            comentariosAprobacion: comentarios || 'Rechazado en acción masiva',
          },
        })

        result = {
          affected: updateResult.count,
          message: `${updateResult.count} planilla${updateResult.count > 1 ? 's' : ''} rechazada${updateResult.count > 1 ? 's' : ''}`,
          errors: [],
        }
        break
      }

      case 'DELETE': {
        // Solo SUPER_ADMIN y STAFF pueden eliminar
        if (!['SUPER_ADMIN', 'STAFF'].includes(session.user.role)) {
          return NextResponse.json(
            { error: 'No tienes permisos para eliminar planillas' },
            { status: 403 }
          )
        }

        const deleteResult = await prisma.movilidadPlanilla.deleteMany({
          where: {
            id: { in: planillaIds },
            organizationId: session.user.organizationId,
          },
        })

        result = {
          affected: deleteResult.count,
          message: `${deleteResult.count} planilla${deleteResult.count > 1 ? 's' : ''} eliminada${deleteResult.count > 1 ? 's' : ''}`,
          errors: [],
        }
        break
      }

      default:
        return NextResponse.json(
          { error: 'Acción no reconocida' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Bulk planillas action error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al realizar la acción' },
      { status: 500 }
    )
  }
}
