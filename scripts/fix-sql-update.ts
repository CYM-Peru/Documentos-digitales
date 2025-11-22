import { SqlServerService } from '../src/services/sqlserver'

async function test() {
  const sqlService = new SqlServerService({
    server: '190.119.245.254',
    database: 'AzaleiaPeru',
    user: 'cpalomino',
    password: 'azaleia.2018',
    port: 1433,
    encrypt: false,
    trustServerCertificate: true,
  })

  console.log('📊 Actualizando factura B003-00857663...')

  await sqlService.updateInvoice('cmhjsy3t9000dcyo5r4qopzju', {
    sunatVerified: true,
    sunatEstadoCp: '1'
  })

  console.log('✅ Actualizado correctamente')
  await sqlService.close()
}
test()
