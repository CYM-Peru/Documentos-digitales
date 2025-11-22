/**
 * WhatsApp Service - Evolution API Integration
 * Maneja la conexión y envío de mensajes a través de Evolution API
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080'
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'B6D711FCDE4D4FD5936544120E713976'

export interface WhatsAppInstance {
  instanceName: string
  status: string
  serverUrl: string
  apikey: string
  qrcode?: {
    code: string
    base64: string
  }
}

export interface SendMessageParams {
  number: string
  text: string
  instanceName: string
}

export class WhatsAppService {
  private apiUrl: string
  private apiKey: string

  constructor(apiUrl?: string, apiKey?: string) {
    this.apiUrl = apiUrl || EVOLUTION_API_URL
    this.apiKey = apiKey || EVOLUTION_API_KEY
  }

  /**
   * Crear una nueva instancia de WhatsApp
   */
  async createInstance(instanceName: string): Promise<any> {
    try {
      console.log(`📱 Creating WhatsApp instance: ${instanceName}`)

      const response = await fetch(`${this.apiUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
        body: JSON.stringify({
          instanceName,
          token: this.apiKey,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to create instance: ${error}`)
      }

      const data = await response.json()
      console.log(`✅ Instance created successfully: ${instanceName}`)

      return data
    } catch (error: any) {
      console.error(`❌ Error creating instance: ${error.message}`)
      throw error
    }
  }

  /**
   * Obtener QR code de una instancia con reintentos
   */
  async getQRCode(instanceName: string, maxRetries = 15): Promise<string | null> {
    console.log(`📷 Getting QR code for: ${instanceName} (max ${maxRetries} retries)`)

    // Primero intentamos conectar/iniciar la instancia para generar el QR
    try {
      const connectResponse = await fetch(`${this.apiUrl}/instance/connect/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
        },
      })

      if (connectResponse.ok) {
        const connectData = await connectResponse.json()
        if (connectData.qrcode?.base64) {
          console.log(`✅ QR code obtained immediately from connect endpoint`)
          return connectData.qrcode.base64
        }
      }
    } catch (error) {
      console.log(`⚠️ Connect endpoint failed, will try status polling`)
    }

    // Si no obtuvimos el QR inmediatamente, hacer polling con reintentos
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries} - Checking for QR code...`)

        const statusResponse = await fetch(`${this.apiUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
          method: 'GET',
          headers: {
            'apikey': this.apiKey,
          },
        })

        if (statusResponse.ok) {
          const instances = await statusResponse.json()
          const instance = Array.isArray(instances) ? instances.find((i: any) => i.name === instanceName) : instances

          // Verificar si hay QR en diferentes formatos posibles
          if (instance?.qrcode?.base64) {
            console.log(`✅ QR code obtained successfully on attempt ${attempt}`)
            return instance.qrcode.base64
          }

          if (instance?.qrcode && typeof instance.qrcode === 'string') {
            console.log(`✅ QR code (string format) obtained on attempt ${attempt}`)
            return instance.qrcode
          }

          // Si la instancia ya está conectada, no habrá QR
          if (instance?.connectionStatus === 'open') {
            console.log(`ℹ️ Instance already connected, no QR needed`)
            return null
          }
        }

        // Esperar antes del siguiente intento (aumentar gradualmente el tiempo)
        const waitTime = Math.min(1000 + (attempt * 500), 3000)
        await new Promise(resolve => setTimeout(resolve, waitTime))

      } catch (error: any) {
        console.error(`❌ Error on attempt ${attempt}: ${error.message}`)
        if (attempt === maxRetries) {
          throw error
        }
      }
    }

    console.log(`⚠️ No QR code available after ${maxRetries} attempts`)
    return null
  }

  /**
   * Verificar estado de conexión de una instancia
   */
  async getInstanceStatus(instanceName: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': this.apiKey,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to get instance status: ${error}`)
      }

      const data = await response.json()
      return data
    } catch (error: any) {
      console.error(`❌ Error getting instance status: ${error.message}`)
      throw error
    }
  }

  /**
   * Enviar mensaje de texto
   */
  async sendTextMessage(params: SendMessageParams): Promise<boolean> {
    try {
      console.log(`💬 Sending WhatsApp message to: ${params.number}`)

      const response = await fetch(`${this.apiUrl}/message/sendText/${params.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
        body: JSON.stringify({
          number: params.number,
          text: params.text,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to send message: ${error}`)
      }

      const data = await response.json()
      console.log(`✅ Message sent successfully`)

      return true
    } catch (error: any) {
      console.error(`❌ Error sending message: ${error.message}`)
      return false
    }
  }

  /**
   * Eliminar una instancia
   */
  async deleteInstance(instanceName: string): Promise<boolean> {
    try {
      console.log(`🗑️ Deleting instance: ${instanceName}`)

      const response = await fetch(`${this.apiUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.apiKey,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to delete instance: ${error}`)
      }

      console.log(`✅ Instance deleted successfully`)
      return true
    } catch (error: any) {
      console.error(`❌ Error deleting instance: ${error.message}`)
      return false
    }
  }

  /**
   * Desconectar una instancia (logout)
   */
  async logoutInstance(instanceName: string): Promise<boolean> {
    try {
      console.log(`👋 Logging out instance: ${instanceName}`)

      const response = await fetch(`${this.apiUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: {
          'apikey': this.apiKey,
        },
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to logout instance: ${error}`)
      }

      console.log(`✅ Instance logged out successfully`)
      return true
    } catch (error: any) {
      console.error(`❌ Error logging out instance: ${error.message}`)
      return false
    }
  }
}

