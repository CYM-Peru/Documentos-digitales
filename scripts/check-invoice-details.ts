import { prisma } from '../src/lib/prisma'

async function checkDetails() {
  const invoiceIds = [
    'cmhupsmtb0001ddsx9af2o6z4', // E001-9
    'cmhjegug50009cyo5gtxblbz4', // B190-00216815
    'cmhje5hco0005cyo5xkgcf3qv', // B022-7932
    'cmhj9zxwh0001cyo53ho1c5zn', // F216-00615007
    'cmhjef5xh0007cyo5tnhxsk6s', // E001-1279 (falta)
  ]

  for (const id of invoiceIds) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
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
        imageUrl: true,
        imageName: true,
        ocrData: true,
      }
    })

    if (!invoice) {
      console.log(`❌ Factura ${id} no encontrada\n`)
      continue
    }

    console.log('═══════════════════════════════════════════════════════════════')
    console.log(`📄 ${invoice.serieNumero}`)
    console.log(`   RUC: ${invoice.rucEmisor} - ${invoice.razonSocialEmisor}`)
    console.log(`   Tipo: ${invoice.documentType} (código: ${invoice.documentTypeCode})`)
    console.log(`   Fecha: ${invoice.invoiceDate}`)
    console.log(`   Total: ${invoice.currency} ${invoice.totalAmount}`)
    console.log(`   Subtotal: ${invoice.subtotal}`)
    console.log(`   IGV: ${invoice.igvMonto}`)
    console.log(`   Imagen: ${invoice.imageName}`)
    console.log(`   URL: http://cockpit.azaleia.com.pe${invoice.imageUrl}`)
    console.log('\n   📋 Datos OCR extraídos:')
    console.log(JSON.stringify(invoice.ocrData, null, 2))
    console.log('')
  }

  await prisma.$disconnect()
}

checkDetails()
