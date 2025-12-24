/**
 * SERVICIO DE RECUPERACIÓN DE CONTRASEÑA
 * Microservicio independiente y reutilizable para recuperación de contraseña por email
 *
 * Características:
 * - Generación de tokens seguros con expiración
 * - Envío de emails con nodemailer (Office365/SMTP)
 * - Validación de tokens y reseteo de contraseña
 * - Sistema de limpieza automática de tokens expirados
 *
 * @author Sistema Cockpit - Azaleia Perú
 */

import * as crypto from 'crypto'
import * as bcrypt from 'bcryptjs'
import * as nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'

// ===========================================================================================
// INTERFACES Y TIPOS
// ===========================================================================================

export interface PasswordRecoveryConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  emailFrom: string
}

export interface ResetTokenData {
  token: string
  expiresAt: Date
  userId: string
}

export interface PasswordResetResult {
  success: boolean
  message: string
  error?: string
}

// ===========================================================================================
// CLASE PRINCIPAL DEL SERVICIO
// ===========================================================================================

export class PasswordRecoveryService {
  private config: PasswordRecoveryConfig | null = null

  // Token expira en 15 minutos (configurable)
  private readonly TOKEN_EXPIRY_MINUTES = 15

  // ===========================================================================================
  // CONFIGURACIÓN
  // ===========================================================================================

  /**
   * Carga la configuración SMTP desde NotificationSettings
   * Reutiliza la configuración existente del sistema
   */
  async loadConfig(): Promise<boolean> {
    try {
      const settings = await prisma.notificationSettings.findFirst()

      if (!settings?.smtpHost || !settings?.smtpUser || !settings?.smtpPass) {
        console.log('⚠️ Configuración SMTP no completa')
        return false
      }

      this.config = {
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort || 587,
        smtpUser: settings.smtpUser,
        smtpPass: settings.smtpPass,
        smtpSecure: settings.smtpSecure || false,
        emailFrom: settings.emailFrom || settings.smtpUser
      }

      return true
    } catch (error) {
      console.error('❌ Error cargando configuración SMTP:', error)
      return false
    }
  }

