/**
 * API: POST /api/auth/password-recovery/reset
 *
 * Resetea la contraseña usando un token válido
 *
 * Body:
 * {
 *   "token": "abc123...",      // Token recibido por email
 *   "newPassword": "miPass123" // Nueva contraseña (mínimo 6 caracteres)
 * }
 *
 * Response Success:
 * {
 *   "success": true,
 *   "message": "Contraseña actualizada correctamente"
 * }
 *
 * Response Error:
 * {
 *   "success": false,
 *   "message": "Token inválido o expirado",
 *   "error": "INVALID_TOKEN"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { PasswordRecoveryService } from '@/services/password-recovery'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    // Validaciones
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Token es requerido',
          error: 'MISSING_TOKEN'
        },
        { status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Nueva contraseña es requerida',
          error: 'MISSING_PASSWORD'
        },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres',
          error: 'WEAK_PASSWORD'
        },
        { status: 400 }
      )
    }

    // Crear instancia del servicio
    const service = new PasswordRecoveryService()

    // Resetear contraseña
    const result = await service.resetPassword(token, newPassword)

    if (!result.success) {
      // Mapeo de errores a códigos HTTP
      const statusCode = result.error === 'INVALID_TOKEN' ? 401 : 400

      return NextResponse.json(result, { status: statusCode })
    }

    // Éxito
    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.'
    })

  } catch (error: any) {
    console.error('❌ Error en API /password-recovery/reset:', error)

    return NextResponse.json(
      {
        success: false,
        message: 'Error al procesar la solicitud. Inténtalo nuevamente.',
        error: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}

// Validación de token (GET) - Útil para verificar si un token es válido antes de mostrar el formulario
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          message: 'Token no proporcionado'
        },
        { status: 400 }
      )
    }

    // Crear instancia del servicio
    const service = new PasswordRecoveryService()

    // Validar token
    const userId = await service.validateToken(token)

    if (!userId) {
      return NextResponse.json({
        valid: false,
        message: 'Token inválido o expirado'
      })
    }

    return NextResponse.json({
      valid: true,
      message: 'Token válido'
    })

  } catch (error: any) {
    console.error('❌ Error validando token:', error)

    return NextResponse.json(
      {
        valid: false,
        message: 'Error al validar token'
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
        'Allow': 'POST, GET, OPTIONS'
      }
    }
  )
}
