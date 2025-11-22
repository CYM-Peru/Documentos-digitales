import { prisma } from '../src/lib/prisma'
import { decrypt } from '../src/lib/encryption'

async function check() {
  const settings = await prisma.organizationSettings.findFirst({
    where: { organization: { slug: 'azaleia' } }
  })
  
  console.log('SQL Server Config:')
  console.log('Enabled:', settings?.sqlServerEnabled)
  console.log('Host (encrypted length):', settings?.sqlServerHost?.length || 0)
  console.log('Host (decrypted):', settings?.sqlServerHost ? decrypt(settings.sqlServerHost) : 'NULL')
  console.log('Database:', settings?.sqlServerDatabase)
  console.log('Port:', settings?.sqlServerPort)
  console.log('User (decrypted):', settings?.sqlServerUser ? decrypt(settings.sqlServerUser) : 'NULL')
  
  await prisma.$disconnect()
}
check()
