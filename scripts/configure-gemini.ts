import { PrismaClient } from '@prisma/client'
import { encrypt } from './src/lib/encryption'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

async function main() {
  console.log('\n🤖 ===== CONFIGURACIÓN DE GEMINI VISION AI =====\n')
  console.log('Para obtener tu API key:')
  console.log('1. Ve a: https://aistudio.google.com/app/apikey')
  console.log('2. Crea un nuevo API key')
  console.log('3. Cópialo y pégalo aquí\n')

  const apiKey = await question('Ingresa tu Gemini API Key: ')

  if (!apiKey || apiKey.trim().length === 0) {
    console.log('❌ API Key no válida')
    rl.close()
    return
  }

  console.log('\n🔐 Encriptando API key...')
  const encryptedApiKey = encrypt(apiKey.trim())

  console.log('💾 Guardando en base de datos...')

  const settings = await prisma.organizationSettings.findFirst()

  if (!settings) {
    console.log('❌ No se encontró configuración de organización')
    rl.close()
    return
  }

  await prisma.organizationSettings.update({
    where: { id: settings.id },
    data: {
      geminiApiKey: encryptedApiKey,
      ocrProvider: 'GEMINI_VISION',
    },
  })

  console.log('\n✅ ¡Gemini Vision AI configurado exitosamente!')
  console.log('🚀 Ahora las facturas se procesarán con IA REAL\n')

  rl.close()
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
