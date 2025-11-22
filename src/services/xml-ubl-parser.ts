import { parseStringPromise } from 'xml2js'

/**
 * Datos extraídos de un XML UBL 2.1
 */
export interface UBLInvoiceData {
  // Datos del comprobante
  serieNumero: string // F066-3005
  invoiceTypeCode: string // 01=Factura, 03=Boleta, etc
  issueDate: string // 2025-11-14
  documentCurrencyCode: string // PEN, USD, etc

  // Emisor
  rucEmisor: string
  razonSocialEmisor: string
  nombreComercialEmisor?: string
  direccionEmisor?: string

  // Receptor
  rucReceptor?: string
  tipoDocumentoReceptor?: string // 6=RUC, 1=DNI, etc
  razonSocialReceptor?: string
  direccionReceptor?: string

  // Montos
  subtotal: number // Base imponible (sin IGV)
  igv: number // Monto del IGV
  total: number // Total a pagar
  descuentoGlobal?: number
  otrosCargos?: number

  // Items/Líneas de la factura
  items: UBLInvoiceItem[]

  // Información adicional
  formaPago?: string // Contado, Crédito, etc
  observaciones?: string
  ordenCompra?: string

  // Datos técnicos
  firmadoDigitalmente: boolean
  certificadoEmisor?: string
}

export interface UBLInvoiceItem {
  numeroLinea: number
  codigoProducto?: string
  descripcion: string
  cantidad: number
  unidadMedida: string
  precioUnitario: number
  valorVenta: number // Sin IGV
  igv: number
  precioTotal: number // Con IGV
  tasaIgv?: number // 18%
}

/**
 * Parser de XML UBL 2.1 para facturas electrónicas SUNAT
 */
export class UBLXMLParser {
  /**
   * Parsea un XML UBL 2.1 y extrae todos los datos de la factura
   */
  static async parseInvoiceXML(xmlContent: string): Promise<UBLInvoiceData> {
    try {
      // Parsear XML a objeto JavaScript
      const result = await parseStringPromise(xmlContent, {
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [this.stripNamespaces],
        attrNameProcessors: [this.stripNamespaces],
      })

      // El root puede ser "Invoice" o tener namespace
      const invoice = result.Invoice || result

      return {
        // Datos del comprobante
        serieNumero: this.extractText(invoice.ID),
        invoiceTypeCode: this.extractText(invoice.InvoiceTypeCode),
        issueDate: this.extractText(invoice.IssueDate),
        documentCurrencyCode: this.extractText(invoice.DocumentCurrencyCode) || 'PEN',

        // Emisor
        rucEmisor: this.extractSupplierRuc(invoice),
        razonSocialEmisor: this.extractSupplierName(invoice),
        nombreComercialEmisor: this.extractSupplierTradeName(invoice),
        direccionEmisor: this.extractSupplierAddress(invoice),

        // Receptor
        rucReceptor: this.extractCustomerRuc(invoice),
        tipoDocumentoReceptor: this.extractCustomerDocumentType(invoice),
        razonSocialReceptor: this.extractCustomerName(invoice),
        direccionReceptor: this.extractCustomerAddress(invoice),

        // Montos
        subtotal: this.extractSubtotal(invoice),
        igv: this.extractIGV(invoice),
        total: this.extractTotal(invoice),
        descuentoGlobal: this.extractGlobalDiscount(invoice),
        otrosCargos: this.extractOtherCharges(invoice),

        // Items
        items: this.extractItems(invoice),

        // Información adicional
        formaPago: this.extractPaymentTerms(invoice),
        observaciones: this.extractNotes(invoice),
        ordenCompra: this.extractPurchaseOrder(invoice),

        // Datos técnicos
        firmadoDigitalmente: this.hasDigitalSignature(xmlContent),
        certificadoEmisor: this.extractCertificateInfo(xmlContent),
      }
    } catch (error: any) {
      console.error('❌ Error al parsear XML UBL:', error.message)
      throw new Error(`Failed to parse UBL XML: ${error.message}`)
    }
  }

  /**
   * Remueve namespaces de los tags XML (cbc:ID -> ID, cac:Party -> Party)
   */
  private static stripNamespaces(name: string): string {
    return name.replace(/^.*:/, '')
  }

  /**
   * Extrae texto de un campo, manejando diferentes estructuras
   */
  private static extractText(field: any): string {
    if (!field) return ''
    if (typeof field === 'string') return field
    if (field._) return field._ // Cuando tiene atributos: { _: 'valor', $: { attr: 'x' } }
    if (field['#text']) return field['#text']
    return String(field)
  }

  /**
   * Extrae RUC del emisor
   */
  private static extractSupplierRuc(invoice: any): string {
    try {
      const supplier = invoice.AccountingSupplierParty?.Party
      if (!supplier) return ''

      // Buscar en PartyIdentification
      const partyId = Array.isArray(supplier.PartyIdentification)
        ? supplier.PartyIdentification[0]
        : supplier.PartyIdentification

      return this.extractText(partyId?.ID) || ''
    } catch {
      return ''
    }
  }

