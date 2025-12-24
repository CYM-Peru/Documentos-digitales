/**
 * Servicio de notificaciones por email para Planillas de Movilidad
 */

import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'

export interface PlanillaEmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  smtpSecure: boolean
  emailFrom: string
}

export interface PlanillaNotification {
  planillaId: string
  nroPlanilla: string
  userName: string
  userEmail?: string
  totalAmount: number
  gastoCount: number
  createdAt: Date
}

/**
 * Servicio para enviar emails de notificación de planillas
 */
export class PlanillaEmailService {
  private config: PlanillaEmailConfig | null = null

  /**
   * Carga la configuración SMTP desde la base de datos
   */
  async loadConfig(): Promise<boolean> {
    try {
      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

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
   * Crea el transporter de nodemailer
   */
  private createTransporter() {
    if (!this.config) {
      throw new Error('Configuración SMTP no cargada')
    }

    return nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPass
      }
    })
  }

  /**
   * Obtiene los emails de los aprobadores
   */
  async getApproverEmails(): Promise<string[]> {
    try {
      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

      if (settings?.approverEmails) {
        return settings.approverEmails.split(',').map(e => e.trim()).filter(e => e)
      }

      // Fallback: buscar usuarios con rol APROBADOR
      const aprobadores = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'APROBADOR' },
            { role: 'SUPER_ADMIN' }
          ]
        },
        select: { email: true }
      })

      return aprobadores.map(a => a.email).filter(e => e)
    } catch (error) {
      console.error('❌ Error obteniendo emails de aprobadores:', error)
      return []
    }
  }

  /**
   * Notifica a los aprobadores sobre una nueva planilla
   */
  async notifyNewPlanilla(planilla: PlanillaNotification): Promise<boolean> {
    try {
      const configLoaded = await this.loadConfig()
      if (!configLoaded) {
        console.log('⚠️ SMTP no configurado, no se envía email')
        return false
      }

      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

      if (!settings?.enabled || !settings?.notifyOnNewPlanilla) {
        console.log('⚠️ Notificaciones deshabilitadas')
        return false
      }

      const approverEmails = await this.getApproverEmails()
      if (approverEmails.length === 0) {
        console.log('⚠️ No hay emails de aprobadores configurados')
        return false
      }

      const transporter = this.createTransporter()
      const fechaFormato = planilla.createdAt.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .info-card { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #4F46E5; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .info-label { color: #6b7280; font-size: 14px; }
    .info-value { font-weight: 600; color: #1f2937; }
    .amount { font-size: 28px; color: #059669; font-weight: bold; text-align: center; margin: 20px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #4F46E5, #7C3AED); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .emoji { font-size: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><span class="emoji">🚗</span> Nueva Planilla de Movilidad</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Requiere tu aprobación</p>
    </div>

    <div class="content">
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">N° Planilla:</span>
          <span class="info-value">${planilla.nroPlanilla}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Colaborador:</span>
          <span class="info-value">${planilla.userName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${planilla.userEmail || 'No especificado'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Gastos registrados:</span>
          <span class="info-value">${planilla.gastoCount} movimientos</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha de registro:</span>
          <span class="info-value">${fechaFormato}</span>
        </div>
      </div>

      <div class="amount">
        S/ ${planilla.totalAmount.toFixed(2)}
      </div>

      <div style="text-align: center;">
        <a href="https://cockpit.azaleia.com.pe/aprobacion-planillas" class="btn">
          Revisar y Aprobar
        </a>
      </div>
    </div>

    <div class="footer">
      <p>Este es un mensaje automático del Sistema Cockpit</p>
      <p>Calzados Azaleia Perú S.A.</p>
    </div>
  </div>
</body>
</html>
`

      await transporter.sendMail({
        from: this.config!.emailFrom,
        to: approverEmails.join(', '),
        subject: `🚗 Nueva Planilla de Movilidad - ${planilla.userName} - S/ ${planilla.totalAmount.toFixed(2)}`,
        html: htmlContent
      })

      console.log(`✅ Email enviado a aprobadores: ${approverEmails.join(', ')}`)
      return true

    } catch (error: any) {
      console.error('❌ Error enviando email de nueva planilla:', error.message)
      return false
    }
  }

  /**
   * Notifica al usuario que su planilla fue aprobada
   */
  async notifyApproved(planilla: PlanillaNotification, approverName: string): Promise<boolean> {
    try {
      const configLoaded = await this.loadConfig()
      if (!configLoaded || !planilla.userEmail) return false

      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

      if (!settings?.enabled || !settings?.notifyOnApproval) return false

      const transporter = this.createTransporter()

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #059669, #10B981); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Planilla Aprobada</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${planilla.userName}</strong>,</p>
      <p>Tu planilla de movilidad <strong>${planilla.nroPlanilla}</strong> por <strong>S/ ${planilla.totalAmount.toFixed(2)}</strong> ha sido <span style="color: #059669; font-weight: bold;">APROBADA</span>.</p>
      <p>Aprobado por: <strong>${approverName}</strong></p>
    </div>
    <div class="footer">
      <p>Sistema Cockpit - Calzados Azaleia Perú S.A.</p>
    </div>
  </div>
</body>
</html>
`

      await transporter.sendMail({
        from: this.config!.emailFrom,
        to: planilla.userEmail,
        subject: `✅ Tu Planilla ${planilla.nroPlanilla} fue Aprobada`,
        html: htmlContent
      })

      console.log(`✅ Email de aprobación enviado a: ${planilla.userEmail}`)
      return true

    } catch (error: any) {
      console.error('❌ Error enviando email de aprobación:', error.message)
      return false
    }
  }

  /**
   * Notifica al usuario que su planilla fue rechazada
   */
  async notifyRejected(planilla: PlanillaNotification, approverName: string, reason?: string): Promise<boolean> {
    try {
      const configLoaded = await this.loadConfig()
      if (!configLoaded || !planilla.userEmail) return false

      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

      if (!settings?.enabled || !settings?.notifyOnRejection) return false

      const transporter = this.createTransporter()

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #DC2626, #EF4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .reason { background: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Planilla Rechazada</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${planilla.userName}</strong>,</p>
      <p>Tu planilla de movilidad <strong>${planilla.nroPlanilla}</strong> ha sido <span style="color: #DC2626; font-weight: bold;">RECHAZADA</span>.</p>
      <p>Rechazado por: <strong>${approverName}</strong></p>
      ${reason ? `<div class="reason"><strong>Motivo:</strong> ${reason}</div>` : ''}
      <p>Por favor, revisa y corrige los datos indicados para volver a enviarla.</p>
    </div>
    <div class="footer">
      <p>Sistema Cockpit - Calzados Azaleia Perú S.A.</p>
    </div>
  </div>
</body>
</html>
`

      await transporter.sendMail({
        from: this.config!.emailFrom,
        to: planilla.userEmail,
        subject: `❌ Tu Planilla ${planilla.nroPlanilla} fue Rechazada`,
        html: htmlContent
      })

      console.log(`✅ Email de rechazo enviado a: ${planilla.userEmail}`)
      return true

    } catch (error: any) {
      console.error('❌ Error enviando email de rechazo:', error.message)
      return false
    }
  }

  /**
   * Prueba la conexión SMTP
   */
  static async testConnection(config: PlanillaEmailConfig): Promise<{ success: boolean; message: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass
        }
      })

      await transporter.verify()
      return { success: true, message: 'Conexión SMTP exitosa' }
    } catch (error: any) {
      return { success: false, message: error.message }
    }
  }

  /**
   * Notifica a los aprobadores que hay una nueva planilla de gastos reparables
   */
  async notifyNewGastoReparable(planilla: { planillaId: string; nroPlanilla: string; userName: string; userEmail?: string; totalAmount: number; itemCount: number; createdAt: Date }): Promise<boolean> {
    try {
      const configLoaded = await this.loadConfig()
      if (!configLoaded) return false

      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

      if (!settings?.enabled || !settings?.notifyOnNewPlanilla) return false

      const approverEmails = await this.getApproverEmails()
      if (approverEmails.length === 0) {
        console.log('⚠️ No hay emails de aprobadores configurados')
        return false
      }

      const transporter = this.createTransporter()

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #059669, #10B981); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .badge { background: #10B981; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; font-size: 14px; margin-top: 10px; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .info-box { background: white; border-left: 4px solid #10B981; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .btn { background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Nueva Planilla de Gastos Reparables</h1>
      <span class="badge">PENDIENTE DE APROBACIÓN</span>
    </div>
    <div class="content">
      <p>Hola,</p>
      <p>Se ha recibido una nueva planilla de gastos reparables para aprobación:</p>
      <div class="info-box">
        <p><strong>Planilla:</strong> ${planilla.nroPlanilla}</p>
        <p><strong>Trabajador:</strong> ${planilla.userName}</p>
        <p><strong>Total:</strong> S/ ${planilla.totalAmount.toFixed(2)}</p>
        <p><strong>Items:</strong> ${planilla.itemCount} gasto(s)</p>
        <p><strong>Fecha:</strong> ${planilla.createdAt.toLocaleDateString('es-PE')}</p>
      </div>
      <p>Por favor, revisa y aprueba esta planilla en el sistema.</p>
      <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/planillas" class="btn">Ver Planilla</a>
    </div>
    <div class="footer">
      <p>Sistema Cockpit - Calzados Azaleia Perú S.A.</p>
    </div>
  </div>
</body>
</html>
`

      await transporter.sendMail({
        from: this.config!.emailFrom,
        to: approverEmails,
        subject: `📄 Nueva Planilla de Gastos Reparables ${planilla.nroPlanilla} - ${planilla.userName}`,
        html: htmlContent
      })

      console.log(`✅ Email de nueva planilla enviado a: ${approverEmails.join(', ')}`)
      return true

    } catch (error: any) {
      console.error('❌ Error enviando email de nueva planilla:', error.message)
      return false
    }
  }

  /**
   * Notifica al usuario que su planilla de gastos reparables fue aprobada
   */
  async notifyGastoReparableApproved(planilla: { planillaId: string; nroPlanilla: string; userName: string; userEmail?: string; totalAmount: number; itemCount: number; createdAt: Date }, approverName: string): Promise<boolean> {
    try {
      const configLoaded = await this.loadConfig()
      if (!configLoaded || !planilla.userEmail) return false

      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

      if (!settings?.enabled || !settings?.notifyOnApproval) return false

      const transporter = this.createTransporter()

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #059669, #10B981); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Planilla Aprobada</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${planilla.userName}</strong>,</p>
      <p>Tu planilla de gastos reparables <strong>${planilla.nroPlanilla}</strong> por <strong>S/ ${planilla.totalAmount.toFixed(2)}</strong> ha sido <span style="color: #059669; font-weight: bold;">APROBADA</span>.</p>
      <p>Aprobado por: <strong>${approverName}</strong></p>
    </div>
    <div class="footer">
      <p>Sistema Cockpit - Calzados Azaleia Perú S.A.</p>
    </div>
  </div>
</body>
</html>
`

      await transporter.sendMail({
        from: this.config!.emailFrom,
        to: planilla.userEmail,
        subject: `✅ Tu Planilla ${planilla.nroPlanilla} fue Aprobada`,
        html: htmlContent
      })

      console.log(`✅ Email de aprobación enviado a: ${planilla.userEmail}`)
      return true

    } catch (error: any) {
      console.error('❌ Error enviando email de aprobación:', error.message)
      return false
    }
  }

  /**
   * Notifica al usuario que su planilla de gastos reparables fue rechazada
   */
  async notifyGastoReparableRejected(planilla: { planillaId: string; nroPlanilla: string; userName: string; userEmail?: string; totalAmount: number; itemCount: number; createdAt: Date }, approverName: string, reason?: string): Promise<boolean> {
    try {
      const configLoaded = await this.loadConfig()
      if (!configLoaded || !planilla.userEmail) return false

      const settings = await prisma.notificationSettings.findUnique({
        where: { id: 'default' }
      })

      if (!settings?.enabled || !settings?.notifyOnRejection) return false

      const transporter = this.createTransporter()

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #DC2626, #EF4444); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .reason { background: #FEF2F2; border-left: 4px solid #DC2626; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .footer { background: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>❌ Planilla Rechazada</h1>
    </div>
    <div class="content">
      <p>Hola <strong>${planilla.userName}</strong>,</p>
      <p>Tu planilla de gastos reparables <strong>${planilla.nroPlanilla}</strong> ha sido <span style="color: #DC2626; font-weight: bold;">RECHAZADA</span>.</p>
      <p>Rechazado por: <strong>${approverName}</strong></p>
      ${reason ? `<div class="reason"><strong>Motivo:</strong> ${reason}</div>` : ''}
      <p>Por favor, revisa y corrige los datos indicados para volver a enviarla.</p>
    </div>
    <div class="footer">
      <p>Sistema Cockpit - Calzados Azaleia Perú S.A.</p>
    </div>
  </div>
</body>
</html>
`

      await transporter.sendMail({
        from: this.config!.emailFrom,
        to: planilla.userEmail,
        subject: `❌ Tu Planilla ${planilla.nroPlanilla} fue Rechazada`,
        html: htmlContent
      })

      console.log(`✅ Email de rechazo enviado a: ${planilla.userEmail}`)
      return true

    } catch (error: any) {
      console.error('❌ Error enviando email de rechazo:', error.message)
      return false
    }
  }
}
