import { google } from 'googleapis'
import { PrismaClient } from '@prisma/client'
import { decryptObject } from './src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  const settings = await prisma.organizationSettings.findFirst()

  if (!settings?.googleServiceAccount || !settings?.googleSheetsId) {
    console.log('❌ No Google Sheets configured')
    return
  }

  const serviceAccount = decryptObject(settings.googleServiceAccount) as any

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  // Nuevas cabeceras para facturas peruanas
  const headers = [
    'ID',
    'RUC Emisor',
    'Razón Social Emisor',
    'Domicilio Fiscal',
    'Serie y Número',
    'Fecha Emisión',
    'RUC Cliente',
    'DNI Cliente',
    'Razón Social Cliente',
    'Subtotal (sin IGV)',
    'IGV Tasa (%)',
    'IGV Monto',
    'Total',
    'Moneda',
    'Imagen URL',
    'Fecha Creación'
  ]

  console.log('📝 Actualizando cabeceras de Google Sheets...')
  console.log('Columnas:', headers.length)

  await sheets.spreadsheets.values.update({
    spreadsheetId: settings.googleSheetsId,
    range: 'Invoices!A1:P1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [headers],
    },
  })

  console.log('✅ Cabeceras actualizadas exitosamente!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
