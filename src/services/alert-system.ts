import nodemailer from 'nodemailer'
import { prisma } from '@/lib/prisma'

/**
 * Configuración del sistema de alertas
 */
export interface AlertSystemConfig {
  // SMTP para enviar emails a proveedores
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPass?: string
  smtpSsl?: boolean
  emailFrom?: string

  // Configuración de alertas
  missingXmlDays: number // Días antes de alertar
  autoEmailProvider: boolean // Enviar email automático a proveedor
  emailSubject?: string
  emailTemplate?: string

  // Webhooks
  slackWebhook?: string
  teamsWebhook?: string
}

/**
 * Factura con XML faltante
 */
export interface MissingXmlInvoice {
  id: string
  rucEmisor: string
  razonSocialEmisor?: string
  serieNumero: string
  totalAmount: number
  invoiceDate?: Date
  createdAt: Date
  daysSinceCreated: number
  emailSent: boolean
}

/**
 * Sistema de alertas para facturas sin XML
 */
export class AlertSystem {
  private config: AlertSystemConfig

  constructor(config: AlertSystemConfig) {
    this.config = {
      emailSubject: 'Solicitud de XML - Factura Electrónica',
      ...config,
    }
  }

  /**
   * Busca facturas sin XML que superen el límite de días
   */
  async findMissingXmlInvoices(organizationId: string): Promise<MissingXmlInvoice[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.setDate(-this.config.missingXmlDays))

