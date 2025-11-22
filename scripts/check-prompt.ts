import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPrompt() {
  try {
    const settings = await prisma.organizationSettings.findFirst()

    if (!settings) {
      console.log('❌ No hay settings')
      return
    }

    console.log('🔍 Prompt configurado:')
    console.log('─'.repeat(80))
    if (settings.geminiPrompt) {
      console.log(settings.geminiPrompt.substring(0, 500) + '...')
    } else {
      console.log('⚠️ NO HAY PROMPT PERSONALIZADO - usando prompt por defecto')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPrompt()
