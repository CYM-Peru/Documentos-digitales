import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { toTitleCase, formatEmail, formatUsername } from '@/lib/utils/formatters'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        sedeId: true,
        modulosPermitidos: true,
        sede: {
          select: {
            id: true,
            nombre: true,
            codigo: true,
          }
        },
        createdAt: true,
        _count: {
          select: { invoices: true }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, password, role, username, sedeId } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Check if username already exists
    if (username) {
      const existingUsername = await prisma.user.findUnique({
        where: { username: username.toUpperCase() },
      })
      if (existingUsername) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        )
      }
    }

    const hashedPassword = await hash(password, 10)

    // Formatear nombre a Title Case y email a minúsculas
    const formattedName = toTitleCase(name)
    const formattedEmail = formatEmail(email)
    const formattedUsername = username ? formatUsername(username) : null

    // Determinar módulos según rol
    // USER_L1: solo planillas
    // USER_L2 y USER_L3: rendiciones, cajas chicas, planillas
    // Otros roles: todo
    const getModulosPermitidos = (userRole: string) => {
      if (userRole === 'USER_L1') return ['PLANILLAS']
      if (userRole === 'USER_L2' || userRole === 'USER_L3') return ['PLANILLAS', 'RENDICIONES', 'CAJAS_CHICAS']
      return ['PLANILLAS', 'RENDICIONES', 'CAJAS_CHICAS']
    }
    const modulosPermitidos = getModulosPermitidos(role || 'USER_L1')

    const user = await prisma.user.create({
      data: {
        name: formattedName,
        email: formattedEmail,
        username: formattedUsername,
        passwordHash: hashedPassword,
        role: role || 'USER_L1',
        sedeId: sedeId || null,
        modulosPermitidos,
        organizationId: session.user.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        sedeId: true,
        sede: {
          select: { nombre: true }
        },
        createdAt: true,
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error: any) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, role } = await request.json()

    if (!id || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
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

    // Only SUPER_ADMIN can create other SUPER_ADMINs
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
      select: { organizationId: true },
    })

    if (!existingUser || existingUser.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: 'User not found or unauthorized' },
        { status: 404 }
      )
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
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

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Don't allow deleting yourself
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    )
  }
}
