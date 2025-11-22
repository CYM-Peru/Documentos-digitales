import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoice = await prisma.invoice.findFirst({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  })

  if (!invoice) {
    console.log('No hay facturas')
    return
  }

  console.log('📄 Última Factura:', invoice.serieNumero)
  console.log('\n📊 OCR DATA COMPLETO:')
  console.log(JSON.stringify(invoice.ocrData, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
