import { prisma } from '../src/lib/prisma'
import { SunatService } from '../src/services/sunat'
import { decrypt } from '../src/lib/encryption'

/**
 * Script para revalidar una factura específica en SUNAT
 * con datos corregidos manualmente
 */

async function revalidateInvoice() {
  const invoiceId = 'cmhjsy3t9000dcyo5r4qopzju' // B003-00857663

  console.log('🔄 Revalidando factura en SUNAT...\n')

  // Buscar factura y settings
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
    console.error('❌ Factura no encontrada')
    return
  }

  const settings = invoice.organization.settings

  if (!settings?.sunatEnabled || !settings.sunatClientId || !settings.sunatClientSecret) {
    console.error('❌ SUNAT no está configurado')
    return
  }

  console.log('📄 Factura:', invoice.serieNumero)
  console.log('RUC:', invoice.rucEmisor)
  console.log('Total:', invoice.totalAmount, invoice.currency)
  console.log('Fecha actual:', invoice.invoiceDate)
  console.log('')

  // Crear servicio SUNAT
  const sunatService = new SunatService({
    clientId: decrypt(settings.sunatClientId),
    clientSecret: decrypt(settings.sunatClientSecret),
    rucEmpresa: settings.sunatRuc || '',
  })

  // Fecha correcta: 03/11/2025 (3 de noviembre)
  const fechaCorrecta = '03/11/2025'
  const [serie, numero] = invoice.serieNumero?.split('-') || ['', '']

  console.log('🧪 Intentando con fecha corregida:', fechaCorrecta)
  console.log('')

  const datosCorregidos = {
    numRuc: invoice.rucEmisor || '',
    codComp: invoice.documentTypeCode || '03',
    numeroSerie: serie,
    numero: numero,
    fechaEmision: fechaCorrecta,
    monto: invoice.totalAmount?.toFixed(2) || '0'
  }

  console.log('📋 Datos a enviar:')
  console.log(datosCorregidos)
  console.log('')

  try {
    // Intentar validación
    const resultado = await sunatService.validarComprobante(datosCorregidos)

    console.log('✅ Respuesta SUNAT:')
    console.log('Estado CP:', resultado.estadoCp)
    console.log('Estado RUC:', resultado.estadoRuc)
    console.log('Observaciones:', resultado.observaciones)
    console.log('')

    if (resultado.estadoCp === '1') {
      console.log('🎉 ¡COMPROBANTE VÁLIDO EN SUNAT!')
      console.log('')
      console.log('📝 Actualizando base de datos...')

      // Actualizar factura con fecha correcta
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          invoiceDate: new Date('2025-11-03'), // Fecha correcta
          sunatVerified: true,
          sunatEstadoCp: resultado.estadoCp,
          sunatEstadoRuc: resultado.estadoRuc,
          sunatObservaciones: resultado.observaciones || [],
          sunatVerifiedAt: new Date(),
        }
      })

      console.log('✅ Factura actualizada correctamente')
      console.log('')
      console.log('═══════════════════════════════════════════')
      console.log('✅ REVALIDACIÓN EXITOSA')
      console.log('═══════════════════════════════════════════')
    } else {
      console.log('⚠️ Comprobante no válido')
      console.log('Estado:', resultado.estadoCp === '0' ? 'NO EXISTE' : resultado.estadoCp === '2' ? 'ANULADO' : resultado.estadoCp === '3' ? 'RECHAZADO' : 'DESCONOCIDO')
    }

  } catch (error: any) {
    console.error('❌ Error en validación:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

revalidateInvoice()