  /**
   * Extrae razón social del emisor
   */
  private static extractSupplierName(invoice: any): string {
    try {
      const supplier = invoice.AccountingSupplierParty?.Party
      return this.extractText(supplier?.PartyLegalEntity?.RegistrationName) || ''
    } catch {
      return ''
    }
  }

  /**
   * Extrae nombre comercial del emisor
   */
  private static extractSupplierTradeName(invoice: any): string {
    try {
      const supplier = invoice.AccountingSupplierParty?.Party
      return this.extractText(supplier?.PartyName?.Name) || ''
    } catch {
      return ''
    }
  }

  /**
   * Extrae dirección del emisor
   */
  private static extractSupplierAddress(invoice: any): string {
    try {
      const supplier = invoice.AccountingSupplierParty?.Party
      const address = supplier?.PartyLegalEntity?.RegistrationAddress

      if (!address) return ''

      const parts = [
        this.extractText(address.AddressLine?.Line),
        this.extractText(address.CitySubdivisionName),
        this.extractText(address.CityName),
        this.extractText(address.District),
        this.extractText(address.CountrySubentity),
      ].filter(Boolean)

      return parts.join(', ')
    } catch {
      return ''
    }
  }

  /**
   * Extrae RUC/DNI del receptor
   */
  private static extractCustomerRuc(invoice: any): string {
    try {
      const customer = invoice.AccountingCustomerParty?.Party
      if (!customer) return ''

      const partyId = Array.isArray(customer.PartyIdentification)
        ? customer.PartyIdentification[0]
        : customer.PartyIdentification

      return this.extractText(partyId?.ID) || ''
    } catch {
      return ''
    }
  }

  /**
   * Extrae tipo de documento del receptor
   */
  private static extractCustomerDocumentType(invoice: any): string {
    try {
      const customer = invoice.AccountingCustomerParty?.Party
      const partyId = Array.isArray(customer.PartyIdentification)
        ? customer.PartyIdentification[0]
        : customer.PartyIdentification

      return this.extractText(partyId?.ID?.$?.schemeID) || '6'
    } catch {
      return '6'
    }
  }

  /**
   * Extrae razón social del receptor
   */
  private static extractCustomerName(invoice: any): string {
    try {
      const customer = invoice.AccountingCustomerParty?.Party
      return this.extractText(customer?.PartyLegalEntity?.RegistrationName) || ''
    } catch {
      return ''
    }
  }

  /**
   * Extrae dirección del receptor
   */
  private static extractCustomerAddress(invoice: any): string {
    try {
      const customer = invoice.AccountingCustomerParty?.Party
      const address = customer?.PartyLegalEntity?.RegistrationAddress

      if (!address) return ''

      const parts = [
        this.extractText(address.AddressLine?.Line),
        this.extractText(address.CityName),
        this.extractText(address.District),
      ].filter(Boolean)

      return parts.join(', ')
    } catch {
      return ''
    }
  }

  /**
   * Extrae subtotal (base imponible sin IGV)
   */
  private static extractSubtotal(invoice: any): number {
    try {
      const monetary = invoice.LegalMonetaryTotal
      const taxExclusiveAmount = this.extractText(monetary?.TaxExclusiveAmount)
      return parseFloat(taxExclusiveAmount) || 0
    } catch {
      return 0
    }
  }

  /**
   * Extrae monto del IGV
   */
  private static extractIGV(invoice: any): number {
    try {
      const taxTotal = Array.isArray(invoice.TaxTotal)
        ? invoice.TaxTotal[0]
        : invoice.TaxTotal

      if (!taxTotal) return 0

      const taxAmount = this.extractText(taxTotal.TaxAmount)
      return parseFloat(taxAmount) || 0
    } catch {
      return 0
    }
  }

  /**
   * Extrae total a pagar
   */
  private static extractTotal(invoice: any): number {
    try {
      const monetary = invoice.LegalMonetaryTotal
      const payableAmount = this.extractText(monetary?.PayableAmount)
      return parseFloat(payableAmount) || 0
    } catch {
      return 0
    }
  }

  /**
   * Extrae descuento global
   */
  private static extractGlobalDiscount(invoice: any): number {
    try {
      const monetary = invoice.LegalMonetaryTotal
      const allowanceTotalAmount = this.extractText(monetary?.AllowanceTotalAmount)
      return parseFloat(allowanceTotalAmount) || 0
    } catch {
      return 0
    }
  }

