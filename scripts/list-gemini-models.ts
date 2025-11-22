import { PrismaClient } from '@prisma/client'
import { decrypt } from './src/lib/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

const prisma = new PrismaClient()

async function listModels() {
  try {
    console.log('\n📋 Listando modelos disponibles de Gemini...\n')

    const settings = await prisma.organizationSettings.findFirst()
    const apiKey = decrypt(settings!.geminiApiKey!)

    const genAI = new GoogleGenerativeAI(apiKey)

    // Probar con diferentes modelos
    const modelsToTry = [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-2.0-flash-exp'
    ]

    for (const modelName of modelsToTry) {
      try {
        console.log(`Probando modelo: ${modelName}...`)
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent('Di hola')
        const response = await result.response
        console.log(`✅ ${modelName} - FUNCIONA`)
        console.log(`   Respuesta: ${response.text()}\n`)
      } catch (error: any) {
        console.log(`❌ ${modelName} - No disponible\n`)
      }
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

listModels()
