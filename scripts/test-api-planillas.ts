import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAPI() {
  try {
    // Simulate what the API does for user "admin@azaleia.com.pe"
    const user = await prisma.user.findUnique({
      where: { email: 'admin@azaleia.com.pe' },
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log('👤 User:', user.name, '(', user.id, ')')
    console.log('🏢 Organization:', user.organizationId)

    // Simulate the API query
    const planillas = await prisma.movilidadPlanilla.findMany({
      where: {
        userId: user.id,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        nombresApellidos: true,
        estadoAprobacion: true,
        totalGeneral: true,
        createdAt: true,
        updatedAt: true,
        comentariosAprobacion: true,
        aprobadoPor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    console.log('\n📋 Planillas encontradas:', planillas.length)

    if (planillas.length > 0) {
      console.log('\n📊 Detalles:')
      planillas.forEach((p) => {
        console.log('  -', p.nombresApellidos)
        console.log('    Estado:', p.estadoAprobacion)
        console.log('    Total:', p.totalGeneral)
        console.log('    Aprobado por:', p.aprobadoPor?.name || 'N/A')
        console.log('    Comentarios:', p.comentariosAprobacion || 'N/A')
        console.log('')
      })

      const pendientes = planillas.filter((p) => p.estadoAprobacion === 'PENDIENTE_APROBACION').length
      const aprobadas = planillas.filter((p) => p.estadoAprobacion === 'APROBADA').length
      const rechazadas = planillas.filter((p) => p.estadoAprobacion === 'RECHAZADA').length

      console.log('📊 Contadores:')
      console.log('  Total:', planillas.length)
      console.log('  Pendientes:', pendientes)
      console.log('  Aprobadas:', aprobadas)
      console.log('  Rechazadas:', rechazadas)

      // Simulate API response
      const response = {
        success: true,
        planillas,
        contadores: {
          total: planillas.length,
          pendientes,
          aprobadas,
          rechazadas,
        },
      }

      console.log('\n📤 API Response:')
      console.log(JSON.stringify(response, null, 2))
    } else {
      console.log('❌ No se encontraron planillas para este usuario')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAPI()
