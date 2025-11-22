import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/planillas-movilidad/pendientes
 * Obtiene todas las planillas de movilidad de la organización
 * Solo accesible por usuarios con rol APROBADOR
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar que el usuario tiene permisos para ver planillas
    const allowedRoles = ['APROBADOR', 'SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN', 'SUPERVISOR']
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver esta información' },
        { status: 403 }
      )
    }

    // Obtener todas las planillas de la organización
    const planillas = await prisma.movilidadPlanilla.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
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
      orderBy: [
        {
          estadoAprobacion: 'asc', // Pendientes primero
        },
        {
          createdAt: 'desc',
        },
      ],
    })

    return NextResponse.json({
      success: true,
      planillas,
      total: planillas.length,
      pendientes: planillas.filter((p) => p.estadoAprobacion === 'PENDIENTE_APROBACION')
        .length,
      aprobadas: planillas.filter((p) => p.estadoAprobacion === 'APROBADA').length,
      rechazadas: planillas.filter((p) => p.estadoAprobacion === 'RECHAZADA').length,
    })
  } catch (error: any) {
    console.error('Get planillas pendientes error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get planillas pendientes' },
      { status: 500 }
    )
  }
}
