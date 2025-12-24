import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/planillas-movilidad/aprobadas-sin-asociar
 * Obtiene las planillas aprobadas que NO tienen caja chica asignada
 * Para que el VERIFICADOR pueda asociarlas
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo VERIFICADOR y SUPER_ADMIN pueden ver esto
    const canAccess = ['VERIFICADOR', 'SUPER_ADMIN'].includes(session.user.role)
    if (!canAccess) {
      return NextResponse.json(
        { error: 'No tienes permisos para esta operación' },
        { status: 403 }
      )
    }

    // Obtener planillas aprobadas sin caja chica asignada
    const planillas = await prisma.movilidadPlanilla.findMany({
      where: {
        organizationId: session.user.organizationId,
        estadoAprobacion: 'APROBADA',
        nroCajaChica: null, // Sin caja chica asignada
      },
      include: {
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
      orderBy: {
        aprobadoEn: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      planillas,
      total: planillas.length,
    })
  } catch (error: any) {
    console.error('Error getting aprobadas sin asociar:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get planillas' },
      { status: 500 }
    )
  }
}
