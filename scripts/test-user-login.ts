import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function testUserLogin() {
  try {
    const testEmail = `test.user.${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'

    console.log('1. Creating test user...')
    console.log(`   Email: ${testEmail}`)
    console.log(`   Password: ${testPassword}`)

    // Get an organization to use
    const org = await prisma.organization.findFirst()
    if (!org) {
      console.error('No organization found! Cannot create test user.')
      return
    }

    console.log(`   Organization: ${org.name}`)

    // Hash password (simulating what the API does)
    const hashedPassword = await bcrypt.hash(testPassword, 10)
    console.log(`   Password hashed: ${hashedPassword.substring(0, 20)}...`)

    // Create user (simulating the API endpoint)
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: testEmail,
        passwordHash: hashedPassword,
        role: 'USER_L1',
        organizationId: org.id,
        active: true, // CRITICAL: This must be set to true!
        modulosPermitidos: ['PLANILLAS']
      }
    })

    console.log('\n2. User created successfully!')
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Active: ${user.active}`)
    console.log(`   Has Password: ${user.passwordHash ? 'YES' : 'NO'}`)

    // Now simulate the login process (what auth.ts does)
    console.log('\n3. Simulating login...')

    const foundUser = await prisma.user.findUnique({
      where: { email: testEmail },
      include: { organization: true }
    })

    if (!foundUser) {
      console.error('   ERROR: User not found!')
      return
    }

    console.log('   User found in database')
    console.log(`   Password hash exists: ${foundUser.passwordHash ? 'YES' : 'NO'}`)
    console.log(`   User active: ${foundUser.active}`)

    // Check the validation that auth.ts does
    if (!foundUser || !foundUser.passwordHash || !foundUser.active) {
      console.error('   ERROR: Validation failed!')
      console.error(`   - User exists: ${!!foundUser}`)
      console.error(`   - Has password: ${!!foundUser?.passwordHash}`)
      console.error(`   - Is active: ${!!foundUser?.active}`)
      return
    }

    console.log('   Validation passed!')

    // Verify password
    const isValid = await bcrypt.compare(testPassword, foundUser.passwordHash)

    if (!isValid) {
      console.error('   ERROR: Password comparison failed!')
      return
    }

    console.log('   Password comparison successful!')

    console.log('\n4. LOGIN SUCCESSFUL!')
    console.log('   User would be authenticated and receive a session.')

    // Clean up
    console.log('\n5. Cleaning up test user...')
    await prisma.user.delete({
      where: { id: user.id }
    })
    console.log('   Test user deleted.')

    console.log('\n======================================')
    console.log('TEST PASSED: New users CAN login!')
    console.log('======================================')

  } catch (error) {
    console.error('\nERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testUserLogin()
