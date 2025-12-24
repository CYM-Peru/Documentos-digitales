import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { toTitleCase, formatEmail, formatUsername } from '@/lib/utils/formatters'

interface CSVUser {
  nombre: string
  email: string
  username?: string
  rol?: string
  sede?: string
  password?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user || (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { users } = await request.json() as { users: CSVUser[] }

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de usuarios' },
        { status: 400 }
      )
    }

    // Obtener sedes para mapear por nombre o código
    const sedes = await prisma.sede.findMany()
    const sedeMap = new Map<string, string>()
    sedes.forEach(s => {
      sedeMap.set(s.nombre.toLowerCase(), s.id)
      sedeMap.set(s.codigo.toLowerCase(), s.id)
    })

    const results = {
      created: 0,
      errors: [] as string[],
      skipped: 0,
    }

    const validRoles = ['USER_L1', 'USER_L2', 'USER_L3', 'VERIFICADOR', 'APROBADOR', 'STAFF', 'ORG_ADMIN']
    const defaultPassword = 'Azaleia2025'

    for (const csvUser of users) {
      try {
        // Validar campos requeridos
        if (!csvUser.nombre || !csvUser.email) {
          results.errors.push(`Fila inválida: nombre o email vacío`)
          continue
        }

        // Verificar si email ya existe
        const existingEmail = await prisma.user.findUnique({
          where: { email: csvUser.email.toLowerCase().trim() },
        })

        if (existingEmail) {
          results.skipped++
          continue
        }

        // Verificar si username ya existe
        if (csvUser.username) {
          const existingUsername = await prisma.user.findUnique({
            where: { username: csvUser.username.toUpperCase().trim() },
          })
          if (existingUsername) {
            results.errors.push(`Username ${csvUser.username} ya existe`)
            continue
          }
        }

        // Determinar rol
        let role: 'USER_L1' | 'USER_L2' | 'USER_L3' | 'VERIFICADOR' | 'APROBADOR' | 'STAFF' | 'ORG_ADMIN' = 'USER_L1'
        if (csvUser.rol) {
          const rolUpper = csvUser.rol.toUpperCase().trim()
          if (rolUpper === 'USER_L2' || rolUpper === 'L2') role = 'USER_L2'
          else if (rolUpper === 'USER_L3' || rolUpper === 'L3' || rolUpper === 'ASESOR_L3') role = 'USER_L3'
          else if (rolUpper === 'VERIFICADOR') role = 'VERIFICADOR'
          else if (rolUpper === 'APROBADOR') role = 'APROBADOR'
          else if (rolUpper === 'STAFF') role = 'STAFF'
          else if (rolUpper === 'ADMIN' || rolUpper === 'ORG_ADMIN') role = 'ORG_ADMIN'
        }

        // Determinar sede
        let sedeId: string | null = null
        if (csvUser.sede) {
          sedeId = sedeMap.get(csvUser.sede.toLowerCase().trim()) || null
        }

        // Determinar módulos según rol
        // USER_L1 y USER_L3: solo planillas (USER_L3 puede seleccionar destino)
        // USER_L2: rendiciones, cajas chicas, planillas
        // Otros roles: todo
        let modulosPermitidos: string[]
        if (role === 'USER_L1' || role === 'USER_L3') {
          modulosPermitidos = ['PLANILLAS']
        } else {
          modulosPermitidos = ['PLANILLAS', 'RENDICIONES', 'CAJAS_CHICAS']
        }

        // Crear usuario con nombres formateados
        const hashedPassword = await hash(csvUser.password || defaultPassword, 10)

        await prisma.user.create({
          data: {
            name: toTitleCase(csvUser.nombre),
            email: formatEmail(csvUser.email),
            username: csvUser.username ? formatUsername(csvUser.username) : null,
            passwordHash: hashedPassword,
            role,
            sedeId,
            modulosPermitidos,
            organizationId: session.user.organizationId,
          },
        })

        results.created++
      } catch (error: any) {
        results.errors.push(`Error con ${csvUser.email}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Se crearon ${results.created} usuarios`,
      created: results.created,
      skipped: results.skipped,
      errors: results.errors,
    })
  } catch (error: any) {
    console.error('Bulk create users error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create users' },
      { status: 500 }
    )
  }
}
