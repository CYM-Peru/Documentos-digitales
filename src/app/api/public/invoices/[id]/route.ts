import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * API PÚBLICA - Obtener Factura por ID
 * Autenticación: API Key en header X-API-Key
 *
 * Uso:
 * GET /api/public/invoices/{invoice_id}
 * Headers: X-API-Key: tu-api-key-aqui
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validar API Key
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key')

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key requerida. Usa el header: X-API-Key' },
        { status: 401 }
      )
    }

    // Buscar API Key en la base de datos
    const validKey = await prisma.apiKey.findUnique({
      where: { key: apiKey, active: true },
    })

    if (!validKey) {
      return NextResponse.json(
        { error: 'API Key inválida o inactiva' },
        { status: 401 }
      )
    }

    // Verificar si la key expiró
    if (validKey.expiresAt && validKey.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'API Key expirada' },
        { status: 401 }
      )
    }

    // Buscar la factura
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: params.id,
        organizationId: validKey.orgId,
      },
      select: {
        id: true,
        imageUrl: true,
        imageName: true,
        imageSize: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        // Datos extraídos por IA
        ocrData: true,
        documentType: true,
        documentTypeCode: true,
        vendorName: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        currency: true,
        taxAmount: true,
        // Datos SUNAT específicos
        rucEmisor: true,
        razonSocialEmisor: true,
        domicilioFiscalEmisor: true,
        rucReceptor: true,
        dniReceptor: true,
        razonSocialReceptor: true,
        serieNumero: true,
        subtotal: true,
        igvTasa: true,
        igvMonto: true,
        // Verificación SUNAT
        sunatVerified: true,
        sunatEstadoCp: true,
        sunatEstadoRuc: true,
        sunatObservaciones: true,
        sunatVerifiedAt: true,
        // Integraciones
        googleSheetsRowId: true,
        n8nExecutionId: true,
        // Usuario que subió
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: invoice,
      _meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '1.0',
      },
    })
  } catch (error: any) {
    console.error('Public API error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    )
  }
}
