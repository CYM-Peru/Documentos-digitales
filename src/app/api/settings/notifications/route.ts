import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET - Obtener configuracion de notificaciones
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN' && session.user.role !== 'ORG_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    let settings = await prisma.notificationSettings.findUnique({
      where: { id: 'default' }
    })

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: {
          id: 'default',
          notificationTime: '09:00',
          enabled: true,
          smtpPort: 587,
          smtpSecure: false,
          notifyOnNewPlanilla: true,
          notifyOnApproval: true,
          notifyOnRejection: true,
          notifyDailySummary: true
        }
      })
    }

    // No devolver la contrasena SMTP en texto plano (solo indicar si existe)
    const safeSettings = {
      ...settings,
      smtpPass: settings.smtpPass ? '********' : null
    }

    return NextResponse.json({ success: true, settings: safeSettings })
  } catch (error: any) {
    console.error('Error getting notification settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Actualizar configuracion de notificaciones
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN' && session.user.role !== 'ORG_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await req.json()
    const {
      notificationTime,
      enabled,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpSecure,
      emailFrom,
      approverEmails,
      notifyOnNewPlanilla,
      notifyOnApproval,
      notifyOnRejection,
      notifyDailySummary
    } = body

    // Validar formato de hora (HH:MM) si se proporciona
    if (notificationTime && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(notificationTime)) {
      return NextResponse.json(
        { success: false, error: 'Formato de hora invalido. Use HH:MM (00:00 - 23:59)' },
        { status: 400 }
      )
    }

    // Validar puerto SMTP
    if (smtpPort !== undefined && (smtpPort < 1 || smtpPort > 65535)) {
      return NextResponse.json(
        { success: false, error: 'Puerto SMTP invalido. Debe estar entre 1 y 65535' },
        { status: 400 }
      )
    }

    // Validar emails de aprobadores (formato basico)
    if (approverEmails) {
      const emails = approverEmails.split(',').map((e: string) => e.trim()).filter((e: string) => e)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      for (const email of emails) {
        if (!emailRegex.test(email)) {
          return NextResponse.json(
            { success: false, error: `Email invalido: ${email}` },
            { status: 400 }
          )
        }
      }
    }

    // Preparar datos para actualizar
    const updateData: any = {}
    const createData: any = {
      id: 'default',
      notificationTime: notificationTime || '09:00',
      enabled: enabled !== undefined ? enabled : true,
      smtpPort: smtpPort || 587,
      smtpSecure: smtpSecure || false,
      notifyOnNewPlanilla: notifyOnNewPlanilla !== undefined ? notifyOnNewPlanilla : true,
      notifyOnApproval: notifyOnApproval !== undefined ? notifyOnApproval : true,
      notifyOnRejection: notifyOnRejection !== undefined ? notifyOnRejection : true,
      notifyDailySummary: notifyDailySummary !== undefined ? notifyDailySummary : true
    }

    // Solo actualizar campos que se proporcionan
    if (notificationTime !== undefined) updateData.notificationTime = notificationTime
    if (enabled !== undefined) updateData.enabled = enabled
    if (smtpHost !== undefined) updateData.smtpHost = smtpHost
    if (smtpPort !== undefined) updateData.smtpPort = smtpPort
    if (smtpUser !== undefined) updateData.smtpUser = smtpUser
    // Solo actualizar contrasena si no es el placeholder
    if (smtpPass !== undefined && smtpPass !== '********') updateData.smtpPass = smtpPass
    if (smtpSecure !== undefined) updateData.smtpSecure = smtpSecure
    if (emailFrom !== undefined) updateData.emailFrom = emailFrom
    if (approverEmails !== undefined) updateData.approverEmails = approverEmails
    if (notifyOnNewPlanilla !== undefined) updateData.notifyOnNewPlanilla = notifyOnNewPlanilla
    if (notifyOnApproval !== undefined) updateData.notifyOnApproval = notifyOnApproval
    if (notifyOnRejection !== undefined) updateData.notifyOnRejection = notifyOnRejection
    if (notifyDailySummary !== undefined) updateData.notifyDailySummary = notifyDailySummary

    // Agregar campos SMTP a createData
    if (smtpHost) createData.smtpHost = smtpHost
    if (smtpUser) createData.smtpUser = smtpUser
    if (smtpPass && smtpPass !== '********') createData.smtpPass = smtpPass
    if (emailFrom) createData.emailFrom = emailFrom
    if (approverEmails) createData.approverEmails = approverEmails

    const settings = await prisma.notificationSettings.upsert({
      where: { id: 'default' },
      update: updateData,
      create: createData
    })

    // No devolver la contrasena SMTP
    const safeSettings = {
      ...settings,
      smtpPass: settings.smtpPass ? '********' : null
    }

    return NextResponse.json({ success: true, settings: safeSettings })
  } catch (error: any) {
    console.error('Error updating notification settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
