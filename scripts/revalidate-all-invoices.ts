import { prisma } from '../src/lib/prisma'
import { SunatService } from '../src/services/sunat'
import { decrypt } from '../src/lib/encryption'

async function revalidateAllInvoices() {
  console.log('🔄 REVALIDANDO TODAS LAS FACTURAS CON PROBLEMAS EN SUNAT\n')

  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { sunatEstadoCp: '0' },
        { sunatVerified: false },
        { sunatVerified: null },
      ],
      status: 'COMPLETED',
      rucEmisor: { not: null },
      serieNumero: { not: null },
      documentTypeCode: { not: null },
      totalAmount: { not: null },
    },
    include: {
      organization: {
        include: {
          settings: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (invoices.length === 0) {
    console.log('✅ No hay facturas pendientes de revalidar')
    return
  }

  console.log(`📊 Encontradas: ${invoices.length} facturas\n`)

  const settings = invoices[0].organization.settings

  if (!settings?.sunatEnabled || !settings.sunatClientId || !settings.sunatClientSecret) {
    console.error('❌ SUNAT no está configurado')
    return
  }

  const sunatService = new SunatService({
    clientId: decrypt(settings.sunatClientId),
    clientSecret: decrypt(settings.sunatClientSecret),
    rucEmpresa: settings.sunatRuc || '',
  })

  let validadas = 0
  let noEncontradas = 0

  for (const invoice of invoices) {
    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`\n📄 ${invoice.serieNumero}`)
    console.log(`   RUC: ${invoice.rucEmisor} - ${invoice.razonSocialEmisor}`)
    console.log(`   Fecha: ${invoice.invoiceDate}`)
    console.log(`   Total: ${invoice.currency} ${invoice.totalAmount}`)

    const [serie, numero] = invoice.serieNumero?.split('-') || ['', '']
    if (!serie || !numero) {
      console.log('   ⚠️ Serie inválida\n')
      continue
    }

    const fechasAProbar: Array<{ fecha: string; desc: string }> = []

    if (invoice.invoiceDate) {
      const date = new Date(invoice.invoiceDate)
      const dia = String(date.getUTCDate()).padStart(2, '0')
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
      const anio = date.getUTCFullYear()

      fechasAProbar.push({ fecha: `${dia}/${mes}/${anio}`, desc: 'original' })

      const anioActual = new Date().getFullYear()
      if (anio < 2020 || anio > anioActual + 1) {
        fechasAProbar.push({ fecha: `${dia}/${mes}/${anioActual}`, desc: `año ${anioActual}` })
      }

      if (parseInt(dia) <= 12 && parseInt(mes) <= 12 && dia !== mes) {
        fechasAProbar.push({ fecha: `${mes}/${dia}/${anio}`, desc: 'invertida' })
        if (anio < 2020 || anio > anioActual + 1) {
          fechasAProbar.push({ fecha: `${mes}/${dia}/${anioActual}`, desc: `invertida ${anioActual}` })
        }
      }
    }

    let encontrado = false

    for (const { fecha, desc } of fechasAProbar) {
      try {
        console.log(`   🔄 ${desc}: ${fecha}`)

        const datos = {
          numRuc: invoice.rucEmisor || '',
          codComp: invoice.documentTypeCode || '03',
          numeroSerie: serie,
          numero: numero,
          fechaEmision: fecha,
          monto: invoice.totalAmount?.toFixed(2) || '0'
        }

        const resultado = await sunatService.validarComprobante(datos)

        if (resultado.estadoCp === '1') {
          console.log(`   ✅ VÁLIDO con ${desc}!`)

          let fechaCorregida = invoice.invoiceDate
          if (desc !== 'original') {
            const [d, m, a] = fecha.split('/')
            fechaCorregida = new Date(`${a}-${m}-${d}`)
          }

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              invoiceDate: fechaCorregida,
              sunatVerified: true,
              sunatEstadoCp: resultado.estadoCp,
              sunatEstadoRuc: resultado.estadoRuc,
              sunatObservaciones: resultado.observaciones || [],
              sunatVerifiedAt: new Date(),
            }
          })

          console.log(`   ✅ Actualizado\n`)
          validadas++
          encontrado = true
          break
        } else if (resultado.estadoCp !== '0') {
          console.log(`   ⚠️ Estado: ${resultado.estadoCp}`)
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              sunatVerified: false,
              sunatEstadoCp: resultado.estadoCp,
              sunatEstadoRuc: resultado.estadoRuc,
              sunatObservaciones: resultado.observaciones || [],
              sunatVerifiedAt: new Date(),
            }
          })
          validadas++
          encontrado = true
          break
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`)
      }
    }

    if (!encontrado) {
      console.log(`   ❌ No encontrado\n`)
      noEncontradas++
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('\n📊 RESUMEN:\n')
  console.log(`✅ Validadas: ${validadas}`)
  console.log(`❌ No encontradas: ${noEncontradas}`)
  console.log(`📋 Total: ${invoices.length}\n`)

  await prisma.$disconnect()
}

revalidateAllInvoices()
