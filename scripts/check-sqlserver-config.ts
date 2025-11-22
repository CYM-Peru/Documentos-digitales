import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkConfig() {
  try {
    const settings = await prisma.organizationSettings.findMany({
      select: {
        organizationId: true,
        sqlServerEnabled: true,
        sqlServerHost: true,
        sqlServerDatabase: true,
      },
    })

    console.log('📊 Configuraciones de SQL Server:')
    settings.forEach((s) => {
      console.log(`  Org: ${s.organizationId}`)
      console.log(`  Habilitado: ${s.sqlServerEnabled}`)
      console.log(`  Host: ${s.sqlServerHost ? 'Configurado' : 'NO configurado'}`)
      console.log(`  DB: ${s.sqlServerDatabase || 'NO configurada'}`)
      console.log('')
    })

    if (settings.length === 0) {
      console.log('❌ No hay configuraciones de SQL Server')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkConfig()
