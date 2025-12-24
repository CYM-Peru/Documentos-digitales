import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SqlServerService } from '@/services/sqlserver'
import { decrypt } from '@/lib/encryption'
import { PlanillaEmailService } from '@/services/planilla-email'

/**
 * POST /api/gastos-reparables/[id]/aprobar
 * Aprueba o rechaza una planilla de gastos reparables
 * Solo usuarios con rol APROBADOR o SUPER_ADMIN pueden usar este endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar que el usuario tiene rol de aprobación
    // Solo APROBADOR y SUPER_ADMIN pueden aprobar planillas
    const canApprove = ['APROBADOR', 'SUPER_ADMIN'].includes(session.user.role)
    if (!canApprove) {
      return NextResponse.json(
        { error: 'No tienes permisos para aprobar planillas. Solo el rol APROBADOR puede hacerlo.' },
        { status: 403 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { accion, comentarios, camposConError } = body // accion: 'APROBAR' | 'RECHAZAR'

    if (!accion || !['APROBAR', 'RECHAZAR'].includes(accion)) {
      return NextResponse.json(
        { error: 'Acción inválida. Debe ser APROBAR o RECHAZAR' },
        { status: 400 }
      )
    }

    // Buscar la planilla (incluyendo sede del usuario para obtener codLocal)
    const planilla = await prisma.gastoReparablePlanilla.findUnique({
      where: { id },
      include: {
        items: true,
        user: {
          select: {
            name: true,
            email: true,
            sede: {
              select: {
                codLocal: true,
                nombre: true,
              },
            },
          },
        },
      },
    })

    if (!planilla) {
      return NextResponse.json(
        { error: 'Planilla no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que pertenece a la organización del aprobador
    if (planilla.organizationId !== session.user.organizationId) {
      return NextResponse.json(
        { error: 'No tiene permisos para aprobar esta planilla' },
        { status: 403 }
      )
    }

    // Verificar que está en estado pendiente
    if (planilla.estadoAprobacion !== 'PENDIENTE_APROBACION') {
      return NextResponse.json(
        { error: `Planilla ya fue ${planilla.estadoAprobacion.toLowerCase()}` },
        { status: 400 }
      )
    }

    if (accion === 'RECHAZAR') {
      // Rechazar planilla
      const planillaActualizada = await prisma.gastoReparablePlanilla.update({
        where: { id },
        data: {
          estadoAprobacion: 'RECHAZADA',
          aprobadoPorId: session.user.id,
          aprobadoEn: new Date(),
          comentariosAprobacion: comentarios || null,
          camposConError: camposConError && camposConError.length > 0 ? camposConError : undefined,
        },
        include: {
          items: true,
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
          aprobadoPor: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })

      // Enviar notificación por EMAIL al usuario
      try {
        const emailService = new PlanillaEmailService()
        await emailService.notifyGastoReparableRejected(
          {
            planillaId: planillaActualizada.id,
            nroPlanilla: planillaActualizada.nroPlanilla || '',
            userName: planillaActualizada.user.name || 'Usuario',
            userEmail: planillaActualizada.user.email || undefined,
            totalAmount: planillaActualizada.totalGeneral,
            itemCount: planillaActualizada.items.length,
            createdAt: planillaActualizada.createdAt
          },
          planillaActualizada.aprobadoPor?.name || session.user.name || session.user.email,
          comentarios
        )
        console.log(`✅ Email de rechazo enviado al usuario`)
      } catch (error: any) {
        console.error('⚠️ Error enviando email de rechazo:', error.message)
      }

      return NextResponse.json({
        success: true,
        message: 'Planilla rechazada correctamente',
        planilla: planillaActualizada,
      })
    }

    // APROBAR - Actualizar PostgreSQL y enviar a SQL Server
    const planillaActualizada = await prisma.gastoReparablePlanilla.update({
      where: { id },
      data: {
        estadoAprobacion: 'APROBADA',
        aprobadoPorId: session.user.id,
        aprobadoEn: new Date(),
        comentariosAprobacion: comentarios || null,
      },
      include: {
        items: true,
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            sede: {
              select: {
                codLocal: true,
                nombre: true,
              },
            },
          },
        },
        aprobadoPor: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Obtener configuración de SQL Server
    const settings = await prisma.organizationSettings.findFirst({
      where: {
        organizationId: session.user.organizationId,
        sqlServerEnabled: true,
      },
    })

    let sqlServerSaved = false
    let sqlServerError = null

    if (settings?.sqlServerHost) {
      try {
        // Obtener codLocal de la sede del usuario (1=Arica, 11=Lurín)
        const userCodLocal = planillaActualizada.user.sede?.codLocal || undefined
        console.log(`📍 CodLocal de sede del usuario: ${userCodLocal} (${planillaActualizada.user.sede?.nombre || 'Sin sede'})`)

        // Conectar a SQL Server
        const sqlService = new SqlServerService({
          server: decrypt(settings.sqlServerHost),
          database: settings.sqlServerDatabase!,
          user: decrypt(settings.sqlServerUser!),
          password: decrypt(settings.sqlServerPassword!),
          port: settings.sqlServerPort || 1433,
          encrypt: settings.sqlServerEncrypt,
          trustServerCertificate: settings.sqlServerTrustCert,
        })

        // AUTO-ASIGNAR CAJA CHICA si no tiene rendición asignada
        let nroCajaChicaFinal = planillaActualizada.nroCajaChica
        let tipoOperacionFinal = planillaActualizada.tipoOperacion

        // Si no tiene rendición asignada, buscar caja chica
        if (!planillaActualizada.nroRendicion && userCodLocal) {
          console.log(`🔍 Buscando caja chica abierta para CodLocal: ${userCodLocal}`)
          const cajaChica = await sqlService.getCajaChicaByCodLocal(userCodLocal)

          if (cajaChica) {
            nroCajaChicaFinal = cajaChica.NroRend.toString()
            tipoOperacionFinal = 'CAJA_CHICA'
            console.log(`✅ Auto-asignando caja chica: ${nroCajaChicaFinal} (${cajaChica.CodUserAsg})`)

            // Actualizar la planilla en PostgreSQL con la caja chica asignada
            await prisma.gastoReparablePlanilla.update({
              where: { id },
              data: {
                nroCajaChica: nroCajaChicaFinal,
                tipoOperacion: tipoOperacionFinal,
              },
            })
          } else {
            console.log(`⚠️ No se encontró caja chica abierta para CodLocal: ${userCodLocal}`)
          }
        }

        // Preparar datos para SQL Server (convertir null a undefined)
        const sqlData = {
          id: planillaActualizada.id,
          nroPlanilla: planillaActualizada.nroPlanilla || undefined,
          razonSocial: planillaActualizada.razonSocial || undefined,
          ruc: planillaActualizada.ruc || undefined,
          periodo: planillaActualizada.periodo || undefined,
          fechaEmision: planillaActualizada.fechaEmision || undefined,
          nombresApellidos: planillaActualizada.nombresApellidos || undefined,
          cargo: planillaActualizada.cargo || undefined,
          dni: planillaActualizada.dni || undefined,
          centroCosto: planillaActualizada.centroCosto || undefined,
          totalGeneral: planillaActualizada.totalGeneral,
          usuario: planillaActualizada.user.email || '',
          nroRendicion: planillaActualizada.nroRendicion || undefined,
          nroCajaChica: nroCajaChicaFinal || undefined,
          tipoOperacion:
            tipoOperacionFinal === 'RENDICION'
              ? ('RENDICION' as const)
              : tipoOperacionFinal === 'CAJA_CHICA'
              ? ('CAJA_CHICA' as const)
              : undefined,
          codLocal: userCodLocal, // CodLocal de la sede del usuario
          items: planillaActualizada.items.map((item) => ({
            fechaGasto: item.fechaGasto || undefined,
            dia: item.dia || undefined,
            mes: item.mes || undefined,
            anio: item.anio || undefined,
            tipoDoc: item.tipoDoc || undefined,
            concepto: item.concepto || undefined,
            tipoGasto: item.tipoGasto || undefined,
            importe: item.importe,
          })),
        }

        // Insertar en SQL Server
        await sqlService.insertGastoReparablePlanilla(sqlData)

        // Siempre insertar en CntCtaCajaChicaDocumentosIA si tiene caja chica o rendición
        if (sqlData.nroCajaChica || sqlData.nroRendicion) {
          console.log('📄 Insertando planilla en CntCtaCajaChicaDocumentosIA...')
          await sqlService.insertGastoReparableEnDocumentosIA(sqlData)
        }

        await sqlService.close()

        sqlServerSaved = true
      } catch (error: any) {
        console.error('Error al guardar en SQL Server:', error)
        sqlServerError = error.message
        // No fallar la aprobación si SQL Server falla
        // La planilla queda aprobada en PostgreSQL
      }
    }

    // Enviar notificación por EMAIL al usuario
    try {
      const emailService = new PlanillaEmailService()
      await emailService.notifyGastoReparableApproved(
        {
          planillaId: planillaActualizada.id,
          nroPlanilla: planillaActualizada.nroPlanilla || '',
          userName: planillaActualizada.user.name || 'Usuario',
          userEmail: planillaActualizada.user.email || undefined,
          totalAmount: planillaActualizada.totalGeneral,
          itemCount: planillaActualizada.items.length,
          createdAt: planillaActualizada.createdAt
        },
        planillaActualizada.aprobadoPor?.name || session.user.name || session.user.email
      )
      console.log(`✅ Email de aprobación enviado al usuario`)
    } catch (error: any) {
      console.error('⚠️ Error enviando email de aprobación:', error.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Planilla aprobada correctamente',
      planilla: planillaActualizada,
      sqlServerSaved,
      sqlServerError,
    })
  } catch (error: any) {
    console.error('Aprobar planilla error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to approve/reject planilla' },
      { status: 500 }
    )
  }
}