  /**
   * Extrae otros cargos
   */
  private static extractOtherCharges(invoice: any): number {
    try {
      const monetary = invoice.LegalMonetaryTotal
      const chargeTotalAmount = this.extractText(monetary?.ChargeTotalAmount)
      return parseFloat(chargeTotalAmount) || 0
    } catch {
      return 0
    }
  }

  /**
   * Extrae los items/líneas de la factura
   */
  private static extractItems(invoice: any): UBLInvoiceItem[] {
    try {
      let lines = invoice.InvoiceLine
      if (!lines) return []

      // Asegurar que sea un array
      if (!Array.isArray(lines)) {
        lines = [lines]
      }

      return lines.map((line: any) => {
        const item = line.Item
        const price = line.Price
        const quantity = parseFloat(this.extractText(line.InvoicedQuantity)) || 0
        const unitCode = this.extractText(line.InvoicedQuantity?.$?.unitCode) || 'NIU'

        // Calcular montos
        const precioUnitario = parseFloat(this.extractText(price?.PriceAmount)) || 0
        const valorVenta = parseFloat(this.extractText(line.LineExtensionAmount)) || 0

        // Extraer IGV del item
        const taxTotal = Array.isArray(line.TaxTotal) ? line.TaxTotal[0] : line.TaxTotal
        const igv = parseFloat(this.extractText(taxTotal?.TaxAmount)) || 0

        const precioTotal = valorVenta + igv

        return {
          numeroLinea: parseInt(this.extractText(line.ID)) || 0,
          codigoProducto: this.extractText(item?.SellersItemIdentification?.ID),
          descripcion: this.extractText(item?.Description),
          cantidad: quantity,
          unidadMedida: unitCode,
          precioUnitario: precioUnitario,
          valorVenta: valorVenta,
          igv: igv,
          precioTotal: precioTotal,
          tasaIgv: 18, // Por defecto 18% en Perú
        }
      })
    } catch (error) {
      console.error('Error al extraer items:', error)
      return []
    }
  }

  /**
   * Extrae forma de pago
   */
  private static extractPaymentTerms(invoice: any): string {
    try {
      // Puede estar en varios lugares según el XML
      const paymentTerms = invoice.PaymentTerms
      if (!paymentTerms) return ''

      const note = this.extractText(paymentTerms.Note)
      return note
    } catch {
      return ''
    }
  }

  /**
   * Extrae observaciones/notas
   */
  private static extractNotes(invoice: any): string {
    try {
      let notes = invoice.Note
      if (!notes) return ''

      if (Array.isArray(notes)) {
        return notes.map((n) => this.extractText(n)).join('. ')
      }

      return this.extractText(notes)
    } catch {
      return ''
    }
  }

  /**
   * Extrae orden de compra
   */
  private static extractPurchaseOrder(invoice: any): string {
    try {
      return this.extractText(invoice.OrderReference?.ID) || ''
    } catch {
      return ''
    }
  }

  /**
   * Detecta si el XML tiene firma digital
   */
  private static hasDigitalSignature(xmlContent: string): boolean {
    return xmlContent.includes('<ds:Signature') || xmlContent.includes('<Signature')
  }

  /**
   * Extrae información básica del certificado
   */
  private static extractCertificateInfo(xmlContent: string): string {
    try {
      // Buscar el nombre del sujeto del certificado (CN=...)
      const cnMatch = xmlContent.match(/CN=([^,<]+)/)
      if (cnMatch) {
        return cnMatch[1]
      }
      return ''
    } catch {
      return ''
    }
  }

  /**
   * Valida que el XML sea un formato UBL válido
   */
  static isValidUBL(xmlContent: string): boolean {
    // Verificar que contenga elementos básicos de UBL
    const hasUBLNamespace = xmlContent.includes('urn:oasis:names:specification:ubl:schema')
    const hasInvoiceTag = xmlContent.includes('<Invoice') || xmlContent.includes(':Invoice')

    return hasUBLNamespace || hasInvoiceTag
  }

  /**
   * Extrae metadatos básicos sin parsear todo el XML (más rápido)
   */
  static async extractBasicInfo(xmlContent: string): Promise<{
    serieNumero: string
    rucEmisor: string
    total: number
  }> {
    try {
      // Extraer con regex para mayor velocidad
      const serieMatch = xmlContent.match(/<[^:]+:ID[^>]*>([^<]+)</)
      const rucMatch = xmlContent.match(/<[^:]+:PartyIdentification[^>]*>[\s\S]*?<[^:]+:ID[^>]*>(\d{11})</)
      const totalMatch = xmlContent.match(/<[^:]+:PayableAmount[^>]*>([0-9.]+)</)

      return {
        serieNumero: serieMatch ? serieMatch[1] : '',
        rucEmisor: rucMatch ? rucMatch[1] : '',
        total: totalMatch ? parseFloat(totalMatch[1]) : 0,
      }
    } catch {
      return { serieNumero: '', rucEmisor: '', total: 0 }
    }
  }
}
