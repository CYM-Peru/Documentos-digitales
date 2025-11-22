interface N8nWebhookData {
  invoiceId: string
  organizationId: string
  vendorName?: string
  invoiceNumber?: string
  totalAmount?: number
  status: string
  imageUrl: string
}

export class N8nService {
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  async sendInvoiceProcessed(data: N8nWebhookData): Promise<string | null> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'invoice.processed',
          data,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`n8n webhook failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result.executionId || null
    } catch (error) {
      console.error('Error sending to n8n webhook:', error)
      return null
    }
  }

  async sendInvoiceFailed(data: N8nWebhookData & { error: string }): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'invoice.failed',
          data,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.error('Error sending failure to n8n webhook:', error)
    }
  }
}
