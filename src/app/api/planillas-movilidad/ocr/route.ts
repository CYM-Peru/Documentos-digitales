import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { GeminiService } from '@/services/gemini'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'

/**
 * POST /api/planillas-movilidad/ocr
 * Procesa una imagen de planilla de movilidad con OCR (Gemini Vision)
 * Retorna los datos extraídos para poblar el formulario
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('🚗 [PLANILLA OCR] Procesando imagen:', file.name, `(${(file.size / 1024).toFixed(0)}KB)`)

    // Obtener configuración de la organización
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.organizationId },
    })

    if (!settings?.geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API no configurada. Contacta al administrador.' },
        { status: 400 }
      )
    }

    // Procesar imagen
    const bytes = await file.arrayBuffer()
    let buffer = Buffer.from(bytes)

    // Optimizar imagen para OCR
    let processedBuffer: Buffer
    try {
      const image = sharp(buffer)
      const metadata = await image.metadata()

      console.log('📸 Imagen original:', {
        size: `${metadata.width}x${metadata.height}`,
        format: metadata.format,
      })

      // Redimensionar si es muy grande (mantener buena calidad para OCR)
      if (metadata.width && metadata.width > 3000) {
        processedBuffer = await sharp(buffer)
          .resize(3000, 4000, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 90 })
          .toBuffer()
      } else {
        processedBuffer = await sharp(buffer)
          .jpeg({ quality: 90 })
          .toBuffer()
      }

      console.log('✓ Imagen procesada:', `${(processedBuffer.length / 1024).toFixed(0)}KB`)
    } catch (error) {
      console.error('Error procesando imagen:', error)
      processedBuffer = buffer
    }

    // Guardar imagen temporalmente
    const uploadDir = join(process.cwd(), 'public', 'uploads', session.user.organizationId, 'planillas')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const fileName = `${timestamp}-planilla.jpg`
    const filePath = join(uploadDir, fileName)
    await writeFile(filePath, processedBuffer)
    const imageUrl = `/api/uploads/${session.user.organizationId}/planillas/${fileName}`

    console.log('💾 Imagen guardada:', imageUrl)

    // Procesar con Gemini Vision
    const geminiService = new GeminiService({
      apiKey: decrypt(settings.geminiApiKey),
      model: settings.geminiModel || 'gemini-2.0-flash-exp',
    })

    console.log('🤖 Enviando a Gemini Vision...')
    const extractedData = await geminiService.analyzePlanillaMovilidad(processedBuffer)

    console.log('✅ Datos extraídos:', {
      nombresApellidos: extractedData.nombresApellidos,
      gastosCount: extractedData.gastos?.length || 0,
      totalGeneral: extractedData.totalGeneral,
    })

    return NextResponse.json({
      success: true,
      message: 'Planilla procesada correctamente',
      imageUrl,
      data: extractedData,
    })
  } catch (error: any) {
    console.error('❌ Planilla OCR error:', error)
    return NextResponse.json(
      { error: error.message || 'Error procesando la planilla' },
      { status: 500 }
    )
  }
}
