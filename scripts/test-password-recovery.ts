/**
 * Script de prueba para el servicio de recuperación de contraseña
 *
 * Uso:
 *   npx ts-node scripts/test-password-recovery.ts
 */

import { PasswordRecoveryService } from '../src/services/password-recovery'

async function testPasswordRecovery() {
  console.log('🔧 Iniciando prueba del servicio de recuperación de contraseña\n')

  const service = new PasswordRecoveryService()

  // Test 1: Cargar configuración SMTP
  console.log('📋 Test 1: Cargando configuración SMTP...')
  const configLoaded = await service.loadConfig()

  if (!configLoaded) {
    console.log('❌ Error: Configuración SMTP no disponible')
    console.log('💡 Configura SMTP en NotificationSettings antes de continuar\n')
    return
  }

  console.log('✅ Configuración SMTP cargada correctamente\n')

  // Test 2: Generar token
  console.log('📋 Test 2: Generando token de reseteo...')
  const email = process.argv[2] || 'test@ejemplo.com'

  console.log(`   Email/Username: ${email}`)

  const tokenData = await service.createResetToken(email)

  if (!tokenData) {
    console.log(`❌ Error: Usuario no encontrado para email: ${email}`)
    console.log('💡 Usa un email válido: npx ts-node scripts/test-password-recovery.ts usuario@ejemplo.com\n')
    return
  }

  console.log(`✅ Token generado exitosamente`)
  console.log(`   User ID: ${tokenData.userId}`)
  console.log(`   Token: ${tokenData.token.substring(0, 20)}...`)
  console.log(`   Expira: ${tokenData.expiresAt.toLocaleString()}\n`)

  // Test 3: Validar token
  console.log('📋 Test 3: Validando token...')
  const userId = await service.validateToken(tokenData.token)

  if (userId) {
    console.log(`✅ Token válido para usuario: ${userId}\n`)
  } else {
    console.log('❌ Error: Token inválido\n')
    return
  }

  // Test 4: Probar envío de email (opcional - comentado por defecto)
  const shouldSendEmail = process.argv[3] === '--send-email'

  if (shouldSendEmail) {
    console.log('📋 Test 4: Enviando email de recuperación...')

    const emailResult = await service.sendResetEmail(
      email,
      tokenData.token,
      'Usuario de Prueba'
    )

    if (emailResult.success) {
      console.log('✅ Email enviado correctamente\n')
    } else {
      console.log(`❌ Error enviando email: ${emailResult.error}\n`)
    }
  } else {
    console.log('📋 Test 4: Envío de email omitido (usa --send-email para enviar)\n')
  }

  // Test 5: Limpiar tokens expirados
  console.log('📋 Test 5: Limpiando tokens expirados...')
  const cleanedCount = await service.cleanupExpiredTokens()
  console.log(`✅ Tokens limpiados: ${cleanedCount}\n`)

  console.log('✨ Prueba completada exitosamente\n')

  // Nota importante
  console.log('⚠️  IMPORTANTE:')
  console.log('   - El token generado es válido por 15 minutos')
  console.log('   - No uses tokens de prueba en producción')
  console.log('   - Limpia tokens de prueba con cleanupExpiredTokens()\n')
}

// Ejecutar prueba
testPasswordRecovery()
  .catch((error) => {
    console.error('❌ Error en la prueba:', error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
