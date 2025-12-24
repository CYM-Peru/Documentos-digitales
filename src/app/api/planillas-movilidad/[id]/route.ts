import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * GET /api/planillas-movilidad/[id]
 * Obtiene una planilla de movilidad por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const planilla = await prisma.movilidadPlanilla.findUnique({
      where: { id: params.id },
      include: {
        gastos: {
          orderBy: {
            fechaGasto: 'asc',
          },
        },
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
      return NextResponse.json({ error: 'Planilla not found' }, { status: 404 })
    }

    // Verificar que pertenece a la misma organización
    if (planilla.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      planilla,
    })
  } catch (error: any) {
    console.error('Get planilla error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get planilla' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/planillas-movilidad/[id]
 * Edita una planilla rechazada
 */
export async function PUT(
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

    const planilla = await prisma.movilidadPlanilla.findUnique({
      where: { id },
      include: { gastos: true },
    })

    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 })
    }

    // SUPER_ADMIN, VERIFICADOR y STAFF pueden editar cualquier planilla
    // El creador solo puede editar sus propias planillas rechazadas
    const canEditAny = ['SUPER_ADMIN', 'VERIFICADOR', 'STAFF', 'ORG_ADMIN'].includes(session.user.role)
    const isCreator = planilla.userId === session.user.id

    if (!canEditAny && !isCreator) {
      return NextResponse.json({ error: 'No tienes permisos para editar esta planilla' }, { status: 403 })
    }

    // Los usuarios normales solo pueden editar planillas rechazadas
    // Los admins/verificadores pueden editar planillas pendientes o rechazadas
    const editableStates = canEditAny
      ? ['RECHAZADA', 'PENDIENTE_APROBACION']
      : ['RECHAZADA']

    if (!editableStates.includes(planilla.estadoAprobacion)) {
      return NextResponse.json({
        error: canEditAny
          ? 'Solo se pueden editar planillas pendientes o rechazadas'
          : 'Solo se pueden editar planillas rechazadas'
      }, { status: 400 })
    }

    // Convertir cadenas vacías a null para campos opcionales
    const { nroPlanilla, razonSocial, ruc, periodo, fechaEmision, nombresApellidos, cargo, dni, centroCosto, gastos } = body
    const cleanedData = {
      nroPlanilla: nroPlanilla?.trim() || null,
      razonSocial: razonSocial?.trim() || null,
      ruc: ruc?.trim() || null,
      periodo: periodo?.trim() || null,
      fechaEmision: fechaEmision?.trim() || null,
      nombresApellidos: nombresApellidos?.trim() || '',
      cargo: cargo?.trim() || '',
      dni: dni?.trim() || '',
      centroCosto: centroCosto?.trim() || null,
    }

    const planillaActualizada = await prisma.$transaction(async (tx) => {
      await tx.movilidadGasto.deleteMany({ where: { planillaId: id } })

      let totalViaje = 0
      let totalDia = 0

      if (gastos && gastos.length > 0) {
        totalViaje = gastos.reduce((sum: number, g: any) => sum + (g.montoViaje || 0), 0)
        totalDia = gastos.reduce((sum: number, g: any) => sum + (g.montoDia || 0), 0)
      }

      const totalGeneral = totalViaje + totalDia

      return await tx.movilidadPlanilla.update({
        where: { id },
        data: {
          nroPlanilla: cleanedData.nroPlanilla,
          razonSocial: cleanedData.razonSocial,
          ruc: cleanedData.ruc,
          periodo: cleanedData.periodo,
          fechaEmision: cleanedData.fechaEmision ? new Date(cleanedData.fechaEmision) : null,
          nombresApellidos: cleanedData.nombresApellidos,
          cargo: cleanedData.cargo,
          dni: cleanedData.dni,
          centroCosto: cleanedData.centroCosto,
          totalViaje, totalDia, totalGeneral,
          estadoAprobacion: 'PENDIENTE_APROBACION',
          aprobadoPorId: null,
          aprobadoEn: null,
          comentariosAprobacion: null,
          camposConError: Prisma.JsonNull,
          gastos: {
            create: gastos.map((g: any) => ({
              fechaGasto: new Date(g.fechaGasto),
              motivo: g.motivo || null,
              origen: g.origen || null,
              destino: g.destino || null,
              montoViaje: g.montoViaje || 0,
              montoDia: 0,
              dia: new Date(g.fechaGasto).getDate().toString(),
              mes: (new Date(g.fechaGasto).getMonth() + 1).toString(),
              anio: new Date(g.fechaGasto).getFullYear().toString(),
            })),
          },
        },
        include: {
          gastos: { orderBy: { fechaGasto: 'asc' } },
          user: { select: { name: true, email: true } },
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Planilla actualizada. Ahora está pendiente de aprobación.',
      planilla: planillaActualizada,
    })
  } catch (error: any) {
    console.error('Update planilla error:', error)
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 })
  }
}

/**
 * DELETE /api/planillas-movilidad/[id]
 * Elimina una planilla de movilidad
 * Solo SUPER_ADMIN y STAFF pueden eliminar
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo SUPER_ADMIN y STAFF pueden eliminar planillas
    const canDelete = ['SUPER_ADMIN', 'STAFF'].includes(session.user.role)
    if (!canDelete) {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar planillas' },
        { status: 403 }
      )
    }

    const { id } = params

    // Verificar que la planilla existe y pertenece a la organización
    const planilla = await prisma.movilidadPlanilla.findUnique({
      where: { id },
      include: { gastos: true },
    })

    if (!planilla) {
      return NextResponse.json({ error: 'Planilla no encontrada' }, { status: 404 })
    }

    if (planilla.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Eliminar planilla (los gastos se eliminan en cascada por la relación)
    await prisma.movilidadPlanilla.delete({
      where: { id },
    })

    console.log(`🗑️ Planilla ${planilla.nroPlanilla || id} eliminada por ${session.user.email}`)

    return NextResponse.json({
      success: true,
      message: `Planilla ${planilla.nroPlanilla || ''} eliminada correctamente`,
    })
  } catch (error: any) {
    console.error('Delete planilla error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete planilla' },
      { status: 500 }
    )
  }
}
