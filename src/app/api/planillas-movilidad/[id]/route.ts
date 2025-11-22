import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
