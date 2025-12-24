import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sedes = await prisma.sede.findMany({
      where: { activa: true },
      select: {
        id: true,
        nombre: true,
        codigo: true,
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({ sedes })
  } catch (error: any) {
    console.error('Get sedes error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get sedes' },
      { status: 500 }
    )
  }
}
