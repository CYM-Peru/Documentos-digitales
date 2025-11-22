import { PrismaClient } from '@prisma/client'
import { decrypt } from './src/lib/encryption'
import { GoogleGenerativeAI } from '@google/generative-ai'

const prisma = new PrismaClient()

async function testGemini() {
  try {
    console.log('\n🧪 ===== PRUEBA DE CONEXIÓN GEMINI AI =====\n')

    // 1. Obtener API key de la base de datos
    console.log('1️⃣ Obteniendo configuración de la base de datos...')
    const settings = await prisma.organizationSettings.findFirst()

    if (!settings) {
      console.log('❌ No se encontró configuración')
      return
    }

    if (!settings.geminiApiKey) {
      console.log('❌ No hay API key de Gemini configurada')
      return
    }

    console.log('✅ API key encontrada en base de datos')

    // 2. Desencriptar API key
    console.log('\n2️⃣ Desencriptando API key...')
    const apiKey = decrypt(settings.geminiApiKey)
    console.log('✅ API key desencriptada exitosamente')
    console.log(`   Primeros 10 caracteres: ${apiKey.substring(0, 10)}...`)

    // 3. Crear cliente de Gemini
    console.log('\n3️⃣ Inicializando cliente de Gemini...')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
    console.log('✅ Cliente de Gemini inicializado')

    // 4. Hacer una prueba simple de texto
    console.log('\n4️⃣ Probando conexión con Gemini (pregunta simple)...')
    const result = await model.generateContent('Di "Hola, estoy funcionando correctamente" en español')
    const response = await result.response
    const text = response.text()

    console.log('✅ Respuesta de Gemini recibida:')
    console.log(`   "${text}"`)

    // 5. Verificar configuración del provider
    console.log('\n5️⃣ Verificando configuración del provider...')
    console.log(`   Provider actual: ${settings.ocrProvider}`)

    if (settings.ocrProvider === 'GEMINI_VISION') {
      console.log('✅ Provider configurado correctamente como GEMINI_VISION')
    } else {
      console.log('⚠️  Provider no está configurado como GEMINI_VISION')
      console.log('   Actualizando...')
      await prisma.organizationSettings.update({
        where: { id: settings.id },
        data: { ocrProvider: 'GEMINI_VISION' }
      })
      console.log('✅ Provider actualizado a GEMINI_VISION')
    }

    // 6. Resumen
    console.log('\n📊 ===== RESUMEN =====')
    console.log('✅ Base de datos: OK')
    console.log('✅ API key: OK')
    console.log('✅ Conexión Gemini: OK')
    console.log('✅ Respuesta de IA: OK')
    console.log('✅ Provider: GEMINI_VISION')
    console.log('\n🎉 ¡Todo funcionando perfectamente!')
    console.log('🚀 Puedes subir facturas en http://cockpit.azaleia.com.pe\n')

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message)
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('💡 La API key no es válida. Verifica en: https://aistudio.google.com/apikey')
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('💡 Activa la API en: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com')
    } else {
      console.error('💡 Error inesperado:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testGemini()
