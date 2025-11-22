import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'

/**
 * GET /api/rendiciones - Obtiene las rendiciones pendientes del usuario logueado
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener configuración de SQL Server
    const settings = await prisma.organizationSettings.findFirst({
      where: {
        organizationId: session.user.organizationId,
        sqlServerEnabled: true,
      },
    })

    if (!settings?.sqlServerHost) {
      return NextResponse.json({
        rendiciones: [],
        message: 'SQL Server no configurado',
      })
    }

    // Extraer el username del email (parte antes del @)
    const userEmail = session.user.email || ''
    const username = userEmail.split('@')[0]

    if (!username) {
      return NextResponse.json(
        { error: 'Email de usuario inválido' },
        { status: 400 }
      )
    }

    // Conectar a SQL Server
    const sqlService = new SqlServerService({
      server: decrypt(settings.sqlServerHost),
      database: settings.sqlServerDatabase!,
      user: decrypt(settings.sqlServerUser!),
      password: decrypt(settings.sqlServerPassword!),
      port: settings.sqlServerPort || 1433,
      encrypt: settings.sqlServerEncrypt,
      trustServerCertificate: settings.sqlServerTrustCert,
    })

    // Obtener rendiciones pendientes
    const rendiciones = await sqlService.getRendicionesPendientes(username)

    // Cerrar conexión
    await sqlService.close()

    return NextResponse.json({
      success: true,
      rendiciones,
      username,
    })
  } catch (error: any) {
    console.error('Get rendiciones error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get rendiciones' },
      { status: 500 }
    )
  }
}
