import { google } from 'googleapis'

interface GoogleCredentials {
  serviceAccount: any // JSON object
  sheetsId: string
  driveFolderId?: string
}

interface InvoiceData {
  id: string
  vendorName?: string
  invoiceNumber?: string
  invoiceDate?: Date
  totalAmount?: number
  currency?: string
  taxAmount?: number
  imageUrl: string
  createdAt: Date
  status?: string
  // Campos específicos para facturas peruanas
  documentType?: string
  documentTypeCode?: string
  rucEmisor?: string
  razonSocialEmisor?: string
  domicilioFiscalEmisor?: string
  rucReceptor?: string
  dniReceptor?: string
  razonSocialReceptor?: string
  serieNumero?: string
  subtotal?: number
  igvTasa?: number
  igvMonto?: number
  // Verificación SUNAT
  sunatVerified?: boolean
  sunatEstadoCp?: string
  sunatEstadoRuc?: string
  sunatObservaciones?: any
  sunatVerifiedAt?: Date
  // Usuario
  userName?: string
  userEmail?: string
}

export class GoogleSheetsService {
  private sheets: any
  private drive: any
  private sheetsId: string
  private driveFolderId?: string
  private invoicesSheetId: number | null = null

  constructor(credentials: GoogleCredentials) {
    const auth = new google.auth.GoogleAuth({
      credentials: credentials.serviceAccount,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ],
    })

