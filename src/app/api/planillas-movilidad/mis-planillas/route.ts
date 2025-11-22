import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/planillas-movilidad/mis-planillas
 * Obtiene las planillas del usuario actual con contadores por estado
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener planillas del usuario
    const planillas = await prisma.movilidadPlanilla.findMany({
      where: {
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        nombresApellidos: true,
        estadoAprobacion: true,
        totalGeneral: true,
        createdAt: true,
        updatedAt: true,
        comentariosAprobacion: true,
        aprobadoPor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    // Contar por estado
    const pendientes = planillas.filter((p) => p.estadoAprobacion === 'PENDIENTE_APROBACION').length
    const aprobadas = planillas.filter((p) => p.estadoAprobacion === 'APROBADA').length
    const rechazadas = planillas.filter((p) => p.estadoAprobacion === 'RECHAZADA').length

    return NextResponse.json({
      success: true,
      planillas,
      contadores: {
        total: planillas.length,
        pendientes,
        aprobadas,
        rechazadas,
      },
    })
  } catch (error: any) {
    console.error('Get mis planillas error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get mis planillas' },
      { status: 500 }
    )
  }
}
