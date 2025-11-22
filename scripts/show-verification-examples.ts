import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  console.log('📊 EJEMPLOS DE VERIFICACIÓN SUNAT:\n')
  console.log('═'.repeat(80))

  for (const inv of invoices) {
    console.log(`\n📄 Factura: ${inv.serieNumero || 'N/A'}`)
    console.log(`   Emisor: ${inv.razonSocialEmisor || 'N/A'}`)
    console.log(`   RUC: ${inv.rucEmisor || 'N/A'}`)
    console.log(`   Total: ${inv.currency || 'S/'} ${inv.totalAmount?.toFixed(2) || '0.00'}`)

    // Estado de Verificación
    if (inv.sunatVerified === true) {
      console.log(`   ✅ SUNAT: VÁLIDO`)
      console.log(`      - Estado CP: ${inv.sunatEstadoCp === '1' ? '1 - VÁLIDO' : inv.sunatEstadoCp}`)
      console.log(`      - Estado RUC: ${inv.sunatEstadoRuc === '00' ? '00 - ACTIVO' : inv.sunatEstadoRuc || 'N/A'}`)
      console.log(`      - Verificado: ${inv.sunatVerifiedAt ? new Date(inv.sunatVerifiedAt).toLocaleString('es-PE') : 'N/A'}`)
    } else if (inv.sunatVerified === false) {
      if (inv.sunatEstadoCp === '0') {
        console.log(`   ❌ SUNAT: NO EXISTE EN SUNAT`)
        console.log(`      - ⚠️ ALERTA: Esta factura NO está registrada`)
        console.log(`      - 🚨 Posible fraude o error del proveedor`)
      } else if (inv.sunatEstadoCp === '2') {
        console.log(`   🔶 SUNAT: ANULADO`)
        console.log(`      - ⚠️ El proveedor canceló este comprobante`)
      } else {
        console.log(`   ❌ SUNAT: NO VÁLIDO`)
        console.log(`      - Estado CP: ${inv.sunatEstadoCp || 'Desconocido'}`)
      }
    } else {
      console.log(`   ⏳ SUNAT: PENDIENTE DE VERIFICACIÓN`)
      console.log(`      - Aún no se validó con SUNAT`)
    }

    console.log('─'.repeat(80))
  }

  console.log('\n\n📖 GUÍA DE INTERPRETACIÓN:\n')
  console.log('✅ VÁLIDO       = Comprobante legítimo, úsalo con confianza')
  console.log('❌ NO EXISTE    = 🚨 ALERTA DE FRAUDE - Contacta al proveedor')
  console.log('🔶 ANULADO      = Comprobante cancelado - Solicita corrección')
  console.log('⏳ PENDIENTE    = Aún no verificado - Click en "Re-validar"')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
