import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GastoReparableCorrelativoService } from '@/services/gasto-reparable-correlativo'
import { PlanillaEmailService } from '@/services/planilla-email'

/**
 * GET /api/gastos-reparables - Obtiene las planillas de gastos reparables del usuario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Determinar qué planillas mostrar según el rol
    // SUPER_ADMIN, VERIFICADOR, STAFF, ORG_ADMIN, ADMIN y APROBADOR ven TODAS las planillas de la organización
    // USER_L1, USER_L2, USER_L3 solo ven sus propias planillas
    const canViewAll = ['SUPER_ADMIN', 'VERIFICADOR', 'STAFF', 'ORG_ADMIN', 'ADMIN', 'APROBADOR'].includes(session.user.role)

    const whereClause: any = {
      organizationId: session.user.organizationId,
    }

    // Si NO puede ver todas, filtrar solo sus planillas
    if (!canViewAll) {
      whereClause.userId = session.user.id
    }

    // Obtener planillas desde PostgreSQL
    const planillas = await prisma.gastoReparablePlanilla.findMany({
      where: whereClause,
      include: {
        items: true,
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
    console.error('Get gastos reparables error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get gastos reparables' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gastos-reparables - Crea una nueva planilla de gastos reparables
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

    // Generar correlativo único (formato: "100001", "100002", etc.)
    // Este proceso es atómico y garantiza números únicos incluso con usuarios simultáneos
    const correlativo = await GastoReparableCorrelativoService.obtenerSiguienteCorrelativo()
    console.log(`📋 Correlativo asignado: ${correlativo}`)

    // Crear planilla en PostgreSQL con estado PENDIENTE_APROBACION
    const planilla = await prisma.gastoReparablePlanilla.create({
      data: {
        organizationId: session.user.organizationId,
        userId: session.user.id,

        // Datos de la planilla - Usar correlativo generado
        nroPlanilla: correlativo,
        razonSocial: body.razonSocial || 'CALZADOS AZALEIA PERU S.A.',
        ruc: body.ruc || '20374412524',
        periodo: body.periodo || null,
        fechaEmision: body.fechaEmision ? new Date(body.fechaEmision) : null,

        // Datos del trabajador
        nombresApellidos: body.nombresApellidos,
        cargo: body.cargo,
        dni: body.dni,
        centroCosto: body.centroCosto || null,

        // Total
        totalGeneral: body.totalGeneral || 0,

        // Tipo de operación
        tipoOperacion: body.tipoOperacion || null,
        nroRendicion: body.nroRendicion || null,
        nroCajaChica: body.nroCajaChica || null,

        // Imagen escaneada (si existe)
        imageUrl: body.imageUrl || null,

        // Estado inicial: PENDIENTE_APROBACION
        estadoAprobacion: 'PENDIENTE_APROBACION',

        // Crear items asociados
        items: {
          create: (body.items || []).map((item: any) => ({
            dia: item.dia || null,
            mes: item.mes || null,
            anio: item.anio || null,
            fechaGasto: item.fechaGasto ? new Date(item.fechaGasto) : null,
            tipoDoc: item.tipoDoc || null,
            concepto: item.concepto || null,
            tipoGasto: item.tipoGasto || null,
            importe: item.importe || 0,
          })),
        },
      },
      include: {
        items: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Enviar notificación por EMAIL a los aprobadores
    try {
      const emailService = new PlanillaEmailService()

      await emailService.notifyNewGastoReparable({
        planillaId: planilla.id,
        nroPlanilla: correlativo,
        userName: planilla.user?.name || body.nombresApellidos || 'Usuario',
        userEmail: planilla.user?.email || undefined,
        totalAmount: body.totalGeneral || 0,
        itemCount: planilla.items.length,
        createdAt: planilla.createdAt
      })

      console.log(`✅ Notificación por email enviada a aprobadores`)
    } catch (notifyError: any) {
      // No fallar si la notificación falla, solo loguear
      console.error('⚠️ Error enviando notificación por email:', notifyError.message)
    }

    return NextResponse.json({
      success: true,
      message: `Planilla ${correlativo} guardada exitosamente. Pendiente de aprobación.`,
      planilla,
      correlativo,
      itemsCreados: planilla.items.length,
    })
  } catch (error: any) {
    console.error('Post gasto reparable error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save gasto reparable' },
      { status: 500 }
    )
  }
}
