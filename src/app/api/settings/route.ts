import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, encryptObject } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ORG_ADMIN and SUPER_ADMIN can view settings
    if (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        awsAccessKey: true,
        awsRegion: true,
        googleSheetsId: true,
        googleDriveFolderId: true,
        geminiModel: true,
        geminiPrompt: true,
        n8nWebhookUrl: true,
        ocrProvider: true,
        emailNotifications: true,
        webhookNotifications: true,
        whatsappEnabled: true,
        whatsappApproverNumbers: true,
        whatsappNotifyPlanillaCreated: true,
        whatsappNotifyPlanillaApproved: true,
        whatsappNotifyPlanillaRejected: true,
        whatsappConnected: true,
        whatsappPhoneNumber: true,
        createdAt: true,
        updatedAt: true,
        // Don't send encrypted fields (awsSecretKey, googleServiceAccount, geminiApiKey)
      },
    })

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Get settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ORG_ADMIN and SUPER_ADMIN can update settings
    if (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const data: any = {}

    // AWS Textract settings
    if (body.awsAccessKey !== undefined) {
      data.awsAccessKey = body.awsAccessKey
    }
    if (body.awsSecretKey) {
      data.awsSecretKey = encrypt(body.awsSecretKey)
    }
    if (body.awsRegion) {
      data.awsRegion = body.awsRegion
    }

    // Google settings
    if (body.googleServiceAccount) {
      data.googleServiceAccount = encryptObject(body.googleServiceAccount)
    }
    if (body.googleSheetsId !== undefined) {
      data.googleSheetsId = body.googleSheetsId
    }
    if (body.googleDriveFolderId !== undefined) {
      data.googleDriveFolderId = body.googleDriveFolderId
    }

    // Gemini AI settings
    if (body.geminiApiKey) {
      data.geminiApiKey = encrypt(body.geminiApiKey)
    }
    if (body.geminiModel !== undefined) {
      data.geminiModel = body.geminiModel
    }
    if (body.geminiPrompt !== undefined) {
      data.geminiPrompt = body.geminiPrompt
    }

    // SUNAT API settings
    if (body.sunatClientId) {
      data.sunatClientId = encrypt(body.sunatClientId)
    }
    if (body.sunatClientSecret) {
      data.sunatClientSecret = encrypt(body.sunatClientSecret)
    }
    if (body.sunatRuc !== undefined) {
      data.sunatRuc = body.sunatRuc
    }
    if (body.sunatEnabled !== undefined) {
      data.sunatEnabled = body.sunatEnabled
    }

    // n8n settings
    if (body.n8nWebhookUrl !== undefined) {
      data.n8nWebhookUrl = body.n8nWebhookUrl
    }

    // OCR provider
    if (body.ocrProvider) {
      data.ocrProvider = body.ocrProvider
    }

    // Notifications
    if (body.emailNotifications !== undefined) {
      data.emailNotifications = body.emailNotifications
    }
    if (body.webhookNotifications !== undefined) {
      data.webhookNotifications = body.webhookNotifications
    }

    // WhatsApp Notifications
    if (body.whatsappEnabled !== undefined) {
      data.whatsappEnabled = body.whatsappEnabled
    }
    if (body.whatsappApproverNumbers !== undefined) {
      data.whatsappApproverNumbers = body.whatsappApproverNumbers
    }
    if (body.whatsappNotifyPlanillaCreated !== undefined) {
      data.whatsappNotifyPlanillaCreated = body.whatsappNotifyPlanillaCreated
    }
    if (body.whatsappNotifyPlanillaApproved !== undefined) {
      data.whatsappNotifyPlanillaApproved = body.whatsappNotifyPlanillaApproved
    }
    if (body.whatsappNotifyPlanillaRejected !== undefined) {
      data.whatsappNotifyPlanillaRejected = body.whatsappNotifyPlanillaRejected
    }

    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId: session.user.organizationId },
      update: data,
      create: {
        organizationId: session.user.organizationId,
        ...data,
      },
    })

    return NextResponse.json({ success: true, settings })
  } catch (error: any) {
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    )
  }
}
