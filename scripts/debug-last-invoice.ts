import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoice = await prisma.invoice.findFirst({
    orderBy: { createdAt: 'desc' },
  })
  
  if (!invoice) {
    console.log('No invoices found')
    return
  }

  console.log('📄 Última Factura:')
  console.log('- ID:', invoice.id)
  console.log('- RUC Emisor:', invoice.rucEmisor || 'NOT FOUND')
  console.log('- Serie/Número:', invoice.serieNumero || 'NOT FOUND')
  console.log('- Fecha:', invoice.invoiceDate || 'NOT FOUND')
  console.log('\n📝 Texto extraído por Vision:')
  
  if (invoice.ocrData && typeof invoice.ocrData === 'object') {
    const ocrData = invoice.ocrData as any
    if (ocrData.rawData?.fullTextAnnotation?.text) {
      console.log(ocrData.rawData.fullTextAnnotation.text)
    } else {
      console.log('No hay texto completo disponible')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