  /**
   * Crea el transporter de nodemailer para envío de emails
   */
  private createTransporter() {
    if (!this.config) {
      throw new Error('Configuración SMTP no cargada. Ejecuta loadConfig() primero.')
    }

    return nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPass
      },
      tls: {
        rejectUnauthorized: false // Para Office365
      }
    })
  }

  // ===========================================================================================
  // GENERACIÓN DE TOKENS
  // ===========================================================================================

  /**
   * Genera un token criptográficamente seguro de 32 bytes
   * @returns Token único en formato hexadecimal (64 caracteres)
   */
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Hash del token para almacenamiento seguro en BD
   * Nunca almacenamos tokens en texto plano
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  /**
   * Crea un token de reseteo para un usuario
   * @param email Email del usuario
   * @returns Token en texto plano (se envía por email) o null si el usuario no existe
   */
  async createResetToken(email: string): Promise<ResetTokenData | null> {
    try {
      // Buscar usuario por email o username (case insensitive)
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            { username: email.toUpperCase() }
          ]
        }
      })

      if (!user) {
        // Por seguridad, no revelamos si el email existe o no
        console.log(`⚠️ Intento de recuperación para email no existente: ${email}`)
        return null
      }

      // Invalidar tokens anteriores del usuario
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          used: false
        },
        data: {
          used: true,
          usedAt: new Date()
        }
      })

      // Generar nuevo token
      const token = this.generateResetToken()
      const tokenHash = this.hashToken(token)
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000)

      // Guardar token en BD
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: tokenHash,
          expiresAt,
          used: false
        }
      })

      console.log(`✅ Token de recuperación generado para usuario: ${user.email}`)

      return {
        token, // Token en texto plano (solo lo devolvemos aquí, nunca lo guardamos)
        expiresAt,
        userId: user.id
      }

    } catch (error) {
      console.error('❌ Error creando token de reseteo:', error)
      return null
    }
  }

  // ===========================================================================================
  // ENVÍO DE EMAILS
  // ===========================================================================================

  /**
   * Envía email con instrucciones para resetear contraseña
   * @param email Email del destinatario
   * @param token Token de reseteo (en texto plano)
   * @param userName Nombre del usuario (opcional)
   */
  async sendResetEmail(
    email: string,
    token: string,
    userName?: string
  ): Promise<PasswordResetResult> {
    try {
      // Cargar configuración SMTP
      const configLoaded = await this.loadConfig()
      if (!configLoaded) {
        return {
          success: false,
          message: 'Configuración SMTP no disponible',
          error: 'SMTP_NOT_CONFIGURED'
        }
      }

      // Construir URL de reseteo
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`

      // Crear transporter
      const transporter = this.createTransporter()

      // HTML del email
      const htmlContent = this.buildResetEmailHTML(resetUrl, userName)

      // Enviar email
      await transporter.sendMail({
        from: this.config!.emailFrom,
        to: email,
        subject: '🔐 Recuperación de Contraseña - Sistema Cockpit',
        html: htmlContent
      })

      console.log(`✅ Email de recuperación enviado a: ${email}`)

      return {
        success: true,
        message: 'Email de recuperación enviado correctamente'
      }

    } catch (error: any) {
      console.error('❌ Error enviando email de recuperación:', error)
      return {
        success: false,
        message: 'Error al enviar el email',
        error: error.message
      }
    }
  }

  /**
   * Construye el HTML del email de recuperación
   */
  private buildResetEmailHTML(resetUrl: string, userName?: string): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.95;
      font-size: 16px;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      margin: 15px 0;
      font-size: 15px;
      color: #555;
    }
    .greeting {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 20px;
    }
    .button-container {
      text-align: center;
      margin: 35px 0;
    }
    .reset-button {
      display: inline-block;
      background: linear-gradient(135deg, #4F46E5, #7C3AED);
      color: white;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      transition: all 0.3s ease;
    }
    .reset-button:hover {
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
      transform: translateY(-2px);
    }
    .warning {
      background: #FEF2F2;
      border-left: 4px solid #EF4444;
      padding: 15px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .warning p {
      margin: 5px 0;
      font-size: 14px;
      color: #991B1B;
    }
    .info {
      background: #F0F9FF;
      border-left: 4px solid #3B82F6;
      padding: 15px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .info p {
      margin: 5px 0;
      font-size: 14px;
      color: #1E40AF;
    }
    .footer {
      background: #f8f9fa;
      padding: 25px 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer p {
      margin: 5px 0;
      font-size: 13px;
      color: #6c757d;
    }
    .link-alt {
      word-break: break-all;
      font-size: 13px;
      color: #6c757d;
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>🔐 Recuperación de Contraseña</h1>
      <p>Sistema Cockpit</p>
    </div>

    <!-- Content -->
    <div class="content">
      ${userName ? `<p class="greeting">Hola ${userName},</p>` : '<p class="greeting">Hola,</p>'}

      <p>
        Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en el Sistema Cockpit.
      </p>

      <p>
        Para crear una nueva contraseña, haz clic en el siguiente botón:
      </p>

      <!-- Reset Button -->
      <div class="button-container">
        <a href="${resetUrl}" class="reset-button">
          Restablecer mi Contraseña
        </a>
      </div>

      <!-- Info Box -->
      <div class="info">
        <p><strong>Este enlace expira en 15 minutos</strong></p>
        <p>Por seguridad, el enlace de recuperación solo estará activo durante 15 minutos.</p>
      </div>

      <!-- Warning Box -->
      <div class="warning">
        <p><strong>¿No solicitaste este cambio?</strong></p>
        <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este email. Tu contraseña permanecerá sin cambios.</p>
      </div>

      <!-- Alternative Link -->
      <p style="font-size: 13px; color: #6c757d; margin-top: 30px;">
        Si el botón no funciona, copia y pega este enlace en tu navegador:
      </p>
      <div class="link-alt">
        ${resetUrl}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>Sistema Cockpit</strong></p>
      <p>Calzados Azaleia Perú S.A.</p>
      <p style="margin-top: 15px; font-size: 12px;">
        Este es un mensaje automático, por favor no respondas a este email.
      </p>
    </div>
  </div>
</body>
</html>
`
  }

  // ===========================================================================================
  // VALIDACIÓN Y RESETEO
  // ===========================================================================================

  /**
   * Valida un token de reseteo
   * @param token Token en texto plano
   * @returns Usuario ID si el token es válido, null si no lo es
   */
  async validateToken(token: string): Promise<string | null> {
    try {
      const tokenHash = this.hashToken(token)

      const resetToken = await prisma.passwordResetToken.findUnique({
        where: { token: tokenHash }
      })

      // Verificaciones de seguridad
      if (!resetToken) {
        console.log('⚠️ Token no encontrado')
        return null
      }

      if (resetToken.used) {
        console.log('⚠️ Token ya fue utilizado')
        return null
      }

      if (resetToken.expiresAt < new Date()) {
        console.log('⚠️ Token expirado')
        return null
      }

      console.log(`✅ Token válido para usuario: ${resetToken.userId}`)
      return resetToken.userId

    } catch (error) {
      console.error('❌ Error validando token:', error)
      return null
    }
  }

  /**
   * Resetea la contraseña de un usuario usando un token válido
   * @param token Token de reseteo
   * @param newPassword Nueva contraseña en texto plano
   */
  async resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
    try {
      // Validar token
      const userId = await this.validateToken(token)

      if (!userId) {
        return {
          success: false,
          message: 'Token inválido o expirado',
          error: 'INVALID_TOKEN'
        }
      }

      // Validar contraseña
      if (!newPassword || newPassword.length < 6) {
        return {
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres',
          error: 'WEAK_PASSWORD'
        }
      }

      // Hash de la nueva contraseña
      const passwordHash = await bcrypt.hash(newPassword, 10)

      // Actualizar contraseña del usuario
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash }
      })

      // Marcar token como usado
      const tokenHash = this.hashToken(token)
      await prisma.passwordResetToken.update({
        where: { token: tokenHash },
        data: {
          used: true,
          usedAt: new Date()
        }
      })

      console.log(`✅ Contraseña actualizada para usuario: ${userId}`)

      return {
        success: true,
        message: 'Contraseña actualizada correctamente'
      }

    } catch (error: any) {
      console.error('❌ Error reseteando contraseña:', error)
      return {
        success: false,
        message: 'Error al actualizar la contraseña',
        error: error.message
      }
    }
  }

  // ===========================================================================================
  // UTILIDADES Y MANTENIMIENTO
  // ===========================================================================================

  /**
   * Limpia tokens expirados o usados de la base de datos
   * Útil para ejecutar periódicamente como tarea de mantenimiento
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await prisma.passwordResetToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { used: true }
          ]
        }
      })

      console.log(`🧹 Tokens limpiados: ${result.count}`)
      return result.count

    } catch (error) {
      console.error('❌ Error limpiando tokens expirados:', error)
      return 0
    }
  }

  /**
   * Prueba la conexión SMTP
   */
  static async testConnection(config: PasswordRecoveryConfig): Promise<PasswordResetResult> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        },
        tls: {
          rejectUnauthorized: false
        }
      })

      await transporter.verify()

      return {
        success: true,
        message: 'Conexión SMTP exitosa'
      }
    } catch (error: any) {
      return {
        success: false,
        message: 'Error de conexión SMTP',
        error: error.message
      }
    }
  }
}

// ===========================================================================================
// EXPORTACIÓN DE INSTANCIA SINGLETON (OPCIONAL)
// ===========================================================================================

/**
 * Instancia singleton del servicio para uso directo
 * También puedes crear nuevas instancias con: new PasswordRecoveryService()
 */
export const passwordRecoveryService = new PasswordRecoveryService()
