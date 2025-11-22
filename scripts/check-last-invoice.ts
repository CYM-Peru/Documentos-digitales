import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkLastInvoice() {
  try {
    console.log('🔍 Verificando última factura procesada...\n')

    const invoice = await prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    })

    if (!invoice) {
      console.log('❌ No hay facturas en la base de datos')
      return
    }

    console.log('📄 ÚLTIMA FACTURA:')
    console.log('═══════════════════════════════════════════════════════════')
    console.log(`ID: ${invoice.id}`)
    console.log(`Status: ${invoice.status}`)
    console.log(`Fecha: ${invoice.createdAt}`)
    console.log(`Usuario: ${invoice.user?.name || invoice.user?.email}`)
    console.log('')
    console.log('📊 DATOS EXTRAÍDOS:')
    console.log(`  RUC Emisor: ${invoice.rucEmisor || 'NO EXTRAÍDO'}`)
    console.log(`  Razón Social: ${invoice.razonSocialEmisor || 'NO EXTRAÍDO'}`)
    console.log(`  Serie-Número: ${invoice.serieNumero || 'NO EXTRAÍDO'}`)
    console.log(`  Total: ${invoice.totalAmount || 'NO EXTRAÍDO'}`)
    console.log('')
    console.log('📋 INTEGRACIÓN GOOGLE SHEETS:')
    console.log(`  Row ID: ${invoice.googleSheetsRowId || '❌ NO SE GUARDÓ EN SHEETS'}`)
    console.log('')

    if (!invoice.googleSheetsRowId) {
      console.log('⚠️  PROBLEMA: La factura NO se guardó en Google Sheets')
      console.log('')
      console.log('🔍 Verificando configuración...')

      const settings = await prisma.organizationSettings.findFirst({
        where: { organizationId: invoice.organizationId },
      })

      if (!settings) {
        console.log('❌ No hay configuración de organización')
        return
      }

      console.log('')
      console.log('CONFIGURACIÓN:')
      console.log(`  Google Service Account: ${settings.googleServiceAccount ? '✅ Configurado' : '❌ NO configurado'}`)
      console.log(`  Google Sheets ID: ${settings.googleSheetsId || '❌ NO configurado'}`)
      console.log(`  Drive Folder ID: ${settings.googleDriveFolderId || 'No configurado (opcional)'}`)
    } else {
      console.log(`✅ Factura guardada correctamente en Sheets (fila ${invoice.googleSheetsRowId})`)
    }

    console.log('═══════════════════════════════════════════════════════════')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLastInvoice()
