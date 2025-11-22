import { PrismaClient } from '@prisma/client'
import { decryptObject } from './src/lib/encryption'
import { google } from 'googleapis'

const prisma = new PrismaClient()

async function fixSheetsHeaders() {
  try {
    console.log('🔧 ARREGLANDO CABECERAS DE GOOGLE SHEETS\n')

    const settings = await prisma.organizationSettings.findFirst()

    if (!settings || !settings.googleServiceAccount || !settings.googleSheetsId) {
      console.log('❌ No hay configuración de Google Sheets')
      return
    }

    const auth = new google.auth.GoogleAuth({
      credentials: decryptObject(settings.googleServiceAccount),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    console.log('🗑️  Borrando TODO el contenido de la hoja...')

    // Limpiar TODO el contenido (filas 1-1000)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: settings.googleSheetsId,
      range: 'Invoices!A1:Z1000',
    })

    console.log('✅ Contenido borrado')
    console.log('\n📝 Escribiendo cabeceras CORRECTAS...')

    // Escribir las cabeceras correctas
    await sheets.spreadsheets.values.update({
      spreadsheetId: settings.googleSheetsId,
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

    console.log('✅ Cabeceras escritas correctamente')
    console.log('\n🎨 Aplicando formato...')

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

    // Aplicar formato a la fila de cabeceras
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: settings.googleSheetsId,
      resource: {
        requests: [
          {
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
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
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

    console.log('✅ Formato aplicado (azul + texto blanco + congelar fila)')
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('✅ COMPLETADO - Google Sheets arreglado')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('\n📊 ESTRUCTURA CORRECTA (25 COLUMNAS A-Y):\n')
    console.log('═══ IDENTIFICACIÓN ═══')
    console.log('  A: ID')
    console.log('  B: Fecha Registro')
    console.log('  C: Estado Procesamiento')
    console.log('\n═══ VERIFICACIÓN SUNAT ═══')
    console.log('  D: ✅ Estado SUNAT')
    console.log('  E: 📋 Código Estado CP')
    console.log('  F: 🏢 Estado RUC')
    console.log('  G: ⚠️ Observaciones SUNAT')
    console.log('  H: 📅 Fecha Verificación SUNAT')
    console.log('\n═══ COMPROBANTE ═══')
    console.log('  I: 📄 Tipo Documento')
    console.log('  J: 🔢 Código SUNAT')
    console.log('  K: 📌 Serie-Número')
    console.log('  L: 📆 Fecha Emisión')
    console.log('\n═══ EMISOR ═══')
    console.log('  M: 🏭 RUC Emisor')
    console.log('  N: 🏢 Razón Social Emisor')
    console.log('  O: 📍 Domicilio Fiscal Emisor')
    console.log('\n═══ RECEPTOR ═══')
    console.log('  P: 🏢 RUC Receptor')
    console.log('  Q: 🆔 DNI Receptor')
    console.log('  R: 👤 Razón Social Receptor')
    console.log('\n═══ MONTOS ═══')
    console.log('  S: 💵 OP Gravada')
    console.log('  T: 📊 IGV Tasa %')
    console.log('  U: 💰 IGV Monto')
    console.log('  V: 💸 Total a Pagar')
    console.log('  W: 💱 Moneda')
    console.log('\n═══ METADATA ═══')
    console.log('  X: 👤 Usuario')
    console.log('  Y: 🖼️ Imagen URL')
    console.log('\n🚀 Las facturas existentes en la DB se pueden re-insertar si es necesario!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixSheetsHeaders()
