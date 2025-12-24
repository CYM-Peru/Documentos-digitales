import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { toTitleCase, formatEmail, formatUsername } from '@/lib/utils/formatters'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { name, email, username, role, sedeId, active } = await request.json()

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['USER_L1', 'USER_L2', 'USER_L3', 'VERIFICADOR', 'APROBADOR', 'STAFF', 'ORG_ADMIN', 'SUPER_ADMIN']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Only SUPER_ADMIN can assign SUPER_ADMIN role
    if (role === 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only Super Admins can assign Super Admin role' },
        { status: 403 }
      )
    }

    // Don't allow changing your own role
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      )
    }

    // Verify user belongs to same organization
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        organizationId: true,
        email: true,
        username: true,
      },
    })

    if (!existingUser || existingUser.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: 'User not found or unauthorized' },
        { status: 404 }
      )
    }

    // Check if email is being changed and if it already exists
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: formatEmail(email) },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    // Check if username is being changed and if it already exists
    if (username && username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username: formatUsername(username) },
      })
      if (usernameExists) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        )
      }
    }

    // Format data
    const formattedName = toTitleCase(name)
    const formattedEmail = formatEmail(email)
    const formattedUsername = username ? formatUsername(username) : null

    // Determinar módulos según rol
    const getModulosPermitidos = (userRole: string) => {
      if (userRole === 'USER_L1') return ['PLANILLAS']
      if (userRole === 'USER_L2' || userRole === 'USER_L3') return ['PLANILLAS', 'RENDICIONES', 'CAJAS_CHICAS']
      return ['PLANILLAS', 'RENDICIONES', 'CAJAS_CHICAS']
    }
    const modulosPermitidos = getModulosPermitidos(role)

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: {
        name: formattedName,
        email: formattedEmail,
        username: formattedUsername,
        role,
        sedeId: sedeId || null,
        active: active !== undefined ? active : true,
        modulosPermitidos,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        sedeId: true,
        active: true,
        sede: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          }
        },
        createdAt: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}
