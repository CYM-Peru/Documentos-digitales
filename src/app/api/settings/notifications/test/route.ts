import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'

// POST - Probar conexion SMTP
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await req.json()
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, emailFrom } = body

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: smtpHost, smtpUser, smtpPass' },
        { status: 400 }
      )
    }

    // Crear transporter de nodemailer
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort || 587,
      secure: smtpSecure || false, // true para 465, false para otros puertos
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      tls: {
        // No fallar en certificados invalidos (para desarrollo)
        rejectUnauthorized: false
      }
    })

    // Verificar conexion
    await transporter.verify()

    // Enviar email de prueba
    const testEmail = {
      from: emailFrom || smtpUser,
      to: smtpUser, // Enviar al mismo usuario configurado
      subject: 'Prueba de conexion SMTP - Sistema Cockpit',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Sistema Cockpit</h1>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Prueba de conexion SMTP exitosa</h2>
            <p style="color: #4b5563;">
              Este es un email de prueba para verificar que la configuracion SMTP funciona correctamente.
            </p>
            <div style="background: #d1fae5; border: 1px solid #10b981; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #065f46; margin: 0; font-weight: bold;">La conexion SMTP esta funcionando correctamente.</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Configuracion utilizada:<br/>
              Servidor: ${smtpHost}<br/>
              Puerto: ${smtpPort || 587}<br/>
              Usuario: ${smtpUser}<br/>
              SSL/TLS: ${smtpSecure ? 'Si' : 'No'}
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Este email fue enviado automaticamente desde el Sistema Cockpit.
            </p>
          </div>
        </div>
      `
    }

    await transporter.sendMail(testEmail)

    return NextResponse.json({
      success: true,
      message: `Email de prueba enviado exitosamente a ${smtpUser}`
    })
  } catch (error: any) {
    console.error('Error testing SMTP connection:', error)

    // Mensajes de error mas descriptivos
    let errorMessage = error.message

    if (error.code === 'ECONNREFUSED') {
      errorMessage = `No se pudo conectar al servidor SMTP. Verifica el host y puerto.`
    } else if (error.code === 'EAUTH') {
      errorMessage = `Error de autenticacion. Verifica el usuario y contrasena.`
    } else if (error.code === 'ESOCKET') {
      errorMessage = `Error de conexion. Prueba cambiar la configuracion de SSL/TLS.`
    } else if (error.responseCode === 535) {
      errorMessage = `Credenciales invalidas. Para Office 365/Gmail puede requerir una "App Password".`
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
