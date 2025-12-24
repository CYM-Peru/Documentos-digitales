import { prisma } from '@/lib/prisma'

/**
 * Servicio para generar correlativos únicos de planillas de gastos reparables
 * Garantiza números únicos incluso con múltiples usuarios simultáneos
 * Formato: 100001, 100002, 100003, etc.
 */
export class GastoReparableCorrelativoService {
  /**
   * Obtiene el siguiente correlativo único
   * Usa transacciones atómicas para evitar duplicados
   * @returns Número de planilla único (ej: "100001")
   */
  static async obtenerSiguienteCorrelativo(): Promise<string> {
    const year = new Date().getFullYear().toString()

    // Usar transacción para garantizar atomicidad
    const result = await prisma.$transaction(async (tx) => {
      // Buscar o crear el correlativo para el año actual
      let correlativo = await tx.gastoReparableCorrelativo.findUnique({
        where: { serie: year },
      })

      if (!correlativo) {
        // Primera planilla del año - crear registro con 100000 como base
        correlativo = await tx.gastoReparableCorrelativo.create({
          data: {
            serie: year,
            ultimoNumero: 100000,
          },
        })
      }

      // Incrementar el número atómicamente
      const actualizado = await tx.gastoReparableCorrelativo.update({
        where: { serie: year },
        data: {
          ultimoNumero: {
            increment: 1,
          },
        },
      })

      return actualizado.ultimoNumero
    })

    // Formatear como string de 6 dígitos: 100001, 100002, etc.
    const nroPlanilla = result.toString()

    console.log(`📋 Correlativo generado: ${nroPlanilla}`)

    return nroPlanilla
  }

  /**
   * Obtiene el último correlativo usado (sin incrementar)
   * Útil para verificar el estado actual
   */
  static async obtenerUltimoCorrelativo(): Promise<string | null> {
    const year = new Date().getFullYear().toString()

    const correlativo = await prisma.gastoReparableCorrelativo.findUnique({
      where: { serie: year },
    })

    if (!correlativo) {
      return null
    }

    return correlativo.ultimoNumero.toString()
  }

  /**
   * Reinicia el correlativo del año actual (solo para testing o mantenimiento)
   * USAR CON PRECAUCIÓN
   */
  static async reiniciarCorrelativo(nuevoNumero: number = 100000): Promise<void> {
    const year = new Date().getFullYear().toString()

    await prisma.gastoReparableCorrelativo.upsert({
      where: { serie: year },
      update: {
        ultimoNumero: nuevoNumero,
      },
      create: {
        serie: year,
        ultimoNumero: nuevoNumero,
      },
    })

    console.log(`🔄 Correlativo reiniciado a: ${nuevoNumero}`)
  }
}
