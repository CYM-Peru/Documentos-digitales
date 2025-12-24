import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'

/**
 * POST /api/planillas-movilidad/[id]/asignar-destino
 * Asigna una planilla aprobada a una rendición o caja chica
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { tipoOperacion, nroRendicion, nroCajaChica } = body

    // Validar que se proporcionó un destino
    if (!tipoOperacion || !['RENDICION', 'CAJA_CHICA'].includes(tipoOperacion)) {
      return NextResponse.json(
        { error: 'Debe especificar RENDICION o CAJA_CHICA' },
        { status: 400 }
      )
    }

    if (tipoOperacion === 'RENDICION' && !nroRendicion) {
      return NextResponse.json(
        { error: 'Debe especificar el número de rendición' },
        { status: 400 }
      )
    }

    if (tipoOperacion === 'CAJA_CHICA' && !nroCajaChica) {
      return NextResponse.json(
        { error: 'Debe especificar el número de caja chica' },
        { status: 400 }
      )
    }

    // Buscar la planilla
    const planilla = await prisma.movilidadPlanilla.findUnique({
      where: { id },
      include: {
        gastos: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        aprobadoPor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!planilla) {
      return NextResponse.json(
        { error: 'Planilla no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que pertenece al usuario o que el usuario es admin/supervisor/aprobador
    const canAssign =
      planilla.userId === session.user.id ||
      ['ADMIN', 'SUPERVISOR', 'APROBADOR'].includes(session.user.role)

    if (!canAssign) {
      return NextResponse.json(
        { error: 'No tiene permisos para asignar esta planilla' },
        { status: 403 }
      )
    }

    // Verificar que pertenece a la misma organización
    if (planilla.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: 'No tiene permisos para asignar esta planilla' },
        { status: 403 }
      )
    }

    // Verificar que está aprobada
    if (planilla.estadoAprobacion !== 'APROBADA') {
      return NextResponse.json(
        { error: 'Solo se pueden asignar planillas aprobadas' },
        { status: 400 }
      )
    }

    // Verificar que no está ya asignada
    if (planilla.aplicadaEn) {
      return NextResponse.json(
        {
          error: `Planilla ya asignada a ${
            planilla.tipoOperacion === 'RENDICION'
              ? `Rendición #${planilla.nroRendicion}`
              : `Caja Chica #${planilla.nroCajaChica}`
          }`,
        },
        { status: 400 }
      )
    }

    // Actualizar la planilla en PostgreSQL
    const planillaActualizada = await prisma.movilidadPlanilla.update({
      where: { id },
      data: {
        tipoOperacion: tipoOperacion as 'RENDICION' | 'CAJA_CHICA',
        nroRendicion: tipoOperacion === 'RENDICION' ? nroRendicion : null,
        nroCajaChica: tipoOperacion === 'CAJA_CHICA' ? nroCajaChica : null,
        aplicadaEn: new Date(),
      },
      include: {
        gastos: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        aprobadoPor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // 🆕 Ahora insertar en SQL Server (CntCtaCajaChicaDocumentosIA)
    const settings = await prisma.organizationSettings.findFirst({
      where: {
        organizationId: session.user.organizationId,
        sqlServerEnabled: true,
      },
    })

    let sqlServerSaved = false
    let sqlServerError = null

    if (settings?.sqlServerHost) {
      try {
        // Preparar datos para SQL Server
        const sqlData = {
          id: planillaActualizada.id,
          nroPlanilla: planillaActualizada.nroPlanilla || undefined,
          razonSocial: planillaActualizada.razonSocial || undefined,
          ruc: planillaActualizada.ruc || undefined,
          periodo: planillaActualizada.periodo || undefined,
          fechaEmision: planillaActualizada.fechaEmision || undefined,
          nombresApellidos: planillaActualizada.nombresApellidos || undefined,
          cargo: planillaActualizada.cargo || undefined,
          dni: planillaActualizada.dni || undefined,
          centroCosto: planillaActualizada.centroCosto || undefined,
          totalViaje: planillaActualizada.totalViaje,
          totalDia: planillaActualizada.totalDia,
          totalGeneral: planillaActualizada.totalGeneral,
          usuario: planillaActualizada.user.email || '',
          nroRendicion: planillaActualizada.nroRendicion || undefined,
          nroCajaChica: planillaActualizada.nroCajaChica || undefined,
          tipoOperacion: planillaActualizada.tipoOperacion as 'RENDICION' | 'CAJA_CHICA',
          gastos: planillaActualizada.gastos.map((g) => ({
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

        // Conectar a SQL Server
        const sqlService = new SqlServerService({
          server: decrypt(settings.sqlServerHost),
          database: settings.sqlServerDatabase!,
          user: decrypt(settings.sqlServerUser!),
          password: decrypt(settings.sqlServerPassword!),
          port: settings.sqlServerPort || 1433,
          encrypt: settings.sqlServerEncrypt,
          trustServerCertificate: settings.sqlServerTrustCert,
        })

        // Insertar en CntCtaMovilidadPlanillas
        await sqlService.insertMovilidadPlanilla(sqlData)

        // 🆕 TAMBIÉN insertar en CntCtaCajaChicaDocumentosIA
        await sqlService.insertMovilidadEnDocumentosIA(sqlData)

        await sqlService.close()

        sqlServerSaved = true
      } catch (error: any) {
        console.error('Error al guardar en SQL Server:', error)
        sqlServerError = error.message
        // No fallar la asignación si SQL Server falla
      }
    }

    return NextResponse.json({
      success: true,
      message: `Planilla asignada a ${
        tipoOperacion === 'RENDICION'
          ? `Rendición #${nroRendicion}`
          : `Caja Chica #${nroCajaChica}`
      }`,
      planilla: planillaActualizada,
      sqlServerSaved,
      sqlServerError,
    })
  } catch (error: any) {
    console.error('Asignar destino error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to assign destination' },
      { status: 500 }
    )
  }
}
