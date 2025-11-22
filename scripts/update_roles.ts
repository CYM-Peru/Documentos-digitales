import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Buscar Amanda y Junior
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['aarroyo@azaleia.com.pe', 'ajuribe@azaleia.com.pe']
      }
    }
  })

  console.log('Usuarios encontrados:', users)

  // Actualizar sus roles a USER
  for (const user of users) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'USER' }
    })
    console.log(`✅ ${updated.email} actualizado a rol USER`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
