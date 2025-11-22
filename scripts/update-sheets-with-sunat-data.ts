import { PrismaClient } from '@prisma/client'
import { SunatService } from '../src/services/sunat'
import { GoogleSheetsService } from '../src/services/google-sheets'
import { decrypt, decryptObject } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  console.log('📊 ACTUALIZANDO GOOGLE SHEETS CON DATOS OFICIALES DE SUNAT\n')
  console.log('═'.repeat(80))

  // Obtener configuración
  const settings = await prisma.organizationSettings.findFirst()

  if (!settings) {
    console.error('❌ No se encontró configuración de organización')
    return
  }

  // Verificar configuración SUNAT
  if (
    !settings.sunatEnabled ||
    !settings.sunatClientId ||
    !settings.sunatClientSecret ||
    !settings.sunatRuc
  ) {
    console.error('❌ SUNAT no está configurado correctamente')
    return
  }

  // Verificar configuración Google Sheets
  if (!settings.googleServiceAccount || !settings.googleSheetsId) {
    console.error('❌ Google Sheets no está configurado')
    return
  }

  const sunatService = new SunatService({
    clientId: decrypt(settings.sunatClientId),
    clientSecret: decrypt(settings.sunatClientSecret),
    rucEmpresa: settings.sunatRuc,
  })

  const googleService = new GoogleSheetsService({
    serviceAccount: decryptObject(settings.googleServiceAccount),
    sheetsId: settings.googleSheetsId,
    driveFolderId: settings.googleDriveFolderId,
  })

  // Obtener todas las facturas que están en Google Sheets y tienen RUC
  const invoices = await prisma.invoice.findMany({
    where: {
      googleSheetsRowId: { not: null },
      rucEmisor: { not: null },
    },
    include: {
      user: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`\n📊 Total de facturas en Sheets con RUC: ${invoices.length}\n`)
  console.log('═'.repeat(80))

  let consultadas = 0
  let actualizadas = 0
  let errores = 0
  let sinCambios = 0

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i]

    console.log(
      `\n[${i + 1}/${invoices.length}] 📄 ${invoice.serieNumero || 'N/A'} (Fila ${invoice.googleSheetsRowId})`
    )
    console.log(`    Razón Social actual en BD: ${invoice.razonSocialEmisor || 'Sin datos'}`)
    console.log(`    RUC: ${invoice.rucEmisor}`)

    try {
      // Consultar RUC en SUNAT
      const rucData = await sunatService.consultarRuc(invoice.rucEmisor)
      consultadas++

      // Verificar si hay cambios
      const razonSocialCambiada = invoice.razonSocialEmisor !== rucData.ddpNombre

      // Construir dirección completa
      let direccionCompleta = ''
      if (rucData.domicilioFiscal) {
        const df = rucData.domicilioFiscal
        if (df.descTipvia && df.descNomvia) {
          direccionCompleta = `${df.descTipvia} ${df.descNomvia}`
          if (df.descNumer) direccionCompleta += ` ${df.descNumer}`
          if (df.descInterior) direccionCompleta += ` Int. ${df.descInterior}`
          if (df.descDpto) direccionCompleta += ` Dpto. ${df.descDpto}`
          if (df.descDist) direccionCompleta += `, ${df.descDist}`
          if (df.descProv) direccionCompleta += `, ${df.descProv}`
          if (df.descDep) direccionCompleta += `, ${df.descDep}`
        }
      }

      const direccionCambiada =
        direccionCompleta &&
        invoice.domicilioFiscalEmisor !== direccionCompleta

      if (!razonSocialCambiada && !direccionCambiada) {
        console.log('    ℹ️  Los datos ya están correctos')
        sinCambios++
        continue
      }

      // Actualizar BD
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          razonSocialEmisor: rucData.ddpNombre,
          vendorName: rucData.ddpNombre, // ✅ También actualizar vendorName
          domicilioFiscalEmisor: direccionCompleta || invoice.domicilioFiscalEmisor,
        },
      })

      // Actualizar Google Sheets
      await googleService.updateInvoice(invoice.googleSheetsRowId!, {
        id: invoice.id,
        status: invoice.status,
        vendorName: invoice.vendorName ?? undefined,
        invoiceNumber: invoice.invoiceNumber ?? undefined,
        invoiceDate: invoice.invoiceDate ?? undefined,
        totalAmount: invoice.totalAmount ?? undefined,
        currency: invoice.currency ?? undefined,
        taxAmount: invoice.taxAmount ?? undefined,
        imageUrl: invoice.imageUrl,
        createdAt: invoice.createdAt,
        documentType: invoice.documentType ?? undefined,
        documentTypeCode: invoice.documentTypeCode ?? undefined,
        rucEmisor: invoice.rucEmisor ?? undefined,
        razonSocialEmisor: rucData.ddpNombre, // ✅ Dato oficial de SUNAT
        domicilioFiscalEmisor: (direccionCompleta || invoice.domicilioFiscalEmisor) ?? undefined, // ✅ Dato oficial de SUNAT
        rucReceptor: invoice.rucReceptor ?? undefined,
        dniReceptor: invoice.dniReceptor ?? undefined,
        razonSocialReceptor: invoice.razonSocialReceptor ?? undefined,
        serieNumero: invoice.serieNumero ?? undefined,
        subtotal: invoice.subtotal ?? undefined,
        igvTasa: invoice.igvTasa ?? undefined,
        igvMonto: invoice.igvMonto ?? undefined,
        sunatVerified: invoice.sunatVerified ?? undefined,
        sunatEstadoCp: invoice.sunatEstadoCp ?? undefined,
        sunatEstadoRuc: invoice.sunatEstadoRuc ?? undefined,
        sunatObservaciones: invoice.sunatObservaciones ?? undefined,
        sunatVerifiedAt: invoice.sunatVerifiedAt ?? undefined,
        userName: invoice.user?.name ?? undefined,
        userEmail: invoice.user?.email ?? undefined,
      })

      console.log(`    ✅ Actualizado con datos oficiales de SUNAT`)
      if (razonSocialCambiada) {
        console.log(`       Razón Social: ${invoice.razonSocialEmisor} → ${rucData.ddpNombre}`)
      }
      if (direccionCambiada) {
        console.log(`       Dirección: ${invoice.domicilioFiscalEmisor || 'Sin datos'} → ${direccionCompleta}`)
      }

      actualizadas++

      // Pequeña pausa para no saturar las APIs
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error: any) {
      console.log(`    ❌ ERROR: ${error.message}`)
      errores++
    }
  }

  console.log('\n' + '═'.repeat(80))
  console.log('\n📊 RESUMEN FINAL:\n')
  console.log(`   Total facturas: ${invoices.length}`)
  console.log(`   ✅ Consultadas en SUNAT: ${consultadas}`)
  console.log(`   📝 Actualizadas en Sheets: ${actualizadas}`)
  console.log(`   ℹ️  Sin cambios: ${sinCambios}`)
  console.log(`   ❌ Errores: ${errores}`)
  console.log()

  if (actualizadas > 0) {
    console.log('🎉 ¡Google Sheets actualizado con datos oficiales de SUNAT!')
    console.log('   Revisa tu hoja de cálculo para ver los cambios.')
  }

  await prisma.$disconnect()
}

main()
