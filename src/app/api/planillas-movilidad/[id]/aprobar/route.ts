import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'
import { PlanillaWhatsAppNotifier } from '@/services/whatsapp'

/**
 * POST /api/planillas-movilidad/[id]/aprobar
 * Aprueba o rechaza una planilla de movilidad
 * Solo usuarios con rol APROBADOR pueden usar este endpoint
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

    // Verificar que el usuario tiene rol APROBADOR
    if (session.user.role !== 'APROBADOR') {
      return NextResponse.json(
        { error: 'Solo usuarios con rol APROBADOR pueden aprobar planillas' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { accion, comentarios } = body // accion: 'APROBAR' | 'RECHAZAR'

    if (!accion || !['APROBAR', 'RECHAZAR'].includes(accion)) {
      return NextResponse.json(
        { error: 'Acción inválida. Debe ser APROBAR o RECHAZAR' },
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
      },
    })

    if (!planilla) {
      return NextResponse.json(
        { error: 'Planilla no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que pertenece a la organización del aprobador
    if (planilla.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: 'No tiene permisos para aprobar esta planilla' },
        { status: 403 }
      )
    }

    // Verificar que está en estado pendiente
    if (planilla.estadoAprobacion !== 'PENDIENTE_APROBACION') {
      return NextResponse.json(
        { error: `Planilla ya fue ${planilla.estadoAprobacion.toLowerCase()}` },
        { status: 400 }
      )
    }

    if (accion === 'RECHAZAR') {
      // Rechazar planilla
      const planillaActualizada = await prisma.movilidadPlanilla.update({
        where: { id },
        data: {
          estadoAprobacion: 'RECHAZADA',
          aprobadoPorId: session.user.id,
          aprobadoEn: new Date(),
          comentariosAprobacion: comentarios || null,
        },
        include: {
          gastos: true,
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
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

      // 🆕 Enviar notificación WhatsApp al usuario (si está activado)
      try {
        const settings = await prisma.organizationSettings.findFirst({
          where: { organizationId: session.user.organizationId },
        })

        if (
          settings?.whatsappEnabled &&
          settings?.whatsappConnected &&
          settings?.whatsappNotifyPlanillaRejected &&
          settings?.whatsappInstanceName &&
          planillaActualizada.user.phone
        ) {
          console.log('📱 WhatsApp enabled - sending rejection notification to user')

          const notifier = new PlanillaWhatsAppNotifier(
            settings.whatsappApiUrl || undefined,
            settings.whatsappApiKey || undefined
          )

          try {
            await notifier.notifyPlanillaRejected({
              instanceName: settings.whatsappInstanceName,
              userPhone: planillaActualizada.user.phone,
              approverName: planillaActualizada.aprobadoPor?.name || session.user.name || session.user.email,
              totalAmount: planillaActualizada.totalGeneral,
              reason: comentarios,
              planillaId: planillaActualizada.id,
            })
            console.log(`✅ WhatsApp rejection notification sent to user`)
          } catch (error: any) {
            console.error(`❌ Error sending WhatsApp rejection notification:`, error.message)
          }
        } else {
          console.log('⚪ WhatsApp rejection notifications disabled or user has no phone')
        }
      } catch (error: any) {
        console.error('❌ Error in WhatsApp rejection notification flow:', error.message)
      }

      return NextResponse.json({
        success: true,
        message: 'Planilla rechazada correctamente',
        planilla: planillaActualizada,
      })
    }

    // APROBAR - Actualizar PostgreSQL y enviar a SQL Server
    const planillaActualizada = await prisma.movilidadPlanilla.update({
      where: { id },
      data: {
        estadoAprobacion: 'APROBADA',
        aprobadoPorId: session.user.id,
        aprobadoEn: new Date(),
        comentariosAprobacion: comentarios || null,
      },
      include: {
        gastos: true,
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
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

    // Obtener configuración de SQL Server
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
        // Preparar datos para SQL Server (convertir null a undefined)
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
          usuario: planillaActualizada.user.email?.split('@')[0] || '',
          nroRendicion: planillaActualizada.nroRendicion || undefined,
          nroCajaChica: planillaActualizada.nroCajaChica || undefined,
          tipoOperacion:
            planillaActualizada.tipoOperacion === 'RENDICION'
              ? ('RENDICION' as const)
              : planillaActualizada.tipoOperacion === 'CAJA_CHICA'
              ? ('CAJA_CHICA' as const)
              : undefined,
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

        // Insertar en SQL Server
        await sqlService.insertMovilidadPlanilla(sqlData)
        await sqlService.close()

        sqlServerSaved = true
      } catch (error: any) {
        console.error('Error al guardar en SQL Server:', error)
        sqlServerError = error.message
        // No fallar la aprobación si SQL Server falla
        // La planilla queda aprobada en PostgreSQL
      }
    }

    // 🆕 Enviar notificación WhatsApp al usuario (si está activado)
    try {
      if (
        settings?.whatsappEnabled &&
        settings?.whatsappConnected &&
        settings?.whatsappNotifyPlanillaApproved &&
        settings?.whatsappInstanceName &&
        planillaActualizada.user.phone
      ) {
        console.log('📱 WhatsApp enabled - sending approval notification to user')

        const notifier = new PlanillaWhatsAppNotifier(
          settings.whatsappApiUrl || undefined,
          settings.whatsappApiKey || undefined
        )

        try {
          await notifier.notifyPlanillaApproved({
            instanceName: settings.whatsappInstanceName,
            userPhone: planillaActualizada.user.phone,
            approverName: planillaActualizada.aprobadoPor?.name || session.user.name || session.user.email,
            totalAmount: planillaActualizada.totalGeneral,
            planillaId: planillaActualizada.id,
          })
          console.log(`✅ WhatsApp approval notification sent to user`)
        } catch (error: any) {
          console.error(`❌ Error sending WhatsApp approval notification:`, error.message)
        }
      } else {
        console.log('⚪ WhatsApp approval notifications disabled or user has no phone')
      }
    } catch (error: any) {
      console.error('❌ Error in WhatsApp approval notification flow:', error.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Planilla aprobada correctamente',
      planilla: planillaActualizada,
      sqlServerSaved,
      sqlServerError,
    })
  } catch (error: any) {
    console.error('Aprobar planilla error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to approve/reject planilla' },
      { status: 500 }
    )
  }
}