/**
 * Helper para enviar notificaciones de planillas
 */
export class PlanillaWhatsAppNotifier {
  private whatsappService: WhatsAppService

  constructor(apiUrl?: string, apiKey?: string) {
    this.whatsappService = new WhatsAppService(apiUrl, apiKey)
  }

  /**
   * Notificar creación de planilla al aprobador
   */
  async notifyPlanillaCreated(params: {
    instanceName: string
    approverPhone: string
    userName: string
    totalAmount: number
    planillaId: string
  }): Promise<boolean> {
    const message = `🚗 *Nueva Planilla de Movilidad*

📋 Usuario: *${params.userName}*
💰 Monto Total: *S/ ${params.totalAmount.toFixed(2)}*

⏳ Pendiente de aprobación

👉 Ingresa al sistema para revisar y aprobar:
https://cockpit.azaleia.com.pe/aprobacion-planillas`

    return this.whatsappService.sendTextMessage({
      instanceName: params.instanceName,
      number: params.approverPhone,
      text: message,
    })
  }

  /**
   * Notificar aprobación de planilla al usuario
   */
  async notifyPlanillaApproved(params: {
    instanceName: string
    userPhone: string
    approverName: string
    totalAmount: number
    planillaId: string
  }): Promise<boolean> {
    const message = `✅ *Planilla de Movilidad APROBADA*

👤 Aprobada por: *${params.approverName}*
💰 Monto: *S/ ${params.totalAmount.toFixed(2)}*

🎉 Tu planilla ha sido aprobada exitosamente

👉 Ver detalles:
https://cockpit.azaleia.com.pe`

    return this.whatsappService.sendTextMessage({
      instanceName: params.instanceName,
      number: params.userPhone,
      text: message,
    })
  }

  /**
   * Notificar rechazo de planilla al usuario
   */
  async notifyPlanillaRejected(params: {
    instanceName: string
    userPhone: string
    approverName: string
    totalAmount: number
    reason?: string
    planillaId: string
  }): Promise<boolean> {
    const message = `❌ *Planilla de Movilidad RECHAZADA*

👤 Rechazada por: *${params.approverName}*
💰 Monto: *S/ ${params.totalAmount.toFixed(2)}*
${params.reason ? `\n📝 Motivo: ${params.reason}` : ''}

Por favor, revisa los detalles y vuelve a enviar

👉 Ver detalles:
https://cockpit.azaleia.com.pe`

    return this.whatsappService.sendTextMessage({
      instanceName: params.instanceName,
      number: params.userPhone,
      text: message,
    })
  }
}
