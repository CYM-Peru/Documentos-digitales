import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'

/**
 * GET /api/cajas-chicas - Obtiene las cajas chicas pendientes del usuario logueado
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
        cajasChicas: [],
        message: 'SQL Server no configurado',
      })
    }

    // Extraer el username del email (parte antes del @)
    const userEmail = session.user.email || ''
    const username = userEmail.split('@')[0]

    console.log('💰💰💰 [CAJAS-CHICAS API] ===== INICIO =====')
    console.log('💰 User email:', userEmail)
    console.log('💰 Username extraído:', username)
    console.log('💰 Session user:', JSON.stringify(session.user, null, 2))

    if (!username) {
      console.log('❌ Username vacío!')
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

    console.log('💰 Llamando a getCajasChicasPendientes con username:', username)

    // Obtener cajas chicas pendientes
    const cajasChicas = await sqlService.getCajasChicasPendientes(username)

    console.log('💰 Resultado de getCajasChicasPendientes:', JSON.stringify(cajasChicas, null, 2))
    console.log('💰 Número de cajas chicas encontradas:', cajasChicas.length)

    // Cerrar conexión
    await sqlService.close()

    console.log('💰💰💰 [CAJAS-CHICAS API] ===== FIN =====')

    return NextResponse.json({
      success: true,
      cajasChicas,
      username,
    })
  } catch (error: any) {
    console.error('Get cajas chicas error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get cajas chicas' },
      { status: 500 }
    )
  }
}
