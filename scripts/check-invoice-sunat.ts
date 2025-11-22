import { prisma } from '../src/lib/prisma'

async function checkInvoice() {
  const invoice = await prisma.invoice.findFirst({
    where: {
      serieNumero: 'B003-00857663',
      rucEmisor: '20510957581'
    },
    select: {
      id: true,
      serieNumero: true,
      rucEmisor: true,
      razonSocialEmisor: true,
      documentType: true,
      documentTypeCode: true,
      invoiceDate: true,
      totalAmount: true,
      subtotal: true,
      igvMonto: true,
      currency: true,
      sunatVerified: true,
      sunatEstadoCp: true,
      sunatRetries: true,
      createdAt: true,
      ocrData: true,
    }
  })

  if (!invoice) {
    console.log('❌ Factura no encontrada en la base de datos')
    return
  }

  console.log('📄 FACTURA ENCONTRADA:\n')
  console.log('ID:', invoice.id)
  console.log('Serie-Número:', invoice.serieNumero)
  console.log('RUC Emisor:', invoice.rucEmisor)
  console.log('Razón Social:', invoice.razonSocialEmisor)
  console.log('Tipo Documento:', invoice.documentType, `(${invoice.documentTypeCode})`)
  console.log('Fecha emisión:', invoice.invoiceDate)
  console.log('Total:', invoice.totalAmount, invoice.currency)
  console.log('Subtotal:', invoice.subtotal)
  console.log('IGV:', invoice.igvMonto)
  console.log('\n🔍 VALIDACIÓN SUNAT:')
  console.log('Verificado:', invoice.sunatVerified)
  console.log('Estado CP:', invoice.sunatEstadoCp, invoice.sunatEstadoCp === '0' ? '(NO EXISTE)' : invoice.sunatEstadoCp === '1' ? '(VÁLIDO)' : '')
  console.log('Reintentos realizados:', invoice.sunatRetries || 0)
  console.log('Fecha creación:', invoice.createdAt)

  console.log('\n📋 DATOS ENVIADOS A SUNAT:')
  if (invoice.invoiceDate) {
    const date = new Date(invoice.invoiceDate)
    const dia = String(date.getUTCDate()).padStart(2, '0')
    const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
    const anio = date.getUTCFullYear()
    const fechaSunat = `${dia}/${mes}/${anio}`

    const [serie, numero] = invoice.serieNumero?.split('-') || ['', '']

    console.log({
      numRuc: invoice.rucEmisor,
      codComp: invoice.documentTypeCode,
      numeroSerie: serie,
      numero: numero,
      fechaEmision: fechaSunat,
      monto: invoice.totalAmount?.toFixed(2)
    })
  }

  await prisma.$disconnect()
}

checkInvoice()
