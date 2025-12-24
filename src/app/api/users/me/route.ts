import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/users/me
 * Obtiene la información del usuario autenticado incluyendo su sede
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        phone: true,
        dni: true,
        cargo: true,
        sede: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
            codLocal: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user,
    })
  } catch (error: any) {
    console.error('Error getting user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get user' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/me
 * Actualiza dni y cargo del usuario autenticado
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dni, cargo } = body

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(dni !== undefined && { dni }),
        ...(cargo !== undefined && { cargo }),
      },
      select: {
        id: true,
        dni: true,
        cargo: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}
