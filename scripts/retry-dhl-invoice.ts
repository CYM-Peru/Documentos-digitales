import { prisma } from '../src/lib/prisma'
import { SunatService } from '../src/services/sunat'
import { decrypt } from '../src/lib/encryption'

async function retryDHLInvoice() {
  const invoiceId = 'cmhj9zxwh0001cyo53ho1c5zn' // F216-00615007

  console.log('🔄 Reintentando validación de factura DHL con variaciones...\n')

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

  const settings = invoice.organization.settings

  if (!settings?.sunatEnabled || !settings.sunatClientId || !settings.sunatClientSecret) {
    console.log('❌ SUNAT no configurado')
    return
  }

  const sunatService = new SunatService({
    clientId: decrypt(settings.sunatClientId),
    clientSecret: decrypt(settings.sunatClientSecret),
    rucEmpresa: settings.sunatRuc || '',
  })

  const [serie, numero] = invoice.serieNumero?.split('-') || ['', '']

  if (!serie || !numero || !invoice.invoiceDate || !invoice.totalAmount) {
    console.log('❌ Datos incompletos')
    return
  }

  const date = new Date(invoice.invoiceDate)
  const dia = String(date.getUTCDate()).padStart(2, '0')
  const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
  const anio = date.getUTCFullYear()

  console.log(`📋 Factura: ${invoice.serieNumero}`)
  console.log(`   Emisor: DHL EXPRESS PERU SAC (RUC ${invoice.rucEmisor})`)
  console.log(`   Fecha extraída: ${dia}/${mes}/${anio}`)
  console.log(`   Monto: S/ ${invoice.totalAmount}`)
  console.log('')

  // Intentos de validación
  const intentos = [
    { desc: 'Fecha original', fecha: `${dia}/${mes}/${anio}`, monto: invoice.totalAmount },
    { desc: 'Fecha invertida (día↔mes)', fecha: `${mes}/${dia}/${anio}`, monto: invoice.totalAmount },
    { desc: 'Monto -0.01', fecha: `${dia}/${mes}/${anio}`, monto: invoice.totalAmount - 0.01 },
    { desc: 'Monto +0.01', fecha: `${dia}/${mes}/${anio}`, monto: invoice.totalAmount + 0.01 },
    { desc: 'Fecha invertida + monto -0.01', fecha: `${mes}/${dia}/${anio}`, monto: invoice.totalAmount - 0.01 },
  ]

  for (const intento of intentos) {
    try {
      console.log(`🔍 Intento: ${intento.desc}`)
      console.log(`   Fecha: ${intento.fecha}`)
      console.log(`   Monto: ${intento.monto.toFixed(2)}`)

      const resultado = await sunatService.validarComprobante({
        numRuc: invoice.rucEmisor || '',
        codComp: invoice.documentTypeCode || '01',
        numeroSerie: serie,
        numero: numero,
        fechaEmision: intento.fecha,
        monto: intento.monto.toFixed(2)
      })

      if (resultado.estadoCp === '1') {
        console.log(`\n🎉 ¡ENCONTRADO CON: ${intento.desc}!`)
        console.log(`   Estado CP: ${resultado.estadoCp}`)
        console.log(`   Estado RUC: ${resultado.estadoRuc}`)

        // Actualizar en base de datos
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            sunatVerified: true,
            sunatEstadoCp: resultado.estadoCp,
            sunatEstadoRuc: resultado.estadoRuc,
            sunatObservaciones: resultado.observaciones || [],
            sunatVerifiedAt: new Date(),
            // Corregir fecha si fue invertida
            ...(intento.desc.includes('invertida') ? {
              invoiceDate: new Date(`${anio}-${mes}-${dia}`)
            } : {})
          }
        })

        console.log('✅ Estado SUNAT actualizado')
        await prisma.$disconnect()
        return
      } else {
        console.log(`   ❌ Estado: ${resultado.estadoCp === '0' ? 'NO EXISTE' : resultado.estadoCp === '2' ? 'ANULADO' : 'RECHAZADO'}`)
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`)
    }
    console.log('')
  }

  console.log('═══════════════════════════════════════════')
  console.log('❌ NO SE ENCONTRÓ EN SUNAT')
  console.log('═══════════════════════════════════════════')
  console.log('')
  console.log('⚠️ POSIBLES CAUSAS:')
  console.log('1. No es factura electrónica SUNAT')
  console.log('2. Es documento interno de Azaleia')
  console.log('3. Documento aduanero con formato especial')
  console.log('4. Serie o número extraídos incorrectamente')
  console.log('')
  console.log('📝 RECOMENDACIÓN:')
  console.log('Verificar físicamente el documento original')
  console.log('y confirmar si tiene código QR SUNAT')
  console.log('')

  await prisma.$disconnect()
}

retryDHLInvoice()
