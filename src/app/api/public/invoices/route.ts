import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * API PÚBLICA - Listar Facturas
 * Autenticación: API Key en header X-API-Key
 *
 * Uso:
 * GET /api/public/invoices?page=1&limit=50&status=COMPLETED
 * Headers: X-API-Key: tu-api-key-aqui
 */
export async function GET(request: NextRequest) {
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

    // Parsear parámetros de consulta
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100) // Máximo 100
    const status = searchParams.get('status') // COMPLETED, PROCESSING, FAILED
    const startDate = searchParams.get('startDate') // YYYY-MM-DD
    const endDate = searchParams.get('endDate') // YYYY-MM-DD

    // Construir filtros
    const where: any = {
      organizationId: validKey.orgId,
    }

    if (status) {
      where.status = status
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        const startDateParsed = new Date(startDate)
        if (isNaN(startDateParsed.getTime())) {
          return NextResponse.json(
            { error: 'startDate inválido. Formato esperado: YYYY-MM-DD' },
            { status: 400 }
          )
        }
        where.createdAt.gte = startDateParsed
      }
      if (endDate) {
        const endDateParsed = new Date(endDate + 'T23:59:59')
        if (isNaN(endDateParsed.getTime())) {
          return NextResponse.json(
            { error: 'endDate inválido. Formato esperado: YYYY-MM-DD' },
            { status: 400 }
          )
        }
        where.createdAt.lte = endDateParsed
      }
    }

    // Consultar facturas
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          imageUrl: true,
          imageName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          // Datos extraídos
          documentType: true,
          documentTypeCode: true,
          vendorName: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalAmount: true,
          currency: true,
          taxAmount: true,
          // Datos SUNAT
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
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
