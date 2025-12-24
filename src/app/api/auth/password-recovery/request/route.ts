/**
 * API: POST /api/auth/password-recovery/request
 *
 * Solicita un reseteo de contraseña enviando un email con token de recuperación
 *
 * Body:
 * {
 *   "email": "usuario@ejemplo.com"  // Email o username del usuario
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Si el email existe, recibirás instrucciones de recuperación"
 * }
 *
 * Nota de seguridad: Siempre devolvemos el mismo mensaje exitoso
 * independientemente de si el email existe o no, para prevenir
 * enumeración de usuarios.
 */

import { NextRequest, NextResponse } from 'next/server'
import { PasswordRecoveryService } from '@/services/password-recovery'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validación básica
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Email es requerido'
        },
        { status: 400 }
      )
    }

    // Crear instancia del servicio
    const service = new PasswordRecoveryService()

    // Generar token de reseteo
    const tokenData = await service.createResetToken(email.trim())

    // Si el usuario no existe, NO revelamos esta información por seguridad
    // Siempre devolvemos un mensaje genérico exitoso
    if (!tokenData) {
      console.log(`⚠️ Intento de recuperación para email no registrado: ${email}`)

      // Mensaje genérico (no revelamos que el email no existe)
      return NextResponse.json({
        success: true,
        message: 'Si el email está registrado, recibirás instrucciones de recuperación en breve'
      })
    }

    // Obtener información del usuario para personalizar el email
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: { email: true, name: true, username: true }
    })

    // Enviar email con instrucciones
    const emailResult = await service.sendResetEmail(
      user?.email || email,
      tokenData.token,
      user?.name || user?.username || undefined
    )

    // Log interno para debugging
    if (emailResult.success) {
      console.log(`✅ Email de recuperación enviado a: ${user?.email}`)
    } else {
      console.error(`❌ Error enviando email: ${emailResult.error}`)
    }

    // Respuesta genérica (por seguridad)
    return NextResponse.json({
      success: true,
      message: 'Si el email está registrado, recibirás instrucciones de recuperación en breve'
    })

  } catch (error: any) {
    console.error('❌ Error en API /password-recovery/request:', error)

    // No revelar detalles del error al cliente
    return NextResponse.json(
      {
        success: false,
        message: 'Error al procesar la solicitud. Inténtalo nuevamente.'
      },
      { status: 500 }
    )
  }
}

// Método OPTIONS para CORS (si aplica)
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Allow': 'POST, OPTIONS'
      }
    }
  )
}
