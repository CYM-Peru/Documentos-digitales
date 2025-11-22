import { PrismaClient } from '@prisma/client'
import { SunatService } from '../src/services/sunat'
import { decrypt } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 DIAGNÓSTICO SUNAT - INICIO\n')
  console.log('═'.repeat(80))

  try {
    // 1. Verificar configuración en base de datos
    console.log('\n📋 PASO 1: Verificando configuración...\n')

    const settings = await prisma.organizationSettings.findFirst()

    if (!settings) {
      console.error('❌ ERROR: No se encontró configuración de organización')
      return
    }

    console.log('✅ Configuración encontrada:')
    console.log(`   - Organization ID: ${settings.organizationId}`)
    console.log(`   - SUNAT Enabled: ${settings.sunatEnabled}`)
    console.log(`   - SUNAT RUC: ${settings.sunatRuc || 'NO CONFIGURADO'}`)
    console.log(`   - Client ID encriptado: ${settings.sunatClientId ? 'SÍ' : 'NO'}`)
    console.log(`   - Client Secret encriptado: ${settings.sunatClientSecret ? 'SÍ' : 'NO'}`)

    if (!settings.sunatEnabled) {
      console.log('\n⚠️ SUNAT está DESHABILITADO. Habilitando...')
      await prisma.organizationSettings.update({
        where: { id: settings.id },
        data: { sunatEnabled: true }
      })
      console.log('✅ SUNAT habilitado')
    }

    if (!settings.sunatClientId || !settings.sunatClientSecret || !settings.sunatRuc) {
      console.error('\n❌ ERROR: Credenciales SUNAT no configuradas completamente')
      console.error('   Ejecuta: npm run configure-sunat')
      return
    }

    // 2. Desencriptar credenciales
    console.log('\n🔐 PASO 2: Desencriptando credenciales...\n')

    let clientId: string
    let clientSecret: string

    try {
      clientId = decrypt(settings.sunatClientId)
      clientSecret = decrypt(settings.sunatClientSecret)
      console.log('✅ Credenciales desencriptadas exitosamente')
      console.log(`   - Client ID: ${clientId.substring(0, 20)}...`)
      console.log(`   - Client Secret: ${clientSecret.substring(0, 10)}...`)
      console.log(`   - RUC Empresa: ${settings.sunatRuc}`)
    } catch (error: any) {
      console.error('❌ ERROR al desencriptar credenciales:', error.message)
      console.error('   Verifica que ENCRYPTION_KEY esté configurado en .env')
      return
    }

    // 3. Crear servicio SUNAT y probar autenticación
    console.log('\n🔑 PASO 3: Probando autenticación OAuth2 con SUNAT...\n')

    const sunatService = new SunatService({
      clientId: clientId,
      clientSecret: clientSecret,
      rucEmpresa: settings.sunatRuc
    })

    try {
      // Intentar obtener token (esto llama al endpoint de autenticación)
      const token = await (sunatService as any).obtenerToken()
      console.log('✅ AUTENTICACIÓN EXITOSA con SUNAT')
      console.log(`   - Token obtenido: ${token.substring(0, 50)}...`)
    } catch (error: any) {
      console.error('❌ ERROR DE AUTENTICACIÓN:', error.message)
      console.error('\n🔍 Detalles del error:')
      console.error(error)
      console.error('\n📝 Posibles causas:')
      console.error('   1. Client ID o Client Secret incorrectos')
      console.error('   2. Credenciales expiradas')
      console.error('   3. RUC no tiene permisos para usar la API')
      console.error('   4. Problema de conectividad con api-seguridad.sunat.gob.pe')
      return
    }

    // 4. Buscar una factura para probar validación
    console.log('\n📄 PASO 4: Buscando factura para probar...\n')

    const invoice = await prisma.invoice.findFirst({
      where: {
        status: 'COMPLETED',
        rucEmisor: { not: null },
        serieNumero: { not: null },
        totalAmount: { not: null },
        invoiceDate: { not: null }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!invoice) {
      console.error('❌ No se encontró ninguna factura válida para probar')
      return
    }

    console.log('✅ Factura encontrada:')
    console.log(`   - ID: ${invoice.id}`)
    console.log(`   - Serie-Número: ${invoice.serieNumero}`)
    console.log(`   - RUC Emisor: ${invoice.rucEmisor}`)
    console.log(`   - Fecha: ${invoice.invoiceDate}`)
    console.log(`   - Monto: ${invoice.currency} ${invoice.totalAmount}`)
    console.log(`   - Tipo: ${invoice.documentTypeCode}`)

    // 5. Convertir datos al formato SUNAT
    console.log('\n🔄 PASO 5: Convirtiendo datos al formato SUNAT...\n')

    const datosParaSunat = SunatService.convertirDatosParaSunat({
      rucEmisor: invoice.rucEmisor,
      documentTypeCode: invoice.documentTypeCode,
      serieNumero: invoice.serieNumero,
      invoiceDate: invoice.invoiceDate,
      totalAmount: invoice.totalAmount
    })

    if (!datosParaSunat) {
      console.error('❌ ERROR: No se pudieron convertir los datos')
      console.error('   Datos de la factura:')
      console.error('   ', {
        rucEmisor: invoice.rucEmisor,
        documentTypeCode: invoice.documentTypeCode,
        serieNumero: invoice.serieNumero,
        invoiceDate: invoice.invoiceDate,
        totalAmount: invoice.totalAmount
      })
      return
    }

    console.log('✅ Datos convertidos:')
    console.log('   ', datosParaSunat)

    // 6. Validar con SUNAT
    console.log('\n🔍 PASO 6: Validando comprobante con SUNAT...\n')
    console.log('   (Esto puede tardar 10-20 segundos con reintentos)\n')

    try {
      const { resultado, intentos, variacionUsada } = await sunatService.validarComprobanteConReintentos(datosParaSunat, 3)

      console.log('✅ VALIDACIÓN COMPLETADA')
      console.log(`   - Intentos: ${intentos}`)
      if (variacionUsada) {
        console.log(`   - Variación usada: ${variacionUsada}`)
      }
      console.log('\n📊 RESULTADO:')
      console.log('   - Estado CP:', resultado.estadoCp)
      console.log('   - Estado RUC:', resultado.estadoRuc)
      console.log('   - Observaciones:', resultado.observaciones)

      const interpretacion = SunatService.interpretarEstado(resultado.estadoCp)
      console.log(`\n${interpretacion.valido ? '✅' : '❌'} ${interpretacion.mensaje}`)

      // 7. Actualizar en base de datos
      console.log('\n💾 PASO 7: Actualizando base de datos...\n')

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          sunatVerified: interpretacion.valido,
          sunatEstadoCp: resultado.estadoCp,
          sunatEstadoRuc: resultado.estadoRuc,
          sunatObservaciones: resultado.observaciones || [],
          sunatVerifiedAt: new Date(),
          sunatRetries: intentos
        }
      })

      console.log('✅ Base de datos actualizada')

    } catch (error: any) {
      console.error('❌ ERROR AL VALIDAR:', error.message)
      console.error('\n🔍 Detalles del error:')
      console.error(error)
      console.error('\n📝 Posibles causas:')
      console.error('   1. Factura muy antigua (SUNAT solo valida facturas recientes)')
      console.error('   2. Monto o fecha no coinciden exactamente')
      console.error('   3. Proveedor nunca registró la factura en SUNAT')
      console.error('   4. Serie o número incorrectos')
      console.error('   5. Error de conectividad con api.sunat.gob.pe')
    }

  } catch (error: any) {
    console.error('\n❌ ERROR GENERAL:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }

  console.log('\n' + '═'.repeat(80))
  console.log('🔍 DIAGNÓSTICO SUNAT - FIN\n')
}

main()
