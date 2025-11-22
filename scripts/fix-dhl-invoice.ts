import { prisma } from '../src/lib/prisma'
import { SunatService } from '../src/services/sunat'
import { decrypt } from '../src/lib/encryption'

async function fixDHLInvoice() {
  const invoiceId = 'cmhj9zxwh0001cyo53ho1c5zn' // F216-00615007

  console.log('🔧 Corrigiendo factura de DHL...\n')

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      organization: {
        include: {
          settings: true
        }
      }
    }
  })

  if (!invoice) {
    console.log('❌ Factura no encontrada')
    return
  }

  console.log('📄 Factura actual:')
  console.log(`   Serie: ${invoice.serieNumero}`)
  console.log(`   EMISOR (INCORRECTO): ${invoice.razonSocialEmisor} - RUC ${invoice.rucEmisor}`)
  console.log(`   RECEPTOR (INCORRECTO): ${invoice.razonSocialReceptor} - RUC ${invoice.rucReceptor}`)
  console.log('')

  // Datos corregidos
  const datosCorregidos = {
    // DHL es el EMISOR (quien emite la factura)
    rucEmisor: '20101128777', // RUC de DHL
    razonSocialEmisor: 'DHL EXPRESS PERU SAC',
    vendorName: 'DHL EXPRESS PERU SAC',
    domicilioFiscalEmisor: 'AV. REPUBLICA DE PANAMA NRO. 4675 LIMA - LIMA - SURQUILLO',

    // AZALEIA es el RECEPTOR (quien recibe la factura)
    rucReceptor: '20374412524', // RUC de Azaleia
    razonSocialReceptor: 'CALZADOS AZALEIA PERU S.A',
  }

  console.log('✅ Datos corregidos:')
  console.log(`   EMISOR: ${datosCorregidos.razonSocialEmisor} - RUC ${datosCorregidos.rucEmisor}`)
  console.log(`   RECEPTOR: ${datosCorregidos.razonSocialReceptor} - RUC ${datosCorregidos.rucReceptor}`)
  console.log('')

  // Actualizar factura
  console.log('📝 Actualizando base de datos...')
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: datosCorregidos
  })

  console.log('✅ Factura actualizada en PostgreSQL')
  console.log('')

  // Intentar validar en SUNAT con datos corregidos
  const settings = invoice.organization.settings

  if (settings?.sunatEnabled && settings.sunatClientId && settings.sunatClientSecret) {
    try {
      console.log('🔍 Intentando validar en SUNAT con datos corregidos...')

      const sunatService = new SunatService({
        clientId: decrypt(settings.sunatClientId),
        clientSecret: decrypt(settings.sunatClientSecret),
        rucEmpresa: settings.sunatRuc || '',
      })

      const [serie, numero] = invoice.serieNumero?.split('-') || ['', '']

      if (serie && numero && invoice.invoiceDate && invoice.totalAmount) {
        const date = new Date(invoice.invoiceDate)
        const dia = String(date.getUTCDate()).padStart(2, '0')
        const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
        const anio = date.getUTCFullYear()
        const fechaSunat = `${dia}/${mes}/${anio}`

        const datos = {
          numRuc: datosCorregidos.rucEmisor, // Ahora con DHL
          codComp: invoice.documentTypeCode || '01',
          numeroSerie: serie,
          numero: numero,
          fechaEmision: fechaSunat,
          monto: invoice.totalAmount.toFixed(2)
        }

        console.log('📋 Datos para SUNAT:', datos)
        console.log('')

        const resultado = await sunatService.validarComprobante(datos)

        console.log('✅ Respuesta SUNAT:')
        console.log(`   Estado CP: ${resultado.estadoCp}`)
        console.log(`   Estado RUC: ${resultado.estadoRuc}`)
        console.log('')

        if (resultado.estadoCp === '1') {
          console.log('🎉 ¡COMPROBANTE VÁLIDO EN SUNAT!')

          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              sunatVerified: true,
              sunatEstadoCp: resultado.estadoCp,
              sunatEstadoRuc: resultado.estadoRuc,
              sunatObservaciones: resultado.observaciones || [],
              sunatVerifiedAt: new Date(),
            }
          })

          console.log('✅ Estado SUNAT actualizado')
        } else {
          console.log(`⚠️ Estado: ${resultado.estadoCp === '0' ? 'NO EXISTE' : resultado.estadoCp === '2' ? 'ANULADO' : 'RECHAZADO'}`)
        }
      }
    } catch (error: any) {
      console.log(`❌ Error SUNAT: ${error.message}`)
    }
  }

  console.log('')
  console.log('═══════════════════════════════════════════')
  console.log('✅ FACTURA CORREGIDA')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log('Ahora el emisor es: DHL EXPRESS PERU SAC')
  console.log('Y el receptor es: CALZADOS AZALEIA PERU S.A')
  console.log('')

  await prisma.$disconnect()
}

fixDHLInvoice()
