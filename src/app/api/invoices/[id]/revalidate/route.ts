import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { SunatService } from '@/services/sunat'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Obtener la factura
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Verificar que pertenece a la organización del usuario
    if (invoice.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verificar que tenemos los datos necesarios
    if (!invoice.rucEmisor || !invoice.documentTypeCode || !invoice.serieNumero || !invoice.totalAmount) {
      return NextResponse.json(
        { error: 'Datos insuficientes para validar. Falta RUC, tipo de documento, serie o monto.' },
        { status: 400 }
      )
    }

    // Solo validar tipos de documento que SUNAT soporta
    // 01: Factura, 03: Boleta, 07: Nota Crédito, 08: Nota Débito
    // NO validar: 12 (Recibo Honorarios), 98 (Recibo Simple), 99 (Ticket), MOVILIDAD
    const tiposValidablesSunat = ['01', '03', '07', '08']
    if (!tiposValidablesSunat.includes(invoice.documentTypeCode)) {
      return NextResponse.json(
        {
          error: `Este tipo de documento (${invoice.documentTypeCode}) no requiere verificación SUNAT`,
          info: 'Solo Facturas (01), Boletas (03), Notas de Crédito (07) y Notas de Débito (08) se verifican en SUNAT.'
        },
        { status: 400 }
      )
    }

    // Obtener configuración SUNAT
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.organizationId },
    })

    if (!settings || !settings.sunatEnabled) {
      return NextResponse.json(
        { error: 'SUNAT integration not configured' },
        { status: 400 }
      )
    }

    // Convertir datos al formato SUNAT
    const datosParaSunat = SunatService.convertirDatosParaSunat({
      rucEmisor: invoice.rucEmisor,
      documentTypeCode: invoice.documentTypeCode,
      serieNumero: invoice.serieNumero,
      invoiceDate: invoice.invoiceDate || undefined,
      totalAmount: invoice.totalAmount,
    })

    if (!datosParaSunat) {
      return NextResponse.json(
        { error: 'Could not convert invoice data to SUNAT format' },
        { status: 400 }
      )
    }

    // Inicializar servicio SUNAT
    const sunatService = new SunatService({
      clientId: decrypt(settings.sunatClientId!),
      clientSecret: decrypt(settings.sunatClientSecret!),
      rucEmpresa: settings.sunatRuc!,
    })

    // Validar con SUNAT (con reintentos inteligentes)
    const { resultado, intentos, variacionUsada } =
      await sunatService.validarComprobanteConReintentos(datosParaSunat)

    const interpretacion = SunatService.interpretarEstado(resultado.estadoCp)

    // Actualizar factura con resultado de validación
    await prisma.invoice.update({
      where: { id: params.id },
      data: {
        sunatVerified: interpretacion.valido,
        sunatEstadoCp: resultado.estadoCp,
        sunatEstadoRuc: resultado.estadoRuc,
        sunatObservaciones: resultado.observaciones || [],
        sunatVerifiedAt: new Date(),
        sunatRetries: intentos,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        estadoCp: resultado.estadoCp,
        estadoRuc: resultado.estadoRuc,
        observaciones: resultado.observaciones,
        interpretacion: interpretacion,
        intentos: intentos,
        variacionUsada: variacionUsada,
        verificadoEn: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Revalidation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to revalidate with SUNAT' },
      { status: 500 }
    )
  }
}
