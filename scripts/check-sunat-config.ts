import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

// Función decrypt simplificada
function decrypt(encryptedText: string): string {
  const CryptoJS = require('crypto-js')
  const key = process.env.ENCRYPTION_KEY || ''
  const bytes = CryptoJS.AES.decrypt(encryptedText, key)
  return bytes.toString(CryptoJS.enc.Utf8)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
})

async function checkSunatConfig() {
  console.log('🔍 Verificando configuración SUNAT y IA...\n')

  try {
    const settings = await prisma.organizationSettings.findMany({
      include: {
        organization: true
      }
    })

    if (settings.length === 0) {
      console.log('⚠️ No se encontraron configuraciones de organizaciones')
      return
    }

    for (const setting of settings) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`📊 Organización: ${setting.organization.name}`)
      console.log(`   ID: ${setting.organizationId}`)
      console.log('')

      // GEMINI IA
      console.log('🤖 GEMINI AI:')
      if (setting.geminiApiKey) {
        const keyPreview = decrypt(setting.geminiApiKey).substring(0, 10) + '...'
        console.log(`   ✅ API Key: ${keyPreview}`)
        console.log(`   ✅ Model: ${setting.geminiModel || 'gemini-2.0-flash-exp (default)'}`)
        console.log(`   ✅ Custom Prompt: ${setting.geminiPrompt ? 'Sí (personalizado)' : 'No (usando default)'}`)
      } else {
        console.log('   ❌ No configurado')
      }
      console.log('')

      // SUNAT
      console.log('🏛️ SUNAT:')
      console.log(`   Habilitado: ${setting.sunatEnabled ? '✅ SÍ' : '❌ NO'}`)
      if (setting.sunatEnabled) {
        if (setting.sunatClientId) {
          const clientIdPreview = decrypt(setting.sunatClientId).substring(0, 15) + '...'
          console.log(`   ✅ Client ID: ${clientIdPreview}`)
        } else {
          console.log('   ❌ Client ID: No configurado')
        }

        if (setting.sunatClientSecret) {
          console.log('   ✅ Client Secret: Configurado')
        } else {
          console.log('   ❌ Client Secret: No configurado')
        }

        if (setting.sunatRuc) {
          console.log(`   ✅ RUC Empresa: ${setting.sunatRuc}`)
        } else {
          console.log('   ❌ RUC Empresa: No configurado')
        }
      }
      console.log('')

      // Google Sheets
      console.log('📊 GOOGLE SHEETS:')
      if (setting.googleServiceAccount && setting.googleSheetsId) {
        console.log(`   ✅ Configurado`)
        console.log(`   ✅ Sheet ID: ${setting.googleSheetsId}`)
      } else {
        console.log('   ❌ No configurado')
      }
      console.log('')
    }

    // Verificar última factura procesada
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 ÚLTIMA FACTURA PROCESADA:\n')

    const lastInvoice = await prisma.invoice.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { organization: true }
    })

    if (lastInvoice) {
      console.log(`   ID: ${lastInvoice.id}`)
      console.log(`   Organización: ${lastInvoice.organization.name}`)
      console.log(`   Estado: ${lastInvoice.status}`)
      console.log(`   Fecha: ${lastInvoice.createdAt}`)
      console.log('')
      console.log('   Datos extraídos:')
      console.log(`   - RUC Emisor: ${lastInvoice.rucEmisor || '❌ No extraído'}`)
      console.log(`   - Razón Social: ${lastInvoice.razonSocialEmisor || '❌ No extraído'}`)
      console.log(`   - Serie-Número: ${lastInvoice.serieNumero || '❌ No extraído'}`)
      console.log(`   - Tipo Doc Code: ${lastInvoice.documentTypeCode || '❌ No extraído'}`)
      console.log(`   - Fecha Emisión: ${lastInvoice.invoiceDate || '❌ No extraído'}`)
      console.log(`   - Total: ${lastInvoice.totalAmount ? `S/ ${lastInvoice.totalAmount}` : '❌ No extraído'}`)
      console.log(`   - IGV: ${lastInvoice.igvMonto ? `S/ ${lastInvoice.igvMonto}` : '❌ No extraído'}`)
      console.log('')
      console.log('   Verificación SUNAT:')
      console.log(`   - Verificado: ${lastInvoice.sunatVerified ? '✅ SÍ' : '❌ NO'}`)
      if (lastInvoice.sunatEstadoCp) {
        console.log(`   - Estado: ${lastInvoice.sunatEstadoCp}`)
      }
      if (lastInvoice.sunatRetries) {
        console.log(`   - Intentos: ${lastInvoice.sunatRetries}`)
      }
    } else {
      console.log('   ⚠️ No hay facturas procesadas')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkSunatConfig()
