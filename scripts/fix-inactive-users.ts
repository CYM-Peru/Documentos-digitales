import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixInactiveUsers() {
  try {
    console.log('Checking for users with active = false or null...')

    // Find users that are not active
    const inactiveUsers = await prisma.user.findMany({
      where: {
        active: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true
      }
    })

    console.log(`Found ${inactiveUsers.length} inactive users:`)
    inactiveUsers.forEach(user => {
      console.log(`- ${user.email} (${user.name}) - active: ${user.active} - created: ${user.createdAt}`)
    })

    if (inactiveUsers.length > 0) {
      console.log('\nActivating all users...')

      const result = await prisma.user.updateMany({
        where: {
          active: false
        },
        data: {
          active: true
        }
      })

      console.log(`\nActivated ${result.count} users successfully!`)
    } else {
      console.log('\nAll users are already active!')
    }

    // Verify all users are now active
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        passwordHash: true
      }
    })

    console.log(`\nTotal users in database: ${allUsers.length}`)
    const usersWithPasswords = allUsers.filter(u => u.passwordHash)
    const activeUsers = allUsers.filter(u => u.active)

    console.log(`Users with passwords: ${usersWithPasswords.length}`)
    console.log(`Active users: ${activeUsers.length}`)

    if (allUsers.length !== activeUsers.length) {
      console.log('\nWARNING: Some users are still inactive!')
      allUsers.filter(u => !u.active).forEach(u => {
        console.log(`  - ${u.email} (${u.name})`)
      })
    }

  } catch (error) {
    console.error('Error fixing users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixInactiveUsers()
