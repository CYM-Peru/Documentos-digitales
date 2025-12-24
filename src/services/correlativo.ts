import { prisma } from '@/lib/prisma'

/**
 * Servicio para generar correlativos únicos para planillas de movilidad
 * Garantiza números únicos incluso con múltiples usuarios simultáneos
 * usando transacciones atómicas con bloqueo pesimista
 *
 * IMPORTANTE: El correlativo NUNCA se reinicia, es un número continuo.
 * Solo cambia la serie/año en el formato: 2025-001, 2025-002, ..., 2026-151, 2026-152...
 */
export class CorrelativoService {
  // Clave única para el contador global (no cambia por año)
  private static readonly GLOBAL_SERIE = 'GLOBAL'

  /**
   * Obtiene el siguiente correlativo
   * Formato: "2025-001", "2025-002", etc.
   * El número NUNCA se reinicia, solo cambia el año.
   * Ejemplo: 2025-149, 2025-150, 2026-151, 2026-152...
   *
   * @returns El correlativo completo con el año actual (ej: "2025-001")
   */
  static async obtenerSiguienteCorrelativo(): Promise<string> {
    // Obtener el año actual para el formato
    const anioActual = new Date().getFullYear().toString()

    // Usar transacción con bloqueo para garantizar unicidad
    const resultado = await prisma.$transaction(async (tx) => {
      // Buscar el contador GLOBAL (único, nunca se reinicia)
      const registros = await tx.$queryRaw<Array<{ id: string; ultimoNumero: number }>>`
        SELECT id, "ultimoNumero"
        FROM invoice_system.planilla_correlativos
        WHERE serie = ${this.GLOBAL_SERIE}
        FOR UPDATE
      `

      let nuevoNumero: number

      if (registros.length === 0) {
        // No existe el contador global, crear con número 1
        nuevoNumero = 1
        await tx.planillaCorrelativo.create({
          data: {
            serie: this.GLOBAL_SERIE,
            ultimoNumero: nuevoNumero,
          },
        })
      } else {
        // Existe el contador, incrementar
        nuevoNumero = registros[0].ultimoNumero + 1
        await tx.planillaCorrelativo.update({
          where: { serie: this.GLOBAL_SERIE },
          data: { ultimoNumero: nuevoNumero },
        })
      }

      return nuevoNumero
    }, {
      // Configuración de la transacción para máxima seguridad
      isolationLevel: 'Serializable', // Nivel más alto de aislamiento
      timeout: 10000, // 10 segundos máximo
    })

    // Formatear el correlativo: "2025-001" (año actual + número global)
    const numeroFormateado = resultado.toString().padStart(3, '0')
    return `${anioActual}-${numeroFormateado}`
  }

  /**
   * Obtiene el último número correlativo usado (global)
   * @returns El último número usado o 0 si no existe
   */
  static async obtenerUltimoNumero(): Promise<number> {
    const registro = await prisma.planillaCorrelativo.findUnique({
      where: { serie: this.GLOBAL_SERIE },
    })

    return registro?.ultimoNumero || 0
  }

  /**
   * Obtiene el último correlativo formateado con el año actual
   * @returns El último correlativo (ej: "2025-015") o null si no hay ninguno
   */
  static async obtenerUltimoCorrelativo(): Promise<string | null> {
    const ultimoNumero = await this.obtenerUltimoNumero()

    if (ultimoNumero === 0) {
      return null
    }

    const anioActual = new Date().getFullYear().toString()
    const numeroFormateado = ultimoNumero.toString().padStart(3, '0')
    return `${anioActual}-${numeroFormateado}`
  }

  /**
   * Inicializa o actualiza el contador global con un número específico
   * Útil para migración de datos existentes
   * @param numero - El número inicial o de migración
   */
  static async inicializarContador(numero: number): Promise<void> {
    await prisma.planillaCorrelativo.upsert({
      where: { serie: this.GLOBAL_SERIE },
      update: { ultimoNumero: numero },
      create: {
        serie: this.GLOBAL_SERIE,
        ultimoNumero: numero,
      },
    })
  }
}
