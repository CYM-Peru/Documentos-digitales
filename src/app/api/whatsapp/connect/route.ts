import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WhatsAppService } from '@/services/whatsapp'

/**
 * POST /api/whatsapp/connect
 * Crear instancia y obtener QR code para conectar WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Solo SUPER_ADMIN y ORG_ADMIN pueden configurar WhatsApp
    if (!['SUPER_ADMIN', 'ORG_ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Obtener settings
    const settings = await prisma.organizationSettings.findFirst({
      where: { organizationId: session.user.organizationId },
    })

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    const instanceName = settings.whatsappInstanceName || 'azaleia-whatsapp'
    const apiUrl = settings.whatsappApiUrl || 'http://localhost:8081'
    const apiKey = settings.whatsappApiKey || 'B6D711FCDE4D4FD5936544120E713976'

    const whatsappService = new WhatsAppService(apiUrl, apiKey)

    // Intentar crear instancia, si ya existe intentar eliminarla y recrearla
    let instanceCreated = false
    let createResponse: any = null
    try {
      createResponse = await whatsappService.createInstance(instanceName)
      instanceCreated = true
      console.log(`✅ Instance ${instanceName} created successfully`)
    } catch (createError: any) {
      // Si la instancia ya existe, eliminarla y recrearla
      if (createError.message.includes('already in use')) {
        console.log(`⚠️ Instance ${instanceName} already exists, attempting to recreate...`)
        try {
          // Eliminar instancia existente
          const deleted = await whatsappService.deleteInstance(instanceName)
          if (!deleted) {
            throw new Error('Failed to delete existing instance')
          }

          // Esperar 3 segundos para asegurar que se elimine completamente
          await new Promise(resolve => setTimeout(resolve, 3000))

          // Crear nueva instancia
          createResponse = await whatsappService.createInstance(instanceName)
          instanceCreated = true
          console.log(`✅ Instance ${instanceName} recreated successfully`)
        } catch (deleteError: any) {
          console.error('Failed to recreate instance:', deleteError)
          throw new Error(`No se pudo recrear la instancia de WhatsApp. Por favor, intenta nuevamente en unos momentos.`)
        }
      } else {
        throw createError
      }
    }

    // Intentar obtener el QR code de la respuesta de creación primero
    let qrCode = createResponse?.qrcode?.base64 || null
    console.log(`🔍 QR from creation response: ${qrCode ? 'YES (' + qrCode.length + ' chars)' : 'NO'}`)

    // Si no está en la respuesta, intentar con reintentos
    if (!qrCode) {
      console.log(`🔄 QR not in response, attempting to get with retries...`)
      qrCode = await whatsappService.getQRCode(instanceName, 15)
    }

    if (!qrCode) {
      console.log(`⚠️ No QR code obtained, but instance created. User can try refreshing.`)
    }

    // Guardar en base de datos
    await prisma.organizationSettings.update({
      where: { id: settings.id },
      data: {
        whatsappInstanceName: instanceName,
        whatsappQrCode: qrCode,
        whatsappConnected: false,
      },
    })

    console.log(`✅ Instance ${instanceName} created${qrCode ? ' with QR code' : ', QR pending'}`)

    return NextResponse.json({
      success: true,
      instanceName,
      qrCode,
      message: qrCode ? 'Escanea el QR code con WhatsApp' : 'Instancia creada, QR en proceso...',
    })
  } catch (error: any) {
    console.error('WhatsApp connect error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to connect WhatsApp' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/whatsapp/connect
 * Obtener estado de conexión actual y QR code (si está disponible)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await prisma.organizationSettings.findFirst({
      where: { organizationId: session.user.organizationId },
      select: {
        whatsappEnabled: true,
        whatsappConnected: true,
        whatsappPhoneNumber: true,
        whatsappInstanceName: true,
        whatsappQrCode: true,
        whatsappConnectedAt: true,
      },
    })

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 })
    }

    // Agregar información adicional para debugging
    console.log(`📱 WhatsApp status requested - Connected: ${settings.whatsappConnected}, Has QR: ${!!settings.whatsappQrCode}`)

    return NextResponse.json({
      success: true,
      ...settings,
      qrCode: settings.whatsappQrCode, // Incluir QR code explícitamente
    })
  } catch (error: any) {
    console.error('WhatsApp status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get WhatsApp status' },
      { status: 500 }
    )
  }
}
