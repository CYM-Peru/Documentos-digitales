import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

type BulkAction = 'CHANGE_ROLE' | 'CHANGE_SEDE' | 'DELETE'

interface BulkActionRequest {
  userIds: string[]
  action: BulkAction
  role?: string
  sedeId?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: BulkActionRequest = await request.json()
    const { userIds, action, role, sedeId } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un usuario' },
        { status: 400 }
      )
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Se requiere una acción' },
        { status: 400 }
      )
    }

    // No permitir acciones sobre uno mismo
    if (userIds.includes(session.user.id)) {
      return NextResponse.json(
        { error: 'No puedes realizar acciones sobre tu propia cuenta' },
        { status: 400 }
      )
    }

    // Verificar que todos los usuarios pertenecen a la misma organización
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        organizationId: session.user.organizationId,
      },
      select: { id: true, role: true },
    })

    if (users.length !== userIds.length) {
      return NextResponse.json(
        { error: 'Algunos usuarios no existen o no pertenecen a tu organización' },
        { status: 400 }
      )
    }

    // Solo SUPER_ADMIN puede modificar otros SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN') {
      const hasSuperAdmin = users.some(u => u.role === 'SUPER_ADMIN')
      if (hasSuperAdmin) {
        return NextResponse.json(
          { error: 'No tienes permisos para modificar usuarios SUPER_ADMIN' },
          { status: 403 }
        )
      }
    }

    let result = { affected: 0, message: '' }

    switch (action) {
      case 'CHANGE_ROLE':
        if (!role) {
          return NextResponse.json(
            { error: 'Se requiere especificar el rol' },
            { status: 400 }
          )
        }

        const validRoles = ['USER_L1', 'USER_L2', 'USER_L3', 'VERIFICADOR', 'APROBADOR', 'STAFF', 'ORG_ADMIN']
        if (!validRoles.includes(role)) {
          return NextResponse.json(
            { error: 'Rol inválido' },
            { status: 400 }
          )
        }

        // Solo SUPER_ADMIN puede asignar rol SUPER_ADMIN
        if (role === 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
          return NextResponse.json(
            { error: 'Solo SUPER_ADMIN puede asignar ese rol' },
            { status: 403 }
          )
        }

        // Determinar módulos según rol
        // USER_L1 y USER_L3: solo planillas (USER_L3 puede seleccionar destino)
        // USER_L2: rendiciones, cajas chicas, planillas
        // Otros roles: todo
        let modulosPermitidos: string[]
        if (role === 'USER_L1' || role === 'USER_L3') {
          modulosPermitidos = ['PLANILLAS']
        } else if (role === 'USER_L2') {
          modulosPermitidos = ['PLANILLAS', 'RENDICIONES', 'CAJAS_CHICAS']
        } else {
          modulosPermitidos = ['PLANILLAS', 'RENDICIONES', 'CAJAS_CHICAS']
        }

        const roleUpdate = await prisma.user.updateMany({
          where: {
            id: { in: userIds },
            organizationId: session.user.organizationId,
          },
          data: {
            role: role as UserRole,
            modulosPermitidos,
          },
        })
        result = { affected: roleUpdate.count, message: `Rol cambiado a ${role} para ${roleUpdate.count} usuarios` }
        break

      case 'CHANGE_SEDE':
        const sedeUpdate = await prisma.user.updateMany({
          where: {
            id: { in: userIds },
            organizationId: session.user.organizationId,
          },
          data: { sedeId: sedeId || null },
        })
        result = { affected: sedeUpdate.count, message: `Sede actualizada para ${sedeUpdate.count} usuarios` }
        break

      case 'DELETE':
        const deleteResult = await prisma.user.deleteMany({
          where: {
            id: { in: userIds },
            organizationId: session.user.organizationId,
          },
        })
        result = { affected: deleteResult.count, message: `${deleteResult.count} usuarios eliminados` }
        break

      default:
        return NextResponse.json(
          { error: 'Acción no reconocida' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error: any) {
    console.error('Bulk action error:', error)
    return NextResponse.json(
      { error: error.message || 'Error al realizar la acción' },
      { status: 500 }
    )
  }
}
