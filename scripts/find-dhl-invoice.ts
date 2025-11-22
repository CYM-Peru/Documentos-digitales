import { prisma } from '../src/lib/prisma'

async function findDHLInvoice() {
  console.log('🔍 Buscando factura de DHL...\n')

  // Buscar por DHL en cualquier campo
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { razonSocialEmisor: { contains: 'DHL', mode: 'insensitive' } },
        { vendorName: { contains: 'DHL', mode: 'insensitive' } },
        { razonSocialReceptor: { contains: 'DHL', mode: 'insensitive' } },
        { rucEmisor: '20410739350' }, // RUC de DHL Express
        { rucEmisor: '20100184391' }, // RUC de DHL Global Forwarding
      ],
      status: 'COMPLETED'
    },
    select: {
      id: true,
      serieNumero: true,
      documentType: true,
      documentTypeCode: true,
      createdAt: true,
      invoiceDate: true,
      totalAmount: true,
      currency: true,

      // EMISOR
      rucEmisor: true,
      razonSocialEmisor: true,
      vendorName: true,
      domicilioFiscalEmisor: true,

      // RECEPTOR
      rucReceptor: true,
      razonSocialReceptor: true,
      dniReceptor: true,

      // SUNAT
      sunatVerified: true,
      sunatEstadoCp: true,

      imageUrl: true,
      imageName: true,
      ocrData: true,
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (invoices.length === 0) {
    console.log('❌ No se encontraron facturas de DHL')
    console.log('\n🔍 Buscando cualquier factura con Azaleia como emisor (posible error)...\n')

    // Buscar facturas donde Azaleia aparece como emisor
    const azaleiaAsEmisor = await prisma.invoice.findMany({
      where: {
        rucEmisor: '20374412524', // RUC de Azaleia
        status: 'COMPLETED'
      },
      select: {
        id: true,
        serieNumero: true,
        razonSocialEmisor: true,
        razonSocialReceptor: true,
        totalAmount: true,
        documentType: true,
        createdAt: true,
        imageName: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    })

    console.log(`📊 Facturas con Azaleia como EMISOR: ${azaleiaAsEmisor.length}\n`)
    azaleiaAsEmisor.forEach((inv, i) => {
      console.log(`${i+1}. ${inv.serieNumero} - ${inv.documentType}`)
      console.log(`   Emisor: AZALEIA (RUC 20374412524)`)
      console.log(`   Receptor: ${inv.razonSocialReceptor || 'N/A'}`)
      console.log(`   Total: ${inv.totalAmount}`)
      console.log(`   Imagen: ${inv.imageName}`)
      console.log(`   ID: ${inv.id}\n`)
    })

    await prisma.$disconnect()
    return
  }

  console.log(`📊 Encontradas: ${invoices.length} factura(s) de DHL\n`)
  console.log('═══════════════════════════════════════════════════════════════════════════════')

  for (const invoice of invoices) {
    console.log('\n📄 FACTURA DE DHL ENCONTRADA:\n')
    console.log('ID:', invoice.id)
    console.log('Serie-Número:', invoice.serieNumero)
    console.log('Tipo:', invoice.documentType, `(${invoice.documentTypeCode})`)
    console.log('Fecha emisión:', invoice.invoiceDate)
    console.log('Total:', invoice.currency, invoice.totalAmount)
    console.log('')
    console.log('👤 EMISOR (quien emite la factura):')
    console.log(`   RUC: ${invoice.rucEmisor}`)
    console.log(`   Razón Social: ${invoice.razonSocialEmisor}`)
    console.log(`   Nombre comercial: ${invoice.vendorName}`)
    console.log('')
    console.log('👥 RECEPTOR (quien recibe la factura):')
    console.log(`   RUC: ${invoice.rucReceptor}`)
    console.log(`   DNI: ${invoice.dniReceptor || 'N/A'}`)
    console.log(`   Razón Social: ${invoice.razonSocialReceptor}`)
    console.log('')
    console.log('🔍 VALIDACIÓN SUNAT:')
    console.log(`   Verificado: ${invoice.sunatVerified ? '✅ SÍ' : '❌ NO'}`)
    console.log(`   Estado: ${invoice.sunatEstadoCp || 'N/A'}`)
    console.log('')
    console.log('📸 IMAGEN:')
    console.log(`   Nombre: ${invoice.imageName}`)
    console.log(`   URL: http://cockpit.azaleia.com.pe${invoice.imageUrl}`)
    console.log('')

    if (invoice.ocrData) {
      console.log('📋 DATOS OCR EXTRAÍDOS:')
      const ocrData = invoice.ocrData as any

      if (ocrData.rawData) {
        console.log('\n   EMISOR según OCR:')
        console.log(`   - RUC: ${ocrData.rawData.emisor?.ruc || 'N/A'}`)
        console.log(`   - Razón Social: ${ocrData.rawData.emisor?.razonSocial || 'N/A'}`)
        console.log(`   - Domicilio: ${ocrData.rawData.emisor?.domicilioFiscal || 'N/A'}`)

        console.log('\n   RECEPTOR según OCR:')
        console.log(`   - Tipo Doc: ${ocrData.rawData.receptor?.tipoDocumento || 'N/A'}`)
        console.log(`   - Número: ${ocrData.rawData.receptor?.numeroDocumento || 'N/A'}`)
        console.log(`   - Razón Social: ${ocrData.rawData.receptor?.razonSocial || 'N/A'}`)
      }

      console.log('\n   ⚠️ ANÁLISIS:')
      const emisorEsAzaleia = invoice.rucEmisor === '20374412524'
      const receptorEsAzaleia = invoice.rucReceptor === '20374412524'

      if (emisorEsAzaleia && !receptorEsAzaleia) {
        console.log('   🐛 ERROR: Azaleia aparece como EMISOR cuando debería ser RECEPTOR')
        console.log('   ✅ CORRECTO: DHL debería ser el EMISOR, Azaleia el RECEPTOR')
      } else if (!emisorEsAzaleia && receptorEsAzaleia) {
        console.log('   ✅ CORRECTO: Azaleia es el RECEPTOR')
      } else if (emisorEsAzaleia && receptorEsAzaleia) {
        console.log('   🐛 ERROR: Azaleia aparece como EMISOR Y RECEPTOR')
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════════════')
  }

  await prisma.$disconnect()
}

findDHLInvoice()
