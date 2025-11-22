import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { SunatService } from '@/services/sunat'

export async function GET(
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

    // Verificar que tenemos los datos necesarios
    if (!invoice.rucEmisor || !invoice.documentTypeCode || !invoice.serieNumero || !invoice.totalAmount) {
      return NextResponse.json(
        { error: 'Insufficient data to download XML. Missing RUC, document type, series or amount.' },
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

    // Descargar XML (validación)
    const xmlContent = await sunatService.descargarXML(datosParaSunat)

    // Nombre del archivo
    const filename = `${invoice.serieNumero?.replace('/', '-')}_validacion_sunat.xml`

    // Retornar el XML como descarga
    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('XML download error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to download XML' },
      { status: 500 }
    )
  }
}
