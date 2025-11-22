import { PrismaClient } from '@prisma/client'
import { decryptObject } from '../src/lib/encryption'
import { google } from 'googleapis'

const prisma = new PrismaClient()

async function removeRowPadding() {
  try {
    console.log('🎨 AJUSTANDO FORMATO DE GOOGLE SHEETS\n')

    const settings = await prisma.organizationSettings.findFirst()

    if (!settings || !settings.googleServiceAccount || !settings.googleSheetsId) {
      console.log('❌ No hay configuración de Google Sheets')
      return
    }

    const auth = new google.auth.GoogleAuth({
      credentials: decryptObject(settings.googleServiceAccount) as any,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Obtener sheetId de la hoja "Invoices"
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: settings.googleSheetsId,
    })

    const invoicesSheet = spreadsheet.data.sheets?.find(
      (sheet: any) => sheet.properties?.title === 'Invoices'
    )

    if (!invoicesSheet) {
      console.log('❌ No se encontró la hoja Invoices')
      return
    }

    const sheetId = invoicesSheet.properties?.sheetId

    console.log('📝 Aplicando formato sin padding...')

    // Aplicar formato a TODAS las celdas (sin padding)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: settings.googleSheetsId,
      resource: {
        requests: [
          {
            // Formato para la fila de cabecera (mantener el azul)
            repeatCell: {
              range: {
                sheetId: sheetId,
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
              fields: 'userEnteredFormat(backgroundColor,textFormat,padding,horizontalAlignment,verticalAlignment)',
            },
          },
          {
            // Formato para las filas de datos (SIN padding, solo bordes)
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1, // Desde la fila 2 en adelante
                endRowIndex: 1000, // Hasta la fila 1000
              },
              cell: {
                userEnteredFormat: {
                  padding: {
                    top: 0,
                    bottom: 0,
                    left: 2,
                    right: 2,
                  },
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(padding,verticalAlignment)',
            },
          },
          {
            // Ajustar altura de filas automáticamente
            updateDimensionProperties: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: 1,
                endIndex: 1000,
              },
              properties: {
                pixelSize: 21, // Altura mínima para que se vea compacto
              },
              fields: 'pixelSize',
            },
          },
          {
            // Congelar fila de cabecera
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
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

    console.log('✅ Formato aplicado correctamente')
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('✅ COMPLETADO')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('\n📊 Cambios aplicados:')
    console.log('  • Padding reducido al mínimo en filas de datos')
    console.log('  • Altura de filas ajustada a 21 píxeles (compacto)')
    console.log('  • Cabecera con formato azul conservado')
    console.log('  • Congelamiento de fila de cabecera')
    console.log('\n🚀 Abre tu Google Sheet y verás las filas más compactas!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

removeRowPadding()
