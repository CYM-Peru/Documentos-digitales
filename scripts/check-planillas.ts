import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPlanillas() {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    console.log('📊 Total usuarios:', users.length)
    console.log('👥 Usuarios:')
    users.forEach((u) => {
      console.log(`  - ${u.name} (${u.email}) - ${u.role}`)
    })

    // Get all planillas
    const planillas = await prisma.movilidadPlanilla.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        aprobadoPor: {
          select: {
            name: true,
          },
        },
      },
    })

    console.log('\n📋 Total planillas:', planillas.length)

    if (planillas.length > 0) {
      console.log('\n📋 Planillas:')
      planillas.forEach((p) => {
        console.log(`  - ${p.nombresApellidos} | ${p.estadoAprobacion} | S/ ${p.totalGeneral}`)
        console.log(`    Usuario: ${p.user.name} (${p.user.email})`)
        console.log(`    Aprobado por: ${p.aprobadoPor?.name || 'N/A'}`)
        console.log(`    Fecha: ${p.createdAt}`)
        console.log(`    ID: ${p.id}`)
        console.log('')
      })
    } else {
      console.log('❌ No hay planillas en la base de datos')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPlanillas()
