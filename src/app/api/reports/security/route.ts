import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as fs from 'fs'
import * as path from 'path'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo admins pueden descargar reportes de seguridad
    if (!['SUPER_ADMIN', 'ORG_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Intentar varias ubicaciones posibles
    const possiblePaths = [
      '/opt/invoice-system/REPORTE_SEGURIDAD_2024.docx',
      path.join(process.cwd(), 'REPORTE_SEGURIDAD_2024.docx'),
      path.join(process.cwd(), '..', 'REPORTE_SEGURIDAD_2024.docx'),
    ]

    let filePath = ''
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p
        break
      }
    }

    if (!filePath) {
      console.error('File not found in paths:', possiblePaths)
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(filePath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="REPORTE_SEGURIDAD_2024.docx"',
      },
    })
  } catch (error: any) {
    console.error('Error downloading report:', error)
    return NextResponse.json({ error: 'Error al descargar' }, { status: 500 })
  }
}
