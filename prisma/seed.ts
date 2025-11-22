import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create initial organization
  const org = await prisma.organization.upsert({
    where: { slug: 'azaleia' },
    update: {},
    create: {
      name: 'Azaleia',
      slug: 'azaleia',
      active: true,
    },
  })

  console.log('✅ Organization created:', org.name)

  // Create super admin user
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@azaleia.com.pe'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'admin123'
  const passwordHash = await bcrypt.hash(password, 10)

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'SUPER_ADMIN',
    },
    create: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      organizationId: org.id,
      active: true,
    },
  })

  console.log('✅ Super Admin created:', admin.email)

  // Create organization settings
  const settings = await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      ocrProvider: 'AWS_TEXTRACT',
    },
  })

  console.log('✅ Organization settings created')

  console.log('\n🎉 Seed completed!')
  console.log('\n📝 Login credentials:')
  console.log('   Email:', email)
  console.log('   Password:', password)
  console.log('\n🔗 Access: https://cockpit.azaleia.com.pe')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
