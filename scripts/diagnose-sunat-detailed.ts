import { PrismaClient } from '@prisma/client'
import { decrypt } from '../src/lib/encryption'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 DIAGNÓSTICO DETALLADO - RESPUESTA SUNAT\n')

  const settings = await prisma.organizationSettings.findFirst()
  const clientId = decrypt(settings!.sunatClientId!)
  const clientSecret = decrypt(settings!.sunatClientSecret!)
  const rucEmpresa = settings!.sunatRuc

  // 1. Obtener token
  console.log('🔑 Obteniendo token OAuth2...\n')

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

  if (!tokenResponse.ok) {
    console.error('❌ Error obteniendo token')
    console.error(await tokenResponse.text())
    return
  }

  const tokenData = await tokenResponse.json()
  const token = tokenData.access_token
  console.log('✅ Token obtenido\n')

  // 2. Validar comprobante
  console.log('📝 Validando comprobante...\n')

  const validarUrl = `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${rucEmpresa}/validarcomprobante`

  const datos = {
    numRuc: '20374412524',
    codComp: '03',
    numeroSerie: 'B002',
    numero: '00058549',
    fechaEmision: '24/10/2025',
    monto: '59.90'
  }

  console.log('📤 Enviando a SUNAT:')
  console.log(JSON.stringify(datos, null, 2))
  console.log()

  const validarResponse = await fetch(validarUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(datos),
  })

  console.log('📥 Status HTTP:', validarResponse.status, validarResponse.statusText)
  console.log()

  const responseText = await validarResponse.text()

  console.log('📥 RESPUESTA COMPLETA DE SUNAT:')
  console.log('═'.repeat(80))
  console.log(responseText)
  console.log('═'.repeat(80))
  console.log()

  if (validarResponse.ok) {
    try {
      const resultado = JSON.parse(responseText)
      console.log('✅ JSON parseado exitosamente:')
      console.log(JSON.stringify(resultado, null, 2))
      console.log()
      console.log('🔍 Campos disponibles:', Object.keys(resultado))
    } catch (e) {
      console.error('❌ No se pudo parsear como JSON')
    }
  } else {
    console.error('❌ Error de SUNAT')
  }

  await prisma.$disconnect()
}

main()
