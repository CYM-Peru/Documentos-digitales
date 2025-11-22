import AWS from 'aws-sdk'

interface TextractCredentials {
  awsAccessKey: string
  awsSecretKey: string
  awsRegion: string
}

interface ExtractedData {
  vendorName?: string
  invoiceNumber?: string
  invoiceDate?: Date
  totalAmount?: number
  currency?: string
  taxAmount?: number
  rawData: any
}

export class TextractService {
  private textract: AWS.Textract

  constructor(credentials: TextractCredentials) {
    console.log('TextractService - Initializing with credentials:', {
      accessKeyId: credentials.awsAccessKey ? 'PROVIDED (length: ' + credentials.awsAccessKey.length + ')' : 'MISSING',
      secretAccessKey: credentials.awsSecretKey ? 'PROVIDED (length: ' + credentials.awsSecretKey.length + ')' : 'MISSING',
      region: credentials.awsRegion || 'MISSING',
    })

    this.textract = new AWS.Textract({
      accessKeyId: credentials.awsAccessKey,
      secretAccessKey: credentials.awsSecretKey,
      region: credentials.awsRegion,
    })
  }

  async analyzeInvoice(imageBuffer: Buffer): Promise<ExtractedData> {
    try {
      const params = {
        Document: {
          Bytes: imageBuffer,
        },
        FeatureTypes: ['FORMS', 'TABLES'],
      }

      const result = await this.textract.analyzeDocument(params).promise()

      return this.extractInvoiceData(result)
    } catch (error) {
      console.error('Textract analysis error:', error)
      throw new Error('Failed to analyze invoice with AWS Textract')
    }
  }

  async analyzeExpense(imageBuffer: Buffer): Promise<ExtractedData> {
    try {
      const params = {
        Document: {
          Bytes: imageBuffer,
        },
      }

      const result = await this.textract.analyzeExpense(params).promise()

      return this.extractExpenseData(result)
    } catch (error) {
      console.error('Textract expense analysis error:', error)
      throw new Error('Failed to analyze expense with AWS Textract')
    }
  }

  private extractInvoiceData(result: any): ExtractedData {
    const data: ExtractedData = {
      rawData: result,
    }

    // Extract key-value pairs from forms
    if (result.Blocks) {
      const keyValuePairs = this.extractKeyValuePairs(result.Blocks)

      // Try to find common invoice fields
      for (const [key, value] of Object.entries(keyValuePairs)) {
        const keyLower = key.toLowerCase()

        if (keyLower.includes('vendor') || keyLower.includes('supplier') || keyLower.includes('from')) {
          data.vendorName = value
        } else if (keyLower.includes('invoice') && keyLower.includes('number')) {
          data.invoiceNumber = value
        } else if (keyLower.includes('date')) {
          data.invoiceDate = this.parseDate(value)
        } else if (keyLower.includes('total') || keyLower.includes('amount')) {
          const amount = this.parseAmount(value)
          if (amount) data.totalAmount = amount
        } else if (keyLower.includes('tax')) {
          const taxAmount = this.parseAmount(value)
          if (taxAmount) data.taxAmount = taxAmount
        }
      }
    }

    return data
  }

  private extractExpenseData(result: any): ExtractedData {
    const data: ExtractedData = {
      rawData: result,
    }

    if (result.ExpenseDocuments && result.ExpenseDocuments.length > 0) {
      const expense = result.ExpenseDocuments[0]

      // Extract summary fields
      if (expense.SummaryFields) {
        for (const field of expense.SummaryFields) {
          const type = field.Type?.Text?.toLowerCase() || ''
          const value = field.ValueDetection?.Text || ''

          if (type.includes('vendor') || type.includes('name')) {
            data.vendorName = value
          } else if (type.includes('invoice_receipt_id')) {
            data.invoiceNumber = value
          } else if (type.includes('invoice_receipt_date')) {
            data.invoiceDate = this.parseDate(value)
          } else if (type.includes('total')) {
            data.totalAmount = this.parseAmount(value)
          } else if (type.includes('tax')) {
            data.taxAmount = this.parseAmount(value)
          }
        }
      }
    }

    return data
  }

  private extractKeyValuePairs(blocks: any[]): Record<string, string> {
    const keyValuePairs: Record<string, string> = {}
    const keyMap: Map<string, any> = new Map()
    const valueMap: Map<string, any> = new Map()
    const blockMap: Map<string, any> = new Map()

    // Build block map
    for (const block of blocks) {
      blockMap.set(block.Id, block)
      if (block.BlockType === 'KEY_VALUE_SET') {
        if (block.EntityTypes?.includes('KEY')) {
          keyMap.set(block.Id, block)
        } else {
          valueMap.set(block.Id, block)
        }
      }
    }

    // Match keys with values
    for (const [keyId, keyBlock] of keyMap.entries()) {
      const valueBlock = this.getValueBlock(keyBlock, valueMap)
      const key = this.getText(keyBlock, blockMap)
      const value = valueBlock ? this.getText(valueBlock, blockMap) : ''

      if (key && value) {
        keyValuePairs[key] = value
      }
    }

    return keyValuePairs
  }

  private getValueBlock(keyBlock: any, valueMap: Map<string, any>): any {
    if (!keyBlock.Relationships) return null

    for (const relationship of keyBlock.Relationships) {
      if (relationship.Type === 'VALUE') {
        for (const valueId of relationship.Ids) {
          return valueMap.get(valueId)
        }
      }
    }
    return null
  }

  private getText(block: any, blockMap: Map<string, any>): string {
    if (!block.Relationships) return ''

    let text = ''
    for (const relationship of block.Relationships) {
      if (relationship.Type === 'CHILD') {
        for (const childId of relationship.Ids) {
          const childBlock = blockMap.get(childId)
          if (childBlock && childBlock.BlockType === 'WORD') {
            text += childBlock.Text + ' '
          }
        }
      }
    }
    return text.trim()
  }

  private parseDate(dateStr: string): Date | undefined {
    try {
      const date = new Date(dateStr)
      return isNaN(date.getTime()) ? undefined : date
    } catch {
      return undefined
    }
  }

  private parseAmount(amountStr: string): number | undefined {
    try {
      // Remove currency symbols and commas
      const cleaned = amountStr.replace(/[^0-9.-]/g, '')
      const amount = parseFloat(cleaned)
      return isNaN(amount) ? undefined : amount
    } catch {
      return undefined
    }
  }
}
