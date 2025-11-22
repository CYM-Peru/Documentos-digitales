import { PrismaClient } from '@prisma/client'
import { GoogleSheetsService } from './src/services/google-sheets'
import { decryptObject } from './src/lib/encryption'
import { google } from 'googleapis'

const prisma = new PrismaClient()

async function checkSheetsData() {
  try {
    console.log('🔍 VERIFICANDO DATOS EN GOOGLE SHEETS\n')

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

    // Leer headers (fila 1)
    console.log('📋 CABECERAS (Fila 1):')
    const headersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: settings.googleSheetsId,
      range: 'Invoices!A1:Y1',
    })

    const headers = headersResponse.data.values?.[0] || []
    headers.forEach((header, index) => {
      const column = String.fromCharCode(65 + index) // A, B, C...
      console.log(`  ${column}: ${header}`)
    })

    // Leer datos (fila 2)
    console.log('\n📊 DATOS (Fila 2):')
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: settings.googleSheetsId,
      range: 'Invoices!A2:Y2',
    })

    const data = dataResponse.data.values?.[0] || []
    data.forEach((value, index) => {
      const column = String.fromCharCode(65 + index)
      console.log(`  ${column}: ${value}`)
    })

    // Comparar con datos de la factura en DB
    console.log('\n💾 DATOS EN BASE DE DATOS:')
    const invoice = await prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    if (invoice) {
      console.log(`  ID: ${invoice.id}`)
      console.log(`  Fecha: ${invoice.createdAt}`)
      console.log(`  Status: ${invoice.status}`)
      console.log(`  RUC Emisor: ${invoice.rucEmisor}`)
      console.log(`  Razón Social: ${invoice.razonSocialEmisor}`)
      console.log(`  Serie-Número: ${invoice.serieNumero}`)
      console.log(`  Total: ${invoice.totalAmount}`)
      console.log(`  googleSheetsRowId: ${invoice.googleSheetsRowId}`)
    }

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('✅ Verificación completa')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSheetsData()
