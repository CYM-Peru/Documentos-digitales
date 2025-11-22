import { PrismaClient } from '@prisma/client'
import { decrypt } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 PROBANDO VARIACIONES DE MONTO\n')

  const settings = await prisma.organizationSettings.findFirst()
  const clientId = decrypt(settings!.sunatClientId!)
  const clientSecret = decrypt(settings!.sunatClientSecret!)
  const rucEmpresa = settings!.sunatRuc

  // Obtener token
  const tokenUrl = `https://api-seguridad.sunat.gob.pe/v1/clientesextranet/${clientId}/oauth2/token/`
  const tokenParams = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams,
  })

  const tokenData = await tokenResponse.json()
  const token = tokenData.access_token

  const validarUrl = `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${rucEmpresa}/validarcomprobante`

  // Probar con monto exacto
  console.log('1️⃣ Probando con monto EXACTO (59.90):')
  let datos = {
    numRuc: '20374412524',
    codComp: '03',
    numeroSerie: 'B002',
    numero: '00058549',
    fechaEmision: '24/10/2025',
    monto: '59.90'
  }

  let response = await fetch(validarUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(datos),
  })

  let responseText = await response.text()
  console.log('Respuesta:', responseText)
  console.log()

  // Probar con monto +0.01
  console.log('2️⃣ Probando con monto +0.01 (59.91):')
  datos.monto = '59.91'

  response = await fetch(validarUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(datos),
  })

  responseText = await response.text()
  console.log('Respuesta:', responseText)
  console.log()

  //  Probar con monto completamente incorrecto
  console.log('3️⃣ Probando con monto INCORRECTO (100.00):')
  datos.monto = '100.00'

  response = await fetch(validarUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(datos),
  })

  responseText = await response.text()
  console.log('Respuesta:', responseText)

  await prisma.$disconnect()
}

main()
