import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PlanillaWhatsAppNotifier } from '@/services/whatsapp'

/**
 * GET /api/planillas-movilidad - Obtiene las planillas de movilidad del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 🆕 Determinar qué planillas mostrar según el rol
    // APROBADOR, ADMIN y SUPERVISOR ven TODAS las planillas de la organización
    // Otros roles solo ven sus propias planillas
    const canViewAll = ['APROBADOR', 'ADMIN', 'SUPERVISOR'].includes(session.user.role)

    const whereClause: any = {
      organizationId: session.user.organizationId,
    }

    // Si NO puede ver todas, filtrar solo sus planillas
    if (!canViewAll) {
      whereClause.userId = session.user.id
    }

    // Obtener planillas desde PostgreSQL
    const planillas = await prisma.movilidadPlanilla.findMany({
      where: whereClause,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      planillas,
    })
  } catch (error: any) {
    console.error('Get planillas movilidad error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get planillas movilidad' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/planillas-movilidad - Crea una nueva planilla de movilidad
 * Guarda en PostgreSQL con estado PENDIENTE_APROBACION
 * Solo va a SQL Server después de que un APROBADOR la apruebe
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validar datos requeridos del trabajador
    if (!body.nombresApellidos || !body.cargo || !body.dni) {
      return NextResponse.json(
        { error: 'Datos del trabajador requeridos (nombre, cargo, DNI)' },
        { status: 400 }
      )
    }

    // Crear planilla en PostgreSQL con estado PENDIENTE_APROBACION
    const planilla = await prisma.movilidadPlanilla.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,

        // Datos de la planilla
        nroPlanilla: body.nroPlanilla || null,
        razonSocial: body.razonSocial || null,
        ruc: body.ruc || null,
        periodo: body.periodo || null,
        fechaEmision: body.fechaEmision ? new Date(body.fechaEmision) : null,

        // Datos del trabajador
        nombresApellidos: body.nombresApellidos,
        cargo: body.cargo,
        dni: body.dni,
        centroCosto: body.centroCosto || null,

        // Totales
        totalViaje: body.totalViaje || 0,
        totalDia: body.totalDia || 0,
        totalGeneral: body.totalGeneral || 0,

        // Tipo de operación
        tipoOperacion: body.tipoOperacion || null,
        nroRendicion: body.nroRendicion || null,
        nroCajaChica: body.nroCajaChica || null,

        // Imagen escaneada (si existe)
        imageUrl: body.imageUrl || null,

        // Estado inicial: PENDIENTE_APROBACION
        estadoAprobacion: 'PENDIENTE_APROBACION',

        // Crear gastos asociados
        gastos: {
          create: (body.gastos || []).map((gasto: any) => ({
            dia: gasto.dia || null,
            mes: gasto.mes || null,
            anio: gasto.anio || null,
            fechaGasto: gasto.fechaGasto ? new Date(gasto.fechaGasto) : null,
            motivo: gasto.motivo || null,
            origen: gasto.origen || null,
            destino: gasto.destino || null,
            montoViaje: gasto.montoViaje || 0,
            montoDia: gasto.montoDia || 0,
          })),
        },
      },
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

    // 🆕 Enviar notificación WhatsApp a aprobadores (si está activado)
    try {
      const settings = await prisma.organizationSettings.findFirst({
        where: { organizationId: session.user.organizationId },
      })

      if (
        settings?.whatsappEnabled &&
        settings?.whatsappConnected &&
        settings?.whatsappNotifyPlanillaCreated &&
        settings?.whatsappInstanceName &&
        settings?.whatsappApproverNumbers
      ) {
        console.log('📱 WhatsApp enabled - sending notification to approvers')

        const notifier = new PlanillaWhatsAppNotifier(
          settings.whatsappApiUrl || undefined,
          settings.whatsappApiKey || undefined
        )

        // Enviar a cada aprobador
        const approverNumbers = settings.whatsappApproverNumbers
          .split(',')
          .map((n: string) => n.trim())
          .filter((n: string) => n.length > 0)

        for (const approverNumber of approverNumbers) {
          try {
            await notifier.notifyPlanillaCreated({
              instanceName: settings.whatsappInstanceName,
              approverPhone: approverNumber,
              userName: planilla.user.name || planilla.user.email,
              totalAmount: planilla.totalGeneral,
              planillaId: planilla.id,
            })
            console.log(`✅ WhatsApp sent to approver: ${approverNumber}`)
          } catch (error: any) {
            console.error(`❌ Error sending WhatsApp to ${approverNumber}:`, error.message)
            // No fallar la creación de la planilla por error en WhatsApp
          }
        }
      } else {
        console.log('⚪ WhatsApp notifications disabled or not configured')
      }
    } catch (error: any) {
      console.error('❌ Error in WhatsApp notification flow:', error.message)
      // No fallar la creación de la planilla por error en WhatsApp
    }

    return NextResponse.json({
      success: true,
      message: 'Planilla de movilidad guardada exitosamente. Pendiente de aprobación.',
      planilla,
      gastosCreados: planilla.gastos.length,
    })
  } catch (error: any) {
    console.error('Post planilla movilidad error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save planilla movilidad' },
      { status: 500 }
    )
  }
}
