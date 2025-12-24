import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Obtener una factura específica
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, invoice })
  } catch (error: any) {
    console.error('Error obteniendo factura:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Actualizar una factura
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      observacion,
      conceptoGasto,
      glosaEditada,
      tipoOperacion,
      nroRendicion,
      codLocal,
      imageRotation
    } = body

    // Preparar datos para actualizar
    const updateData: any = {}

    if (observacion !== undefined) updateData.observacion = observacion
    if (conceptoGasto !== undefined) updateData.conceptoGasto = conceptoGasto
    if (glosaEditada !== undefined) updateData.glosaEditada = glosaEditada
    if (tipoOperacion !== undefined) updateData.tipoOperacion = tipoOperacion
    if (nroRendicion !== undefined) updateData.nroRendicion = nroRendicion
    if (codLocal !== undefined) updateData.codLocal = codLocal
    if (imageRotation !== undefined) updateData.imageRotation = imageRotation

    // Actualizar en PostgreSQL
    const invoice = await prisma.invoice.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      invoice,
      message: 'Factura actualizada correctamente'
    })
  } catch (error: any) {
    console.error('Error actualizando factura:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar una factura (usa la API principal en /api/invoices?id=xxx)
// Esta ruta simplemente redirige a la existente
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Eliminar de PostgreSQL
    await prisma.invoice.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: 'Factura eliminada correctamente'
    })
  } catch (error: any) {
    console.error('Error eliminando factura:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
