import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/webhooks/whatsapp
 * Webhook para recibir eventos de Evolution API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('📱 WhatsApp Webhook Event:', JSON.stringify(body, null, 2))

    const { event, instance, data } = body

    // Manejar evento de conexión
    if (event === 'connection.update') {
      console.log(`🔌 Connection update for instance: ${instance}`)

      const state = data?.state || data?.connection?.state

      if (state === 'open') {
        console.log(`✅ WhatsApp connected for instance: ${instance}`)

        // Actualizar base de datos
        const settings = await prisma.organizationSettings.findFirst({
          where: { whatsappInstanceName: instance },
        })

        if (settings) {
          await prisma.organizationSettings.update({
            where: { id: settings.id },
            data: {
              whatsappConnected: true,
              whatsappPhoneNumber: data?.phoneNumber || null,
              whatsappConnectedAt: new Date(),
              whatsappQrCode: null, // Limpiar QR code
            },
          })

          console.log(`✅ Database updated - WhatsApp connected`)
        }
      } else if (state === 'close') {
        console.log(`⚠️ WhatsApp disconnected for instance: ${instance}`)

        // Actualizar base de datos
        const settings = await prisma.organizationSettings.findFirst({
          where: { whatsappInstanceName: instance },
        })

        if (settings) {
          await prisma.organizationSettings.update({
            where: { id: settings.id },
            data: {
              whatsappConnected: false,
              whatsappPhoneNumber: null,
            },
          })

          console.log(`✅ Database updated - WhatsApp disconnected`)
        }
      }
    }

    // Manejar evento de QR code actualizado
    if (event === 'qrcode.updated') {
      console.log(`📷 QR code updated for instance: ${instance}`)

      const qrCode = data?.qrcode?.base64 || data?.qrcode

      if (qrCode) {
        const settings = await prisma.organizationSettings.findFirst({
          where: { whatsappInstanceName: instance },
        })

        if (settings) {
          await prisma.organizationSettings.update({
            where: { id: settings.id },
            data: {
              whatsappQrCode: qrCode,
            },
          })

          console.log(`✅ QR code saved to database`)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ WhatsApp webhook error:', error)
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
