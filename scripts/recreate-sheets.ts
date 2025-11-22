import { PrismaClient } from '@prisma/client'
import { GoogleSheetsService } from './src/services/google-sheets'
import { decryptObject } from './src/lib/encryption'

const prisma = new PrismaClient()

async function recreateSheets() {
  try {
    console.log('🔄 RECREANDO HOJA DE GOOGLE SHEETS\n')

    const settings = await prisma.organizationSettings.findFirst()

    if (!settings || !settings.googleServiceAccount || !settings.googleSheetsId) {
      console.log('❌ No hay configuración de Google Sheets')
      return
    }

    const googleService = new GoogleSheetsService({
      serviceAccount: decryptObject(settings.googleServiceAccount),
      sheetsId: settings.googleSheetsId,
      driveFolderId: settings.googleDriveFolderId || undefined,
    })

    console.log('📋 Sheets ID:', settings.googleSheetsId)
    console.log('\n🗑️  PASO 1: Borrando hoja vieja "Invoices"...')

    // Obtener información de la spreadsheet
    const { google } = require('googleapis')
    const auth = new google.auth.GoogleAuth({
      credentials: decryptObject(settings.googleServiceAccount),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: settings.googleSheetsId,
      })

      const invoicesSheet = spreadsheet.data.sheets?.find(
        (sheet: any) => sheet.properties?.title === 'Invoices'
      )

      if (invoicesSheet) {
        const sheetId = invoicesSheet.properties?.sheetId

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: settings.googleSheetsId,
          resource: {
            requests: [
              {
                deleteSheet: {
                  sheetId: sheetId,
                },
              },
            ],
          },
        })

        console.log('✅ Hoja "Invoices" borrada correctamente')
      } else {
        console.log('⚠️  No existe hoja "Invoices" (ok, la crearemos)')
      }
    } catch (error) {
      console.log('⚠️  Error borrando hoja:', error)
    }

    console.log('\n📝 PASO 2: Creando hoja nueva con estructura correcta...')

    await googleService.createInvoicesSheet()

    console.log('✅ Hoja "Invoices" creada con 25 columnas (A-Y)')
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('✅ COMPLETADO - Google Sheets listo')
    console.log('═══════════════════════════════════════════════════════════')
    console.log('\n📊 ESTRUCTURA DE COLUMNAS (25 COLUMNAS A-Y):\n')
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
    console.log('\n🚀 Ahora sube una factura y verás los datos en el orden correcto!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

recreateSheets()
