import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'

/**
 * GET /api/cajas-chicas - Obtiene las cajas chicas del usuario logueado
 * Query params:
 *   - soloAbiertas: "true" o "false" - Filtra solo CodEstado='00' (abiertas) o '01' (cerradas)
 *   - Si no se pasa soloAbiertas, por defecto retorna solo abiertas (true)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener parámetro de query
    const { searchParams } = new URL(request.url)
    const soloAbiertasParam = searchParams.get('soloAbiertas')
    // Si no se pasa el parámetro, por defecto es true (solo abiertas)
    // Si se pasa 'true', retorna true (solo abiertas)
    // Si se pasa 'false', retorna false (solo cerradas)
    // Si se pasa 'null', retorna null (todas)
    const soloAbiertas: boolean | null =
      soloAbiertasParam === null ? true :
      soloAbiertasParam === 'null' ? null :
      soloAbiertasParam !== 'false'

    // Modo trabajo: filtrar solo las del usuario aunque sea admin
    const modoTrabajo = searchParams.get('modoTrabajo') === 'true'

    // Filtro por usuario específico (para admins que quieren ver de otro usuario)
    const filterByUser = searchParams.get('filterByUser') || ''

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

    // Verificar si el usuario puede ver TODAS las cajas chicas
    // STAFF, SUPER_ADMIN, VERIFICADOR y APROBADOR ven todas, los demás solo las suyas
    const canViewAll = ['SUPER_ADMIN', 'STAFF', 'VERIFICADOR', 'APROBADOR'].includes(session.user.role)

    // Obtener el username del usuario desde la base de datos
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true, email: true },
    })

    // Usar el username del usuario, o extraer del email como fallback
    const username = user?.username || user?.email?.split('@')[0] || ''

    console.log('💰💰💰 [CAJAS-CHICAS API] ===== INICIO =====')
    console.log('💰 User email:', user?.email)
    console.log('💰 Username (de DB):', user?.username)
    console.log('💰 Username usado:', username)
    console.log('💰 User role:', session.user.role)
    console.log('💰 Can view all:', canViewAll)
    console.log('💰 Solo abiertas:', soloAbiertas)
    console.log('💰 Modo trabajo:', modoTrabajo)

    if (!canViewAll && !username) {
      console.log('❌ Username vacío y no puede ver todas!')
      return NextResponse.json(
        { error: 'Usuario sin username asignado' },
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

    // Determinar el filtro de usuario:
    // 1. Si hay filterByUser específico (admin filtrando por otro usuario), usar ese
    // 2. Si está en modo trabajo, filtrar por username del usuario logueado
    // 3. Si puede ver todas y NO está en modo trabajo, no filtrar
    // 4. Si no puede ver todas, siempre filtrar por su username
    let filterUsername: string | null = null
    if (filterByUser && canViewAll) {
      filterUsername = filterByUser
    } else if (modoTrabajo) {
      filterUsername = username
    } else if (!canViewAll) {
      filterUsername = username
    }
    console.log('💰 Llamando a getCajasChicasPendientes con username:', filterUsername || 'TODAS (sin filtro)')

    // Obtener cajas chicas (con filtro de estado)
    const cajasChicas = await sqlService.getCajasChicasPendientes(filterUsername, soloAbiertas)

    console.log('💰 Resultado de getCajasChicasPendientes:', JSON.stringify(cajasChicas, null, 2))
    console.log('💰 Número de cajas chicas encontradas:', cajasChicas.length)

    // Cerrar conexión
    await sqlService.close()

    console.log('💰💰💰 [CAJAS-CHICAS API] ===== FIN =====')

    return NextResponse.json({
      success: true,
      cajasChicas,
      username,
      soloAbiertas,
      modoTrabajo,
    })
  } catch (error: any) {
    console.error('Get cajas chicas error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get cajas chicas' },
      { status: 500 }
    )
  }
}
