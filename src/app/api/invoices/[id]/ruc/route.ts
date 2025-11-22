import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SunatService } from '@/services/sunat'
import { decrypt } from '@/lib/encryption'

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

    // Verificar que tenemos el RUC
    if (!invoice.rucEmisor) {
      return NextResponse.json(
        { error: 'RUC not available for this invoice' },
        { status: 400 }
      )
    }

    // Obtener configuración SUNAT
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: session.user.organizationId },
    })

    if (
      !settings ||
      !settings.sunatEnabled ||
      !settings.sunatClientId ||
      !settings.sunatClientSecret ||
      !settings.sunatRuc
    ) {
      return NextResponse.json(
        { error: 'SUNAT not configured for this organization' },
        { status: 400 }
      )
    }

    console.log('🔍 Consultando RUC en SUNAT:', invoice.rucEmisor)

    // Consultar RUC directamente en SUNAT
    const sunatService = new SunatService({
      clientId: decrypt(settings.sunatClientId),
      clientSecret: decrypt(settings.sunatClientSecret),
      rucEmpresa: settings.sunatRuc,
    })

    const rucData = await sunatService.consultarRuc(invoice.rucEmisor)

    // Interpretar estado del RUC
    const estadoInterpretado = SunatService.interpretarEstadoRuc(rucData.descEstado)

    // Construir dirección completa desde domicilio fiscal
    let direccion = ''
    if (rucData.domicilioFiscal) {
      const df = rucData.domicilioFiscal
      if (df.descTipvia && df.descNomvia) {
        direccion = `${df.descTipvia} ${df.descNomvia}`
        if (df.descNumer) direccion += ` ${df.descNumer}`
        if (df.descInterior) direccion += ` Int. ${df.descInterior}`
        if (df.descDpto) direccion += ` Dpto. ${df.descDpto}`
        if (df.descDist) direccion += `, ${df.descDist}`
        if (df.descProv) direccion += `, ${df.descProv}`
        if (df.descDep) direccion += `, ${df.descDep}`
      }
    }

    console.log('✅ RUC consultado exitosamente:', rucData.ddpNombre)

    return NextResponse.json({
      success: true,
      data: {
        ruc: rucData.ddpNumruc,
        razonSocial: rucData.ddpNombre,
        direccion: direccion || invoice.domicilioFiscalEmisor || 'No disponible',
        estado: rucData.descEstado || 'No disponible',
        estadoInterpretado: estadoInterpretado,
        condicionDomicilio: rucData.descFlag22 || 'No disponible',
        actividadEconomica: rucData.domicilioFiscal?.descCiiu || 'No disponible',
        codigoCIIU: rucData.domicilioFiscal?.ddpCiiu || 'No disponible',
        tipoEmpresa: rucData.descTpoemp || 'No disponible',
        departamento: rucData.descDep || '',
        provincia: rucData.descProv || '',
        distrito: rucData.descDist || '',
      },
    })
  } catch (error: any) {
    console.error('❌ Error consultando RUC:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to query RUC from SUNAT' },
      { status: 500 }
    )
  }
}
