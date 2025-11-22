import { SunatService } from './sunat'

/**
 * Configuración para consulta automática SUNAT
 */
export interface SunatAutoCheckConfig {
  clientId: string
  clientSecret: string
  rucEmpresa: string
  daysBack?: number // Días hacia atrás para consultar (default: 7)
}

/**
 * Comprobante detectado en SUNAT pero no en sistema local
 */
export interface MissingInvoice {
  rucEmisor: string
  razonSocialEmisor?: string
  documentTypeCode: string // 01, 03, etc.
  serieNumero: string
  numeroCompleto: string
  fechaEmision: string
  monto: number
  detectedAt: Date
}

/**
 * Servicio de consulta automática de comprobantes recibidos en SUNAT
 *
 * IMPORTANTE: La API de SUNAT de "validación de comprobantes" NO permite
 * listar comprobantes recibidos. Solo valida si un comprobante específico existe.
 *
 * Para implementar la consulta de comprobantes recibidos se necesitaría:
 * 1. Acceso a la API del "Registro de Compras Electrónico" (requiere autenticación SOL)
 * 2. O integración con el portal SUNAT (scraping - no recomendado)
 * 3. O usar servicios de terceros (PSE, otros OSE)
 *
 * Esta clase está preparada para cuando SUNAT habilite una API pública
 * o para integración futura con servicios autorizados.
 */
export class SunatAutoCheckService {
  private sunatService: SunatService
  private config: SunatAutoCheckConfig

  constructor(config: SunatAutoCheckConfig) {
    this.config = {
      daysBack: 7,
      ...config,
    }

    this.sunatService = new SunatService({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      rucEmpresa: config.rucEmpresa,
    })
  }

  /**
   * Consulta comprobantes recibidos en SUNAT
   *
   * NOTA: Actualmente SUNAT no tiene una API pública para listar comprobantes recibidos.
   * Esta función está preparada para cuando esté disponible.
   *
   * Por ahora retorna un array vacío y registra que la funcionalidad está pendiente.
   */
  async checkReceivedInvoices(): Promise<MissingInvoice[]> {
    console.log('📋 SUNAT Auto-Check - Iniciando consulta de comprobantes recibidos')
    console.log(`   RUC Empresa: ${this.config.rucEmpresa}`)
    console.log(`   Días hacia atrás: ${this.config.daysBack}`)

    try {
      // ═══════════════════════════════════════════════════════════════════
      // IMPLEMENTACIÓN FUTURA
      // ═══════════════════════════════════════════════════════════════════
      //
      // Cuando SUNAT habilite API pública o se integre con servicio autorizado:
      //
      // 1. Consultar API del Registro de Compras Electrónico (RCE)
      // 2. Obtener lista de comprobantes emitidos a tu RUC
      // 3. Comparar con facturas en base de datos local
      // 4. Retornar comprobantes faltantes
      //
      // Ejemplo de endpoint futuro:
      // GET https://api.sunat.gob.pe/v1/contribuyente/comprobantes/recibidos
      // ?rucReceptor=20374412524&fechaDesde=2025-11-10&fechaHasta=2025-11-17
      //
      // ═══════════════════════════════════════════════════════════════════

      console.log('⚠️ SUNAT - API de consulta de comprobantes recibidos no disponible')
      console.log('💡 Sugerencia: Usar Monitor de Email para detección automática')
      console.log('💡 O integrar con portal del Registro de Compras Electrónico')

      // Por ahora retornar array vacío
      return []

      // ═══════════════════════════════════════════════════════════════════
      // ALTERNATIVA: Integración con Registro de Compras Electrónico (RCE)
      // ═══════════════════════════════════════════════════════════════════
      //
      // Si tienes acceso al RCE (requiere Clave SOL), podrías:
      // 1. Descargar el archivo TXT del RCE mensualmente
      // 2. Parsearlo y detectar facturas faltantes
      // 3. Generar alertas
      //
      // El archivo RCE tiene formato:
      // Fecha|TipoDoc|Serie|Número|RUCEmisor|RazonSocial|BaseImponible|IGV|Total|...
      //
      // Puedes implementar un endpoint que acepte el archivo TXT del RCE
      // y lo compare con las facturas registradas
      //
      // ═══════════════════════════════════════════════════════════════════

    } catch (error: any) {
      console.error('❌ Error en SUNAT Auto-Check:', error.message)
      return []
    }
  }

  /**
   * Valida si un comprobante específico existe en SUNAT
   * (Esta función SÍ funciona con la API actual de SUNAT)
   */
  async validateSpecificInvoice(
    rucEmisor: string,
    documentType: string,
    serie: string,
    numero: string,
    fecha: string,
    monto: number
  ): Promise<{ exists: boolean; valid: boolean }> {
    try {
      const resultado = await this.sunatService.validarComprobante({
        numRuc: rucEmisor,
        codComp: documentType,
        numeroSerie: serie,
        numero: numero,
        fechaEmision: fecha,
        monto: monto.toFixed(2),
      })

      return {
        exists: resultado.estadoCp !== '0',
        valid: resultado.estadoCp === '1',
      }
    } catch (error) {
      return { exists: false, valid: false }
    }
  }

  /**
   * Prueba la conexión con SUNAT
   */
  async testConnection(): Promise<boolean> {
    try {
      // Intentar obtener token
      await (this.sunatService as any).obtenerToken()
      return true
    } catch (error) {
      return false
    }
  }
}

/**
 * NOTA PARA IMPLEMENTACIÓN FUTURA:
 *
 * Para implementar la consulta de comprobantes recibidos, considera estas opciones:
 *
 * 1. **Portal SUNAT - Registro de Compras Electrónico (RCE)**
 *    - Descarga manual del archivo TXT mensual
 *    - Crear endpoint para subir y procesar el archivo
 *    - Comparar con facturas registradas
 *
 * 2. **Integración con PSE (Proveedor de Servicios Electrónicos)**
 *    - Algunos PSE ofrecen APIs para consultar comprobantes recibidos
 *    - Ejemplos: Nubefact, FacturaPeru, otros
 *
 * 3. **Buzón Electrónico SUNAT**
 *    - Si la empresa tiene buzón electrónico activado
 *    - SUNAT envía copia de comprobantes recibidos
 *    - Se puede consultar vía portal o posible API futura
 *
 * 4. **Scraping del Portal SUNAT** (NO RECOMENDADO)
 *    - Técnicamente posible pero puede violar términos de servicio
 *    - Frágil ante cambios en la interfaz web
 *    - Riesgo de bloqueo de cuenta
 */