    this.sheets = google.sheets({ version: 'v4', auth })
    this.drive = google.drive({ version: 'v3', auth })
    this.sheetsId = credentials.sheetsId
    this.driveFolderId = credentials.driveFolderId
  }

  private async getInvoicesSheetId(): Promise<number> {
    if (this.invoicesSheetId !== null) {
      return this.invoicesSheetId
    }

    const spreadsheet = await this.sheets.spreadsheets.get({
      spreadsheetId: this.sheetsId,
    })

    const invoicesSheet = spreadsheet.data.sheets?.find(
      (sheet: any) => sheet.properties?.title === 'Invoices'
    )

    if (!invoicesSheet || typeof invoicesSheet.properties?.sheetId !== 'number') {
      throw new Error('Invoices sheet not found or invalid sheetId')
    }

    const sheetId: number = invoicesSheet.properties.sheetId
    this.invoicesSheetId = sheetId
    return sheetId
  }

  async appendInvoiceToUserSheet(invoice: InvoiceData, sheetName: string): Promise<number> {
    console.log(`📊 GoogleSheetsService.appendInvoiceToUserSheet - Iniciando en pestaña "${sheetName}"...`)
    try {
      console.log(`📊 GoogleSheetsService.appendInvoiceToUserSheet - Preparando datos para ${sheetName}...`)

      // 🔐 INTERPRETAR ESTADO SUNAT
      let estadoSunat = '⏳ PENDIENTE'
      let estadoCpDescripcion = ''
      let estadoRucDescripcion = ''

      if (invoice.sunatVerified === true) {
        estadoSunat = '✅ VÁLIDO'
      } else if (invoice.sunatVerified === false) {
        estadoSunat = '❌ NO VÁLIDO'
      }

      // Decodificar código Estado CP según SUNAT
      switch (invoice.sunatEstadoCp) {
        case '1':
          estadoCpDescripcion = '1 - VÁLIDO'
          break
        case '0':
          estadoCpDescripcion = '0 - NO EXISTE'
          break
        case '2':
          estadoCpDescripcion = '2 - ANULADO'
          break
        case '3':
          estadoCpDescripcion = '3 - RECHAZADO'
          break
        default:
          estadoCpDescripcion = invoice.sunatEstadoCp || ''
      }

      // Decodificar Estado RUC según SUNAT
      switch (invoice.sunatEstadoRuc) {
        case '00':
          estadoRucDescripcion = '00 - ACTIVO'
          break
        case '01':
          estadoRucDescripcion = '01 - BAJA PROVISIONAL'
          break
        case '02':
          estadoRucDescripcion = '02 - BAJA DEFINITIVA'
          break
        case '03':
          estadoRucDescripcion = '03 - BAJA DE OFICIO'
          break
        default:
          estadoRucDescripcion = invoice.sunatEstadoRuc || ''
      }

      // Formatear observaciones SUNAT
      let observaciones = ''
      if (invoice.sunatObservaciones && Array.isArray(invoice.sunatObservaciones)) {
        observaciones = invoice.sunatObservaciones.join('; ')
      }

      // Función helper para convertir fecha a hora de Perú (UTC-5)
      const toPeruTime = (date: Date): string => {
        const peruDate = new Date(date.getTime() - (5 * 60 * 60 * 1000)) // UTC-5
        return peruDate.toISOString().replace('T', ' ').substring(0, 19)
      }

      // Formatear fecha de verificación SUNAT
      const fechaVerificacion = invoice.sunatVerifiedAt
        ? toPeruTime(invoice.sunatVerifiedAt)
        : ''

      // Formatear usuario
      const usuario = invoice.userName || invoice.userEmail || ''

      const values = [
        [
          // ═══ IDENTIFICACIÓN ═══
          invoice.id,
          toPeruTime(invoice.createdAt),
          invoice.status || 'COMPLETED',

          // ═══ VERIFICACIÓN SUNAT ═══
          estadoSunat,
          estadoCpDescripcion,
          estadoRucDescripcion,
          observaciones,
          fechaVerificacion,

          // ═══ COMPROBANTE ═══
          invoice.documentType || '',
          invoice.documentTypeCode || '',
          invoice.serieNumero || invoice.invoiceNumber || '',
          invoice.invoiceDate ? toPeruTime(invoice.invoiceDate).split(' ')[0] : '',

          // ═══ EMISOR ═══
          invoice.rucEmisor || '',
          invoice.razonSocialEmisor || invoice.vendorName || '',
          invoice.domicilioFiscalEmisor || '',

          // ═══ RECEPTOR ═══
          invoice.rucReceptor || '',
          invoice.dniReceptor || '',
          invoice.razonSocialReceptor || '',

          // ═══ MONTOS ═══
          invoice.subtotal || '',
          invoice.igvTasa || '',
          invoice.igvMonto || invoice.taxAmount || '',
          invoice.totalAmount || '',
          invoice.currency || 'PEN',

          // ═══ METADATA ═══
          usuario,
          invoice.imageUrl,
        ],
      ]

      console.log(`📊 GoogleSheetsService.appendInvoiceToUserSheet - Enviando a Sheets API en pestaña ${sheetName}...`, {
        sheetsId: this.sheetsId,
        range: `${sheetName}!A:Y`,
        rowLength: values[0].length
      })

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetsId,
        range: `${sheetName}!A:Y`, // 25 columnas A-Y
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values },
      })

      console.log(`📊 GoogleSheetsService.appendInvoiceToUserSheet - Respuesta recibida para ${sheetName}:`, response.data.updates)

      // Extract row number from the update range
      const updatedRange = response.data.updates?.updatedRange || ''
      console.log(`📊 GoogleSheetsService.appendInvoiceToUserSheet - updatedRange:`, updatedRange)

      const match = updatedRange.match(/![A-Z]+(\d+):/)
      const rowId = match ? parseInt(match[1]) : 0

      console.log(`✅ GoogleSheetsService.appendInvoiceToUserSheet - Completado en ${sheetName}! Row ID:`, rowId)
      return rowId
    } catch (error) {
      console.error(`❌ GoogleSheetsService.appendInvoiceToUserSheet - ERROR en ${sheetName}:`, error)
      console.error('❌ Error completo:', JSON.stringify(error, null, 2))
      throw new Error(`Failed to append invoice to Google Sheets (${sheetName})`)
    }
  }

  async appendInvoice(invoice: InvoiceData): Promise<number> {
    console.log('📊 GoogleSheetsService.appendInvoice - Iniciando...')
    try {
      console.log('📊 GoogleSheetsService.appendInvoice - Preparando datos...')
      // 🔐 INTERPRETAR ESTADO SUNAT
      let estadoSunat = '⏳ PENDIENTE'
      let estadoCpDescripcion = ''
      let estadoRucDescripcion = ''

      if (invoice.sunatVerified === true) {
        estadoSunat = '✅ VÁLIDO'
      } else if (invoice.sunatVerified === false) {
        estadoSunat = '❌ NO VÁLIDO'
      }

      // Decodificar código Estado CP según SUNAT
      switch (invoice.sunatEstadoCp) {
        case '1':
          estadoCpDescripcion = '1 - VÁLIDO'
          break
        case '0':
          estadoCpDescripcion = '0 - NO EXISTE'
          break
        case '2':
          estadoCpDescripcion = '2 - ANULADO'
          break
        case '3':
          estadoCpDescripcion = '3 - RECHAZADO'
          break
        default:
          estadoCpDescripcion = invoice.sunatEstadoCp || ''
      }

      // Decodificar Estado RUC según SUNAT
      switch (invoice.sunatEstadoRuc) {
        case '00':
          estadoRucDescripcion = '00 - ACTIVO'
          break
        case '01':
          estadoRucDescripcion = '01 - BAJA PROVISIONAL'
          break
        case '02':
          estadoRucDescripcion = '02 - BAJA DEFINITIVA'
          break
        case '03':
          estadoRucDescripcion = '03 - BAJA DE OFICIO'
          break
        default:
          estadoRucDescripcion = invoice.sunatEstadoRuc || ''
      }

      // Formatear observaciones SUNAT
      let observaciones = ''
      if (invoice.sunatObservaciones && Array.isArray(invoice.sunatObservaciones)) {
        observaciones = invoice.sunatObservaciones.join('; ')
      }

      // Función helper para convertir fecha a hora de Perú (UTC-5)
      const toPeruTime = (date: Date): string => {
        const peruDate = new Date(date.getTime() - (5 * 60 * 60 * 1000)) // UTC-5
        return peruDate.toISOString().replace('T', ' ').substring(0, 19)
      }

      // Formatear fecha de verificación SUNAT
      const fechaVerificacion = invoice.sunatVerifiedAt
        ? toPeruTime(invoice.sunatVerifiedAt)
        : ''

      // Formatear usuario
      const usuario = invoice.userName || invoice.userEmail || ''

      const values = [
        [
          // ═══ IDENTIFICACIÓN ═══
          invoice.id,
          toPeruTime(invoice.createdAt),
          invoice.status || 'COMPLETED',

          // ═══ VERIFICACIÓN SUNAT ═══
          estadoSunat,
          estadoCpDescripcion,
          estadoRucDescripcion,
          observaciones,
          fechaVerificacion,

          // ═══ COMPROBANTE ═══
          invoice.documentType || '',
          invoice.documentTypeCode || '',
          invoice.serieNumero || invoice.invoiceNumber || '',
          invoice.invoiceDate ? toPeruTime(invoice.invoiceDate).split(' ')[0] : '',

          // ═══ EMISOR ═══
          invoice.rucEmisor || '',
          invoice.razonSocialEmisor || invoice.vendorName || '',
          invoice.domicilioFiscalEmisor || '',

          // ═══ RECEPTOR ═══
          invoice.rucReceptor || '',
          invoice.dniReceptor || '',
          invoice.razonSocialReceptor || '',

          // ═══ MONTOS ═══
          invoice.subtotal || '',
          invoice.igvTasa || '',
          invoice.igvMonto || invoice.taxAmount || '',
          invoice.totalAmount || '',
          invoice.currency || 'PEN',

          // ═══ METADATA ═══
          usuario,
          invoice.imageUrl,
        ],
      ]

      console.log('📊 GoogleSheetsService.appendInvoice - Enviando a Sheets API...', {
        sheetsId: this.sheetsId,
        range: 'Invoices!A:Y',
        rowLength: values[0].length
      })

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.sheetsId,
        range: 'Invoices!A:Y', // 25 columnas A-Y
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values },
      })

      console.log('📊 GoogleSheetsService.appendInvoice - Respuesta recibida:', response.data.updates)

      // Extract row number from the update range (e.g., "Invoices!A2:Y2" or "Invoices!S5:AQ5")
      const updatedRange = response.data.updates?.updatedRange || ''
      console.log('📊 GoogleSheetsService.appendInvoice - updatedRange:', updatedRange)

      // Match any column letter(s) followed by row number: !A2: or !S5: or !AA10:
      const match = updatedRange.match(/![A-Z]+(\d+):/)
      const rowId = match ? parseInt(match[1]) : 0

      console.log('📊 GoogleSheetsService.appendInvoice - Aplicando formato limpio a fila', rowId)

      // APLICAR FORMATO LIMPIO A LA FILA RECIÉN AGREGADA
      if (rowId > 0) {
        try {
          // Obtener el sheetId correcto de la hoja "Invoices"
          const sheetId = await this.getInvoicesSheetId()
          console.log('📊 GoogleSheetsService.appendInvoice - sheetId obtenido:', sheetId)

          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.sheetsId,
            resource: {
              requests: [
                {
                  repeatCell: {
                    range: {
                      sheetId: sheetId,
                      startRowIndex: rowId - 1, // 0-indexed
                      endRowIndex: rowId,
                    },
                    cell: {
                      userEnteredFormat: {
                        backgroundColor: {
                          red: 1.0,
                          green: 1.0,
                          blue: 1.0,
                        },
                        textFormat: {
                          foregroundColor: {
                            red: 0.0,
                            green: 0.0,
                            blue: 0.0,
                          },
                          fontSize: 10,
                          bold: false,
                        },
                        padding: {
                          top: 0,
                          bottom: 0,
                          left: 2,
                          right: 2,
                        },
                        verticalAlignment: 'MIDDLE',
                      },
                    },
                    fields: 'userEnteredFormat',
                  },
                },
                {
                  updateDimensionProperties: {
                    range: {
                      sheetId: sheetId,
                      dimension: 'ROWS',
                      startIndex: rowId - 1,
                      endIndex: rowId,
                    },
                    properties: {
                      pixelSize: 21,
                    },
                    fields: 'pixelSize',
                  },
                },
              ],
            },
          })
          console.log('✅ Formato limpio aplicado a fila', rowId)
        } catch (formatError) {
          console.error('⚠️ Error aplicando formato (no crítico):', formatError)
        }
      }

      console.log('✅ GoogleSheetsService.appendInvoice - Completado! Row ID:', rowId)
      return rowId
    } catch (error) {
      console.error('❌ GoogleSheetsService.appendInvoice - ERROR:', error)
      console.error('❌ Error completo:', JSON.stringify(error, null, 2))
      throw new Error('Failed to append invoice to Google Sheets')
    }
  }

  async uploadImageToDrive(
    imageBuffer: Buffer,
    fileName: string
  ): Promise<string> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: this.driveFolderId ? [this.driveFolderId] : undefined,
        },
        media: {
          mimeType: 'image/jpeg',
          body: require('stream').Readable.from(imageBuffer),
        },
        fields: 'id, webViewLink',
      })

      // Make file publicly accessible (optional)
      if (response.data.id) {
        await this.drive.permissions.create({
          fileId: response.data.id,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
        })
      }

      return response.data.webViewLink || ''
    } catch (error) {
      console.error('Error uploading to Google Drive:', error)
      throw new Error('Failed to upload image to Google Drive')
    }
  }

  async updateInvoice(rowId: number, invoice: InvoiceData): Promise<void> {
    console.log(`📊 GoogleSheetsService.updateInvoice - Actualizando fila ${rowId}...`)
    try {
      // Preparar los mismos datos que en appendInvoice
      let estadoSunat = '⏳ PENDIENTE'
      let estadoCpDescripcion = ''
      let estadoRucDescripcion = ''

      if (invoice.sunatVerified === true) {
        estadoSunat = '✅ VÁLIDO'
      } else if (invoice.sunatVerified === false) {
        estadoSunat = '❌ NO VÁLIDO'
      }

      switch (invoice.sunatEstadoCp) {
        case '1':
          estadoCpDescripcion = '1 - VÁLIDO'
          break
        case '0':
          estadoCpDescripcion = '0 - NO EXISTE'
          break
        case '2':
          estadoCpDescripcion = '2 - ANULADO'
          break
        case '3':
          estadoCpDescripcion = '3 - RECHAZADO'
          break
        default:
          estadoCpDescripcion = invoice.sunatEstadoCp || ''
      }

      switch (invoice.sunatEstadoRuc) {
        case '00':
          estadoRucDescripcion = '00 - ACTIVO'
          break
        case '01':
          estadoRucDescripcion = '01 - BAJA PROVISIONAL'
          break
        case '02':
          estadoRucDescripcion = '02 - BAJA DEFINITIVA'
          break
        case '03':
          estadoRucDescripcion = '03 - BAJA DE OFICIO'
          break
        default:
          estadoRucDescripcion = invoice.sunatEstadoRuc || ''
      }

      let observaciones = ''
      if (invoice.sunatObservaciones && Array.isArray(invoice.sunatObservaciones)) {
        observaciones = invoice.sunatObservaciones.join('; ')
      }

      const toPeruTime = (date: Date): string => {
        const peruDate = new Date(date.getTime() - (5 * 60 * 60 * 1000))
        return peruDate.toISOString().replace('T', ' ').substring(0, 19)
      }

      const fechaVerificacion = invoice.sunatVerifiedAt
        ? toPeruTime(invoice.sunatVerifiedAt)
        : ''

      const usuario = invoice.userName || invoice.userEmail || ''

      const values = [
        [
          invoice.id,
          toPeruTime(invoice.createdAt),
          invoice.status || 'COMPLETED',
          estadoSunat,
          estadoCpDescripcion,
          estadoRucDescripcion,
          observaciones,
          fechaVerificacion,
          invoice.documentType || '',
          invoice.documentTypeCode || '',
          invoice.serieNumero || invoice.invoiceNumber || '',
          invoice.invoiceDate ? toPeruTime(invoice.invoiceDate).split(' ')[0] : '',
          invoice.rucEmisor || '',
          invoice.razonSocialEmisor || invoice.vendorName || '',
          invoice.domicilioFiscalEmisor || '',
          invoice.rucReceptor || '',
          invoice.dniReceptor || '',
          invoice.razonSocialReceptor || '',
          invoice.subtotal || '',
          invoice.igvTasa || '',
          invoice.igvMonto || invoice.taxAmount || '',
          invoice.totalAmount || '',
          invoice.currency || 'PEN',
          usuario,
          invoice.imageUrl,
        ],
      ]

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range: `Invoices!A${rowId}:Y${rowId}`,
        valueInputOption: 'RAW',
        resource: { values },
      })

      console.log(`✅ GoogleSheetsService.updateInvoice - Fila ${rowId} actualizada`)
    } catch (error) {
      console.error(`❌ GoogleSheetsService.updateInvoice - ERROR:`, error)
      throw new Error('Failed to update invoice in Google Sheets')
    }
  }

  async createUserSheet(sheetName: string): Promise<void> {
    try {
      // Check if sheet exists
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetsId,
      })

      const sheetExists = spreadsheet.data.sheets?.some(
        (sheet: any) => sheet.properties?.title === sheetName
      )

      if (!sheetExists) {
        console.log(`📝 Creando pestaña "${sheetName}"...`)
        // Create the sheet
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetsId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName,
                  },
                },
              },
            ],
          },
        })

        // Get the new sheet ID
        const updatedSpreadsheet = await this.sheets.spreadsheets.get({
          spreadsheetId: this.sheetsId,
        })

        const newSheet = updatedSpreadsheet.data.sheets?.find(
          (sheet: any) => sheet.properties?.title === sheetName
        )

        const newSheetId = newSheet?.properties?.sheetId || 0

        // Add header row with the same structure as Invoices
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetsId,
          range: `${sheetName}!A1:Y1`,
          valueInputOption: 'RAW',
          resource: {
            values: [
              [
                // ═══ IDENTIFICACIÓN ═══
                'ID',
                'Fecha Registro',
                'Estado Procesamiento',

                // ═══ VERIFICACIÓN SUNAT ═══
                '✅ Estado SUNAT',
                '📋 Código Estado CP',
                '🏢 Estado RUC',
                '⚠️ Observaciones SUNAT',
                '📅 Fecha Verificación SUNAT',

                // ═══ COMPROBANTE ═══
                '📄 Tipo Documento',
                '🔢 Código SUNAT',
                '📌 Serie-Número',
                '📆 Fecha Emisión',

                // ═══ EMISOR ═══
                '🏭 RUC Emisor',
                '🏢 Razón Social Emisor',
                '📍 Domicilio Fiscal Emisor',

                // ═══ RECEPTOR ═══
                '🏢 RUC Receptor',
                '🆔 DNI Receptor',
                '👤 Razón Social Receptor',

                // ═══ MONTOS ═══
                '💵 OP Gravada',
                '📊 IGV Tasa %',
                '💰 IGV Monto',
                '💸 Total a Pagar',
                '💱 Moneda',

                // ═══ METADATA ═══
                '👤 Usuario',
                '🖼️ Imagen URL',
              ],
            ],
          },
        })

        // Format header row and data rows
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetsId,
          resource: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: newSheetId,
                    startRowIndex: 0,
                    endRowIndex: 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 0.2,
                        green: 0.4,
                        blue: 0.8,
                      },
                      textFormat: {
                        foregroundColor: {
                          red: 1.0,
                          green: 1.0,
                          blue: 1.0,
                        },
                        fontSize: 10,
                        bold: true,
                      },
                      padding: {
                        top: 4,
                        bottom: 4,
                        left: 4,
                        right: 4,
                      },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                  fields: 'userEnteredFormat',
                },
              },
              {
                repeatCell: {
                  range: {
                    sheetId: newSheetId,
                    startRowIndex: 1,
                    endRowIndex: 1000,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 1.0,
                        green: 1.0,
                        blue: 1.0,
                      },
                      textFormat: {
                        foregroundColor: {
                          red: 0.0,
                          green: 0.0,
                          blue: 0.0,
                        },
                        fontSize: 10,
                        bold: false,
                      },
                      padding: {
                        top: 0,
                        bottom: 0,
                        left: 2,
                        right: 2,
                      },
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,padding,verticalAlignment)',
                },
              },
              {
                updateDimensionProperties: {
                  range: {
                    sheetId: newSheetId,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: 1000,
                  },
                  properties: {
                    pixelSize: 21,
                  },
                  fields: 'pixelSize',
                },
              },
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: newSheetId,
                    gridProperties: {
                      frozenRowCount: 1,
                    },
                  },
                  fields: 'gridProperties.frozenRowCount',
                },
              },
            ],
          },
        })

        console.log(`✅ Pestaña "${sheetName}" creada exitosamente`)
      } else {
        console.log(`✓ Pestaña "${sheetName}" ya existe`)
      }
    } catch (error) {
      console.error(`Error creating ${sheetName} sheet:`, error)
      throw new Error(`Failed to create ${sheetName} sheet`)
    }
  }

  async createInvoicesSheet(): Promise<void> {
    try {
      // Check if "Invoices" sheet exists
      const spreadsheet = await this.sheets.spreadsheets.get({
        spreadsheetId: this.sheetsId,
      })

      const sheetExists = spreadsheet.data.sheets?.some(
        (sheet: any) => sheet.properties?.title === 'Invoices'
      )

      if (!sheetExists) {
        // Create the sheet
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetsId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'Invoices',
                  },
                },
              },
            ],
          },
        })

        // Add header row con nuevo orden SINCRONIZADO CON SUNAT
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetsId,
          range: 'Invoices!A1:Y1',
          valueInputOption: 'RAW',
          resource: {
            values: [
              [
                // ═══ IDENTIFICACIÓN ═══
                'ID',
                'Fecha Registro',
                'Estado Procesamiento',

                // ═══ VERIFICACIÓN SUNAT ═══
                '✅ Estado SUNAT',
                '📋 Código Estado CP',
                '🏢 Estado RUC',
                '⚠️ Observaciones SUNAT',
                '📅 Fecha Verificación SUNAT',

                // ═══ COMPROBANTE ═══
                '📄 Tipo Documento',
                '🔢 Código SUNAT',
                '📌 Serie-Número',
                '📆 Fecha Emisión',

                // ═══ EMISOR ═══
                '🏭 RUC Emisor',
                '🏢 Razón Social Emisor',
                '📍 Domicilio Fiscal Emisor',

                // ═══ RECEPTOR ═══
                '🏢 RUC Receptor',
                '🆔 DNI Receptor',
                '👤 Razón Social Receptor',

                // ═══ MONTOS ═══
                '💵 OP Gravada',
                '📊 IGV Tasa %',
                '💰 IGV Monto',
                '💸 Total a Pagar',
                '💱 Moneda',

                // ═══ METADATA ═══
                '👤 Usuario',
                '🖼️ Imagen URL',
              ],
            ],
          },
        })

        // Format header row con colores y estilos + formato compacto para filas
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.sheetsId,
          resource: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 0.2,
                        green: 0.4,
                        blue: 0.8,
                      },
                      textFormat: {
                        foregroundColor: {
                          red: 1.0,
                          green: 1.0,
                          blue: 1.0,
                        },
                        fontSize: 10,
                        bold: true,
                      },
                      padding: {
                        top: 4,
                        bottom: 4,
                        left: 4,
                        right: 4,
                      },
                      horizontalAlignment: 'CENTER',
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                  fields: 'userEnteredFormat',
                },
              },
              {
                // Formato LIMPIO para filas de datos (sin colores, sin negritas, sin padding)
                repeatCell: {
                  range: {
                    sheetId: 0,
                    startRowIndex: 1,
                    endRowIndex: 1000,
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: {
                        red: 1.0,
                        green: 1.0,
                        blue: 1.0,
                      },
                      textFormat: {
                        foregroundColor: {
                          red: 0.0,
                          green: 0.0,
                          blue: 0.0,
                        },
                        fontSize: 10,
                        bold: false,
                      },
                      padding: {
                        top: 0,
                        bottom: 0,
                        left: 2,
                        right: 2,
                      },
                      verticalAlignment: 'MIDDLE',
                    },
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat,padding,verticalAlignment)',
                },
              },
              {
                // Altura de filas compacta
                updateDimensionProperties: {
                  range: {
                    sheetId: 0,
                    dimension: 'ROWS',
                    startIndex: 1,
                    endIndex: 1000,
                  },
                  properties: {
                    pixelSize: 21,
                  },
                  fields: 'pixelSize',
                },
              },
              {
                updateSheetProperties: {
                  properties: {
                    sheetId: 0,
                    gridProperties: {
                      frozenRowCount: 1,
                    },
                  },
                  fields: 'gridProperties.frozenRowCount',
                },
              },
            ],
          },
        })
      }
    } catch (error) {
      console.error('Error creating Invoices sheet:', error)
      throw new Error('Failed to create Invoices sheet')
    }
  }
}
