import Imap from 'imap'
import { simpleParser, ParsedMail, Attachment } from 'mailparser'
import { promisify } from 'util'

/**
 * Configuración del monitor de email
 */
export interface EmailMonitorConfig {
  // Conexión IMAP
  host: string
  port: number
  user: string
  password: string
  tls: boolean
  folder?: string // Carpeta a monitorear (default: INBOX)

  // Filtros
  subjectKeywords?: string[] // Palabras clave en asunto
  fromWhitelist?: string[] // Emails permitidos
  fromBlacklist?: string[] // Emails bloqueados
  markAsRead?: boolean // Marcar como leído después de procesar
  deleteAfter?: boolean // Eliminar después de procesar
}

/**
 * Email detectado con facturas
 */
export interface DetectedInvoiceEmail {
  emailId: string
  from: string
  subject: string
  date: Date
  attachments: EmailAttachment[]
}

export interface EmailAttachment {
  filename: string
  contentType: string
  size: number
  content: Buffer
}

/**
 * Servicio de monitoreo de email para detección automática de facturas
 */
export class EmailMonitorService {
  private config: EmailMonitorConfig
  private imap?: Imap

  constructor(config: EmailMonitorConfig) {
    this.config = {
      folder: 'INBOX',
      markAsRead: true,
      deleteAfter: false,
      ...config,
    }
  }

  /**
   * Conecta al servidor IMAP
   */
  private connect(): Promise<Imap> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: { rejectUnauthorized: false },
      })

      imap.once('ready', () => {
        console.log('📧 Conectado al servidor de email')
        this.imap = imap
        resolve(imap)
      })

      imap.once('error', (err: Error) => {
        console.error('❌ Error de conexión IMAP:', err)
        reject(err)
      })

      imap.connect()
    })
  }

  /**
   * Desconecta del servidor IMAP
   */
  private disconnect(): void {
    if (this.imap) {
      this.imap.end()
      this.imap = undefined
    }
  }

  /**
   * Busca emails no leídos que contengan facturas
   */
  async searchUnreadInvoiceEmails(): Promise<DetectedInvoiceEmail[]> {
    try {
      const imap = await this.connect()

      // Abrir carpeta
      const openBox = promisify(imap.openBox.bind(imap))
      await openBox(this.config.folder || 'INBOX')

      // Buscar emails no leídos
      const search = promisify(imap.search.bind(imap))
      const uids = await search(['UNSEEN'])

      if (uids.length === 0) {
        console.log('📭 No hay emails nuevos')
        this.disconnect()
        return []
      }

      console.log(`📬 ${uids.length} email(s) nuevo(s) encontrado(s)`)

      // Obtener emails
      const emails = await this.fetchEmails(imap, uids)

      // Filtrar emails con facturas
      const invoiceEmails = this.filterInvoiceEmails(emails)

      console.log(`✅ ${invoiceEmails.length} email(s) con facturas detectado(s)`)

      // Marcar como leído si está configurado
      if (this.config.markAsRead && invoiceEmails.length > 0) {
        await this.markEmailsAsRead(imap, invoiceEmails.map((e) => e.emailId))
      }

      // Eliminar si está configurado
      if (this.config.deleteAfter && invoiceEmails.length > 0) {
        await this.deleteEmails(imap, invoiceEmails.map((e) => e.emailId))
      }

      this.disconnect()
      return invoiceEmails
    } catch (error: any) {
      console.error('❌ Error al buscar emails:', error.message)
      this.disconnect()
      throw error
    }
  }

  /**
   * Obtiene el contenido completo de los emails
   */
  private fetchEmails(imap: Imap, uids: number[]): Promise<ParsedMail[]> {
    return new Promise((resolve, reject) => {
      const fetch = imap.fetch(uids, { bodies: '' })
      const emails: ParsedMail[] = []

      fetch.on('message', (msg: any) => {
        msg.on('body', (stream: any) => {
          simpleParser(stream)
            .then((parsed) => {
              emails.push(parsed)
            })
            .catch(reject)
        })
      })

      fetch.once('error', reject)
      fetch.once('end', () => resolve(emails))
    })
  }

  /**
   * Filtra emails que contienen facturas (por asunto y adjuntos)
   */
  private filterInvoiceEmails(emails: ParsedMail[]): DetectedInvoiceEmail[] {
    const invoiceEmails: DetectedInvoiceEmail[] = []

    for (const email of emails) {
      // Verificar whitelist/blacklist
      const from = email.from?.value[0]?.address || ''

      if (this.config.fromBlacklist?.some((blocked) => from.includes(blocked))) {
        console.log(`⛔ Email bloqueado (blacklist): ${from}`)
        continue
      }

      if (
        this.config.fromWhitelist &&
        this.config.fromWhitelist.length > 0 &&
        !this.config.fromWhitelist.some((allowed) => from.includes(allowed))
      ) {
        console.log(`⛔ Email no permitido (whitelist): ${from}`)
        continue
      }

      // Verificar palabras clave en asunto
      const subject = email.subject || ''
      const hasInvoiceKeyword = this.config.subjectKeywords?.some((keyword) =>
        subject.toLowerCase().includes(keyword.toLowerCase())
      )

      // Verificar archivos adjuntos XML o PDF
      const attachments = email.attachments || []
      const hasInvoiceAttachments = attachments.some(
        (att) =>
          att.filename?.toLowerCase().endsWith('.xml') ||
          att.filename?.toLowerCase().endsWith('.pdf')
      )

      // Debe cumplir al menos una condición
      if (hasInvoiceKeyword || hasInvoiceAttachments) {
        invoiceEmails.push({
          emailId: email.messageId || `${Date.now()}`,
          from: from,
          subject: subject,
          date: email.date || new Date(),
          attachments: attachments.map((att) => ({
            filename: att.filename || 'unknown',
            contentType: att.contentType || 'application/octet-stream',
            size: att.size || 0,
            content: att.content,
          })),
        })
      }
    }

    return invoiceEmails
  }

  /**
   * Marca emails como leídos
   */
  private async markEmailsAsRead(imap: Imap, emailIds: string[]): Promise<void> {
    try {
      const addFlags = promisify(imap.addFlags.bind(imap))
      // IMAP usa UIDs, no messageIds
      await addFlags('1:*', '\\Seen')
      console.log(`✅ ${emailIds.length} email(s) marcado(s) como leído`)
    } catch (error) {
      console.error('⚠️ Error al marcar emails como leídos:', error)
    }
  }

  /**
   * Elimina emails
   */
  private async deleteEmails(imap: Imap, emailIds: string[]): Promise<void> {
    try {
      const addFlags = promisify(imap.addFlags.bind(imap))
      await addFlags('1:*', '\\Deleted')
      const expunge = promisify(imap.expunge.bind(imap))
      await expunge()
      console.log(`🗑️ ${emailIds.length} email(s) eliminado(s)`)
    } catch (error) {
      console.error('⚠️ Error al eliminar emails:', error)
    }
  }

  /**
   * Prueba la conexión con el servidor de email
   */
  static async testConnection(config: EmailMonitorConfig): Promise<boolean> {
    try {
      const service = new EmailMonitorService(config)
      await service.connect()
      service.disconnect()
      return true
    } catch (error) {
      return false
    }
  }
}
