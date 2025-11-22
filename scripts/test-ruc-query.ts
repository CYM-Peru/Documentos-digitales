import { PrismaClient } from '@prisma/client'
import { decrypt } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 PROBANDO CONSULTA DE RUC\n')

  const settings = await prisma.organizationSettings.findFirst()
  const clientId = decrypt(settings!.sunatClientId!)
  const clientSecret = decrypt(settings!.sunatClientSecret!)
  const rucEmpresa = settings!.sunatRuc

  // Obtener token
  console.log('1️⃣ Obteniendo token...')
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
  console.log('✅ Token obtenido\n')

  // Probar consulta de RUC
  const rucParaConsultar = '20432405525' // PROCESOS DE MEDIOS DE PAGO S.A.

  console.log(`2️⃣ Consultando RUC: ${rucParaConsultar}`)
  const consultaUrl = `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${rucEmpresa}?numRuc=${rucParaConsultar}`

  console.log('URL:', consultaUrl)
  console.log()

  const response = await fetch(consultaUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  console.log('Status:', response.status)
  console.log('Status Text:', response.statusText)
  console.log()

  const responseText = await response.text()
  console.log('Respuesta completa (raw):')
  console.log(responseText)
  console.log()

  try {
    const jsonData = JSON.parse(responseText)
    console.log('Respuesta como JSON (pretty):')
    console.log(JSON.stringify(jsonData, null, 2))
  } catch (e) {
    console.log('❌ No se pudo parsear como JSON')
  }

  await prisma.$disconnect()
}

main()
