import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

interface DuplicateCheckResult {
  isDuplicate: boolean
  duplicateInvoice?: any
  detectionMethod?: 'qr' | 'ruc_serie_numero'
  confidence: number // 0-100
}

export class DuplicateDetectionService {
  /**
   * Genera hash SHA-256 de un código QR para búsqueda rápida
   */
  static hashQrCode(qrCode: string): string {
    return crypto.createHash('sha256').update(qrCode).digest('hex')
  }

  /**
   * Verifica si existe un duplicado por código QR (100% de precisión)
   */
  static async checkByQrCode(
    qrCode: string,
    organizationId: string
  ): Promise<DuplicateCheckResult> {
    if (!qrCode) {
      return { isDuplicate: false, confidence: 0 }
    }

    console.log('🔍 Verificando duplicado por QR code...')

    const qrCodeHash = this.hashQrCode(qrCode)

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        organizationId,
        qrCodeHash,
        isDuplicate: false, // Solo buscar facturas originales
      },
      orderBy: {
        createdAt: 'asc', // La más antigua es la original
      },
    })

    if (existingInvoice) {
      console.log('⚠️ Duplicado encontrado por QR code:', {
        id: existingInvoice.id,
        serieNumero: existingInvoice.serieNumero,
        fecha: existingInvoice.createdAt,
      })

      return {
        isDuplicate: true,
        duplicateInvoice: existingInvoice,
        detectionMethod: 'qr',
        confidence: 100, // QR code es 100% preciso
      }
    }

    return { isDuplicate: false, confidence: 100 }
  }

  /**
   * Verifica si existe un duplicado por RUC+Serie+Número (alta precisión)
   */
  static async checkByRucSerieNumero(
    rucEmisor: string | null | undefined,
    serieNumero: string | null | undefined,
    organizationId: string
  ): Promise<DuplicateCheckResult> {
    if (!rucEmisor || !serieNumero) {
      console.log('⚠️ Datos insuficientes para verificar por RUC+Serie+Número')
      return { isDuplicate: false, confidence: 0 }
    }

    console.log('🔍 Verificando duplicado por RUC+Serie+Número:', {
      rucEmisor,
      serieNumero,
    })

    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        organizationId,
        rucEmisor,
        serieNumero,
        isDuplicate: false, // Solo buscar facturas originales
      },
      orderBy: {
        createdAt: 'asc', // La más antigua es la original
      },
    })

    if (existingInvoice) {
      console.log('⚠️ Duplicado encontrado por RUC+Serie+Número:', {
        id: existingInvoice.id,
        rucEmisor: existingInvoice.rucEmisor,
        serieNumero: existingInvoice.serieNumero,
        fecha: existingInvoice.createdAt,
      })

      return {
        isDuplicate: true,
        duplicateInvoice: existingInvoice,
        detectionMethod: 'ruc_serie_numero',
        confidence: 95, // Alta precisión pero no 100%
      }
    }

    return { isDuplicate: false, confidence: 95 }
  }

  /**
   * Verificación híbrida: Intenta QR primero, luego RUC+Serie+Número
   */
  static async checkDuplicate(params: {
    qrCode?: string | null
    rucEmisor?: string | null
    serieNumero?: string | null
    organizationId: string
  }): Promise<DuplicateCheckResult> {
    console.log('🔍 Iniciando verificación de duplicados...')

    // 1. Verificar por QR code (máxima precisión)
    if (params.qrCode) {
      const qrResult = await this.checkByQrCode(params.qrCode, params.organizationId)
      if (qrResult.isDuplicate) {
        return qrResult
      }
    }

    // 2. Verificar por RUC+Serie+Número (alta precisión)
    if (params.rucEmisor && params.serieNumero) {
      const rucResult = await this.checkByRucSerieNumero(
        params.rucEmisor,
        params.serieNumero,
        params.organizationId
      )
      if (rucResult.isDuplicate) {
        return rucResult
      }
    }

    console.log('✅ No se encontraron duplicados')
    return { isDuplicate: false, confidence: 100 }
  }

  /**
   * Marca una factura como duplicado
   */
  static async markAsDuplicate(
    invoiceId: string,
    originalInvoiceId: string,
    detectionMethod: 'qr' | 'ruc_serie_numero'
  ): Promise<void> {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        isDuplicate: true,
        duplicateOfId: originalInvoiceId,
        duplicateDetectionMethod: detectionMethod,
      },
    })

    console.log('✅ Factura marcada como duplicado:', {
      invoiceId,
      originalInvoiceId,
      method: detectionMethod,
    })
  }

  /**
   * Obtiene todas las facturas que son duplicados de una original
   */
  static async getDuplicates(originalInvoiceId: string): Promise<any[]> {
    return await prisma.invoice.findMany({
      where: {
        duplicateOfId: originalInvoiceId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })
  }

  /**
   * Obtiene estadísticas de duplicados
   */
  static async getStats(organizationId: string) {
    const [total, duplicates, byMethod] = await Promise.all([
      prisma.invoice.count({
        where: { organizationId },
      }),
      prisma.invoice.count({
        where: {
          organizationId,
          isDuplicate: true,
        },
      }),
      prisma.invoice.groupBy({
        by: ['duplicateDetectionMethod'],
        where: {
          organizationId,
          isDuplicate: true,
        },
        _count: true,
      }),
    ])

    return {
      total,
      duplicates,
      duplicateRate: total > 0 ? ((duplicates / total) * 100).toFixed(2) + '%' : '0%',
      byMethod: byMethod.reduce((acc, item) => {
        if (item.duplicateDetectionMethod) {
          acc[item.duplicateDetectionMethod] = item._count
        }
        return acc
      }, {} as Record<string, number>),
    }
  }
}