      // Buscar facturas procesadas por OCR (imágenes) que no tienen XML
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: organizationId,
          status: 'COMPLETED',
          createdAt: { lt: cutoffDate },
          // Facturas que NO tienen XML (imageUrl no termina en .xml)
          NOT: {
            imageUrl: { endsWith: '.xml' },
          },
          // Que tengan datos de emisor (fueron procesadas correctamente)
          rucEmisor: { not: null },
          serieNumero: { not: null },
        },
        orderBy: { createdAt: 'asc' },
      })

      return invoices.map((inv) => ({
        id: inv.id,
        rucEmisor: inv.rucEmisor!,
        razonSocialEmisor: inv.razonSocialEmisor || undefined,
        serieNumero: inv.serieNumero!,
        totalAmount: inv.totalAmount || 0,
        invoiceDate: inv.invoiceDate || undefined,
        createdAt: inv.createdAt,
        daysSinceCreated: Math.floor(
          (Date.now() - inv.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
        emailSent: false, // TODO: Implementar tracking de emails enviados
      }))
    } catch (error) {
      console.error('❌ Error buscando facturas sin XML:', error)
      return []
    }
  }

  /**
   * Envía email automático al proveedor solicitando el XML
   */
  async sendProviderEmail(
    invoice: MissingXmlInvoice,
    proveedorEmail: string
  ): Promise<boolean> {
    if (!this.config.smtpHost || !this.config.smtpUser || !this.config.smtpPass) {
      console.log('⚠️ SMTP no configurado, no se puede enviar email')
      return false
    }

    try {
      const transporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort || 587,
        secure: this.config.smtpSsl || false,
        auth: {
          user: this.config.smtpUser,
          pass: this.config.smtpPass,
        },
      })

      const emailBody = this.generateEmailBody(invoice)

      await transporter.sendMail({
        from: this.config.emailFrom || this.config.smtpUser,
        to: proveedorEmail,
        subject: this.config.emailSubject!,
        html: emailBody,
      })

      console.log(`✅ Email enviado a ${proveedorEmail} - Factura ${invoice.serieNumero}`)
      return true
    } catch (error: any) {
      console.error(`❌ Error enviando email a ${proveedorEmail}:`, error.message)
      return false
    }
  }

  /**
   * Genera el cuerpo del email para el proveedor
   */
  private generateEmailBody(invoice: MissingXmlInvoice): string {
    // Si hay template personalizado, usarlo
    if (this.config.emailTemplate) {
      return this.config.emailTemplate
        .replace('{serieNumero}', invoice.serieNumero)
        .replace('{razonSocial}', invoice.razonSocialEmisor || 'Estimado proveedor')
        .replace('{monto}', `S/ ${invoice.totalAmount.toFixed(2)}`)
        .replace(
          '{fecha}',
          invoice.invoiceDate?.toLocaleDateString('es-PE') || 'No especificada'
        )
    }

    // Template por defecto
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .invoice-info { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4F46E5; }
    .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .highlight { color: #4F46E5; font-weight: bold; }
    .important { background: #fef3c7; padding: 10px; border-radius: 4px; border-left: 4px solid #f59e0b; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📧 Solicitud de Comprobante Electrónico</h2>
    </div>

    <div class="content">
      <p>Estimado proveedor <strong>${invoice.razonSocialEmisor || ''}</strong>,</p>

      <p>De acuerdo a la normativa de SUNAT sobre comprobantes electrónicos, solicitamos el envío del archivo <span class="highlight">XML firmado digitalmente</span> correspondiente a la siguiente factura:</p>

      <div class="invoice-info">
        <p><strong>📄 Serie - Número:</strong> ${invoice.serieNumero}</p>
        <p><strong>📅 Fecha:</strong> ${invoice.invoiceDate?.toLocaleDateString('es-PE') || 'No especificada'}</p>
        <p><strong>💰 Monto:</strong> S/ ${invoice.totalAmount.toFixed(2)}</p>
        <p><strong>🏢 RUC Emisor:</strong> ${invoice.rucEmisor}</p>
      </div>

      <div class="important">
        <strong>⚠️ Importante:</strong> El archivo XML es <strong>requisito indispensable</strong> para nuestro registro contable y sustento tributario ante SUNAT.
      </div>

      <p><strong>Marco Legal:</strong></p>
      <ul>
        <li>Resolución de Superintendencia N° 097-2012/SUNAT</li>
        <li>Artículo 7° de la RS N° 300-2014/SUNAT</li>
      </ul>

      <p>Por favor, enviar el archivo XML a la brevedad posible, idealmente en un plazo de <strong>48 horas</strong>.</p>

      <p>El archivo XML debe estar <strong>firmado digitalmente</strong> y coincidir con los datos del comprobante emitido.</p>

      <p>Gracias por su atención.</p>
    </div>

    <div class="footer">
      <p>Este es un mensaje automático generado por nuestro sistema de gestión de comprobantes electrónicos.</p>
      <p>Si ya envió el XML, por favor ignore este mensaje.</p>
    </div>
  </div>
</body>
</html>
`
  }

  /**
   * Envía alerta a Slack
   */
  async sendSlackAlert(invoices: MissingXmlInvoice[]): Promise<boolean> {
    if (!this.config.slackWebhook) {
      return false
    }

    try {
      const message = {
        text: `🚨 *Alerta: ${invoices.length} factura(s) sin XML*`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `🚨 ${invoices.length} Factura(s) sin XML`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Las siguientes facturas llevan más de *${this.config.missingXmlDays} días* sin XML:`,
            },
          },
          ...invoices.slice(0, 5).map((inv) => ({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `• *${inv.serieNumero}* - ${inv.razonSocialEmisor || inv.rucEmisor} - S/ ${inv.totalAmount.toFixed(2)} - ⏱️ ${inv.daysSinceCreated} días`,
            },
          })),
        ],
      }

      await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })

      console.log('✅ Alerta enviada a Slack')
      return true
    } catch (error) {
      console.error('❌ Error enviando alerta a Slack:', error)
      return false
    }
  }

  /**
   * Prueba la configuración SMTP
   */
  static async testSmtpConnection(config: AlertSystemConfig): Promise<boolean> {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      return false
    }

    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpSsl || false,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      })

      await transporter.verify()
      return true
    } catch (error) {
      return false
    }
  }
}
