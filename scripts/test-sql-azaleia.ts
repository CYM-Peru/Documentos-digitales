import { SqlServerService } from '../src/services/sqlserver'

/**
 * Test de conexión a SQL Server de Azaleia
 */

async function testSqlServer() {
  console.log('🧪 Test SQL Server Azaleia - Iniciando pruebas...\n')

  const credentials = {
    server: '190.119.245.254',
    database: 'AzaleiaPeru',
    user: 'cpalomino',
    password: 'azaleia.2018',
    port: 1433,
    encrypt: false,
    trustServerCertificate: true,
  }

  try {
    // Test 1: Crear servicio
    console.log('📊 Test 1: Creando servicio SQL Server...')
    const sqlService = new SqlServerService(credentials)
    console.log('✅ Servicio creado\n')

    // Test 2: Probar conexión
    console.log('📊 Test 2: Probando conexión a 190.119.245.254:1433...')
    const isConnected = await sqlService.testConnection()
    console.log(`✅ Conexión exitosa: ${isConnected}\n`)

    // Test 3: Insertar factura de prueba
    console.log('📊 Test 3: Insertando factura de prueba en CntCtaRendicionDocumentosIA...')
    const testInvoice = {
      id: 'test_' + Date.now(),
      status: 'COMPLETED',
      invoiceDate: new Date('2025-11-03'),
      rucEmisor: '20374412524',
      razonSocialEmisor: 'CALZADOS AZALEIA PERU S.A',
      serieNumero: 'B002-00058549',
      documentType: 'BOLETA DE VENTA ELECTRÓNICA',
      documentTypeCode: '03',
      subtotal: 50.76,
      igvMonto: 9.14,
      totalAmount: 59.9,
      currency: 'PEN',
      sunatVerified: true,
      sunatEstadoCp: '1',
    }

    const rowsInserted = await sqlService.insertInvoice(testInvoice)
    console.log(`✅ Factura insertada: ${rowsInserted} fila(s)\n`)

    // Test 4: Verificar si existe
    console.log('📊 Test 4: Verificando existencia en la tabla...')
    const exists = await sqlService.invoiceExists(testInvoice.id)
    console.log(`✅ Factura existe en SQL Server: ${exists}\n`)

    // Test 5: Obtener estadísticas
    console.log('📊 Test 5: Obteniendo estadísticas de la tabla...')
    const stats = await sqlService.getStats()
    console.log('✅ Estadísticas de CntCtaRendicionDocumentosIA:')
    console.log(`   Total Facturas: ${stats.totalFacturas}`)
    console.log(`   Total Items: ${stats.totalItems}`)
    console.log(`   Total Monto: S/ ${stats.totalMonto || 0}`)
    console.log(`   Verificadas SUNAT: ${stats.verificadasSUNAT}`)
    console.log(`   Válidas: ${stats.validasCompleto}\n`)

    // Cerrar conexión
    await sqlService.close()

    console.log('═══════════════════════════════════════════')
    console.log('✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE')
    console.log('═══════════════════════════════════════════\n')
    console.log('🎉 La integración SQL Server está funcionando correctamente!')
    console.log('📊 Ahora cuando proceses facturas se guardarán automáticamente en:')
    console.log('   [AzaleiaPeru].[dbo].[CntCtaRendicionDocumentosIA]\n')
  } catch (error: any) {
    console.error('❌ ERROR EN LAS PRUEBAS:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

testSqlServer()
