import { PrismaClient } from '@prisma/client'
import { SunatService } from '../src/services/sunat'
import { decrypt } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  console.log('🏢 CONSULTANDO RUCs DE TODAS LAS FACTURAS\n')
  console.log('═'.repeat(80))

  // Obtener configuración
  const settings = await prisma.organizationSettings.findFirst()

  if (
    !settings ||
    !settings.sunatEnabled ||
    !settings.sunatClientId ||
    !settings.sunatClientSecret ||
    !settings.sunatRuc
  ) {
    console.error('❌ SUNAT no está configurado correctamente')
    return
  }

  const sunatService = new SunatService({
    clientId: decrypt(settings.sunatClientId),
    clientSecret: decrypt(settings.sunatClientSecret),
    rucEmpresa: settings.sunatRuc,
  })

  // Obtener todas las facturas con RUC pero sin información completa
  const invoices = await prisma.invoice.findMany({
    where: {
      rucEmisor: { not: null },
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`\n📊 Total de facturas con RUC: ${invoices.length}\n`)
  console.log('═'.repeat(80))

  let consultadas = 0
  let actualizadas = 0
  let errores = 0
  let yaActualizadas = 0

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i]

    console.log(`\n[${i + 1}/${invoices.length}] 📄 ${invoice.serieNumero || 'N/A'}`)
    console.log(`    Emisor actual: ${invoice.razonSocialEmisor || 'Sin datos'}`)
    console.log(`    RUC: ${invoice.rucEmisor}`)

    // Si ya tiene razón social de SUNAT, saltar (opcional)
    if (invoice.razonSocialEmisor && invoice.domicilioFiscalEmisor) {
      console.log('    ℹ️  Ya tiene información completa')
      yaActualizadas++
      continue
    }

    try {
      // Consultar RUC en SUNAT
      const rucData = await sunatService.consultarRuc(invoice.rucEmisor)
      consultadas++

      // Interpretar estado
      const estadoInterpretado = SunatService.interpretarEstadoRuc(
        rucData.descEstado
      )

      // Construir dirección completa desde domicilio fiscal
      let direccionCompleta = ''
      if (rucData.domicilioFiscal) {
        const df = rucData.domicilioFiscal
        if (df.descTipvia && df.descNomvia) {
          direccionCompleta = `${df.descTipvia} ${df.descNomvia}`
          if (df.descNumer) direccionCompleta += ` ${df.descNumer}`
          if (df.descInterior)
            direccionCompleta += ` Int. ${df.descInterior}`
          if (df.descDpto) direccionCompleta += ` Dpto. ${df.descDpto}`
          if (df.descDist) direccionCompleta += `, ${df.descDist}`
          if (df.descProv) direccionCompleta += `, ${df.descProv}`
          if (df.descDep) direccionCompleta += `, ${df.descDep}`
        }
      }

      // Actualizar factura con datos de SUNAT
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          razonSocialEmisor: rucData.ddpNombre,
          vendorName: rucData.ddpNombre, // ✅ También actualizar vendorName
          domicilioFiscalEmisor:
            direccionCompleta || invoice.domicilioFiscalEmisor || null,
        },
      })

      console.log(`    ✅ Actualizado con datos de SUNAT`)
      console.log(`       Razón Social: ${rucData.ddpNombre}`)
      console.log(`       Estado: ${rucData.descEstado} (${estadoInterpretado.mensaje})`)
      if (direccionCompleta) {
        console.log(`       Dirección: ${direccionCompleta}`)
      }

      actualizadas++

      // Pequeña pausa para no saturar la API
      await new Promise((resolve) => setTimeout(resolve, 800))
    } catch (error: any) {
      console.log(`    ❌ ERROR: ${error.message}`)
      errores++

      // Si es error de RUC no encontrado, continuar
      if (error.message.includes('No se encontró')) {
        continue
      }

      // Si es error de autenticación, detener
      if (error.message.includes('Authentication') || error.message.includes('token')) {
        console.error('\n❌ Error de autenticación. Deteniendo...')
        break
      }
    }
  }

  console.log('\n' + '═'.repeat(80))
  console.log('\n📊 RESUMEN FINAL:\n')
  console.log(`   Total facturas: ${invoices.length}`)
  console.log(`   ✅ Consultadas exitosamente: ${consultadas}`)
  console.log(`   📝 Actualizadas: ${actualizadas}`)
  console.log(`   ℹ️  Ya tenían datos completos: ${yaActualizadas}`)
  console.log(`   ❌ Errores: ${errores}`)
  console.log()

  await prisma.$disconnect()
}

main()
