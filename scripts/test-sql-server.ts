import { SqlServerService } from '../src/services/sqlserver'
import { encrypt } from '../src/lib/encryption'

/**
 * Script de prueba para SQL Server
 *
 * INSTRUCCIONES:
 * 1. Edita las credenciales abajo
 * 2. Ejecuta: npx tsx scripts/test-sql-server.ts
 */

async function testSqlServer() {
  console.log('🧪 Test SQL Server - Iniciando pruebas...\n')

  // ════════════════════════════════════════════════════════════
  // 📝 CONFIGURA TUS CREDENCIALES AQUÍ
  // ════════════════════════════════════════════════════════════
  const credentials = {
    // Para SQL Server LOCAL (on-premise):
    server: 'localhost',  // o IP: '192.168.1.100'
    // Si usas instancia nombrada: 'localhost\\SQLEXPRESS'

    database: 'AzaleiaPeru',
    user: 'sa',  // o tu usuario SQL
    password: 'tu_password',
    port: 1433,

    // IMPORTANTE para SQL Server LOCAL:
    encrypt: false, // false para SQL Server local sin SSL
    trustServerCertificate: true, // true para SQL Server local
  }

  try {
    // Test 1: Crear servicio
    console.log('📊 Test 1: Creando servicio SQL Server...')
    const sqlService = new SqlServerService(credentials)
    console.log('✅ Servicio creado\n')

    // Test 2: Probar conexión
    console.log('📊 Test 2: Probando conexión...')
    const isConnected = await sqlService.testConnection()
    console.log(`✅ Conexión exitosa: ${isConnected}\n`)

    // Test 3: Insertar factura de prueba
    console.log('📊 Test 3: Insertando factura de prueba...')
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
    console.log('📊 Test 4: Verificando existencia...')
    const exists = await sqlService.invoiceExists(testInvoice.id)
    console.log(`✅ Factura existe: ${exists}\n`)

    // Test 5: Actualizar factura
    console.log('📊 Test 5: Actualizando factura...')
    await sqlService.updateInvoice(testInvoice.id, {
      sunatVerified: false,
      sunatEstadoCp: '0',
    })
    console.log('✅ Factura actualizada\n')

    // Test 6: Obtener estadísticas
    console.log('📊 Test 6: Obteniendo estadísticas...')
    const stats = await sqlService.getStats()
    console.log('✅ Estadísticas:')
    console.log(JSON.stringify(stats, null, 2))
    console.log('')

    // Cerrar conexión
    await sqlService.close()

    console.log('═══════════════════════════════════════════')
    console.log('✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE')
    console.log('═══════════════════════════════════════════\n')

    // Mostrar cómo configurar en el sistema
    console.log('📋 SIGUIENTE PASO: Configurar en el Admin Panel\n')
    console.log('Usa estas credenciales ENCRIPTADAS en el admin panel:')
    console.log('─────────────────────────────────────────────────────')
    console.log('Server (encrypted):', encrypt(credentials.server))
    console.log('User (encrypted):', encrypt(credentials.user))
    console.log('Password (encrypted):', encrypt(credentials.password))
    console.log('Database:', credentials.database)
    console.log('Port:', credentials.port)
    console.log('Encrypt:', credentials.encrypt)
    console.log('─────────────────────────────────────────────────────\n')
  } catch (error: any) {
    console.error('❌ ERROR EN LAS PRUEBAS:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

testSqlServer()
