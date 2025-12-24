import sql from 'mssql'

interface SqlServerCredentials {
  server: string
  database: string
  user: string
  password: string
  port?: number
  encrypt?: boolean // Para Azure SQL
  trustServerCertificate?: boolean
}

interface InvoiceData {
  id: string
  status: string
  invoiceDate?: Date
  rucEmisor?: string
  razonSocialEmisor?: string
  serieNumero?: string
  documentType?: string
  documentTypeCode?: string
  subtotal?: number
  igvMonto?: number
  totalAmount?: number
  currency?: string
  sunatVerified?: boolean | null
  sunatEstadoCp?: string | null
  nroRendicion?: string
  codLocal?: string
  usuario?: string

  // Campos opcionales de items (para futuro cuando se extraigan items)
  items?: Array<{
    itemNumber: number
    cantidad: number
    descripcion: string
    codigoProducto?: string
    precioUnitario: number
    totalItem: number
  }>
}

export interface RendicionPendiente {
  CodUserAsg: string
  CodEstado: string
  NroRend: number
}

export interface CajaChicaPendiente {
  CodUserAsg: string
  CodEstado: string
  NroRend: number
  CodLocal?: string
  DesEmpresa?: string
}

export interface MovilidadGasto {
  fechaGasto?: Date
  dia?: number
  mes?: number
  anio?: number
  motivo?: string
  origen?: string
  destino?: string
  montoViaje?: number
  montoDia?: number
}

export interface MovilidadPlanillaData {
  id: string
  nroPlanilla?: string
  razonSocial?: string
  ruc?: string
  periodo?: string
  fechaEmision?: Date
  nombresApellidos?: string
  cargo?: string
  dni?: string
  centroCosto?: string
  totalViaje?: number
  totalDia?: number
  totalGeneral?: number
  usuario?: string
  nroRendicion?: string
  nroCajaChica?: string
  tipoOperacion?: 'RENDICION' | 'CAJA_CHICA'
  estado?: string
  ocrData?: any
  imageUrl?: string
  gastos?: MovilidadGasto[]
  codLocal?: string // CodLocal de la sede del usuario (1=Arica, 11=Lurín)
}

export class SqlServerService {
  private config: sql.config
  private pool?: sql.ConnectionPool

  constructor(credentials: SqlServerCredentials) {
    this.config = {
      server: credentials.server,
      database: credentials.database,
      user: credentials.user,
      password: credentials.password,
      port: credentials.port || 1433,
      options: {
        encrypt: credentials.encrypt ?? true, // Para Azure SQL
        trustServerCertificate: credentials.trustServerCertificate ?? false,
        enableArithAbort: true,
        requestTimeout: 30000, // 30 segundos
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    }
  }

  /**
   * Sanitiza strings para prevenir problemas con caracteres especiales
   * Remueve caracteres de control y normaliza espacios
   */
  private sanitizeString(input: string | null | undefined, maxLength: number): string | null {
    if (!input) return null

    // Remover caracteres de control y caracteres no imprimibles
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '')

    // Normalizar múltiples espacios a uno solo
    sanitized = sanitized.replace(/\s+/g, ' ').trim()

    // Truncar al tamaño máximo
    return sanitized.substring(0, maxLength)
  }

  /**
   * Obtiene o crea el pool de conexiones
   */
  private async getPool(): Promise<sql.ConnectionPool> {
    if (!this.pool) {
      console.log('📊 SQL Server - Creando pool de conexiones...')
      this.pool = await sql.connect(this.config)
      console.log('✅ SQL Server - Pool de conexiones creado')
    }
    return this.pool
  }

  /**
   * Cierra el pool de conexiones
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close()
      this.pool = undefined
      console.log('🔒 SQL Server - Pool de conexiones cerrado')
    }
  }

  /**
   * Verifica la conexión a SQL Server
   */
  async testConnection(): Promise<boolean> {
    try {
      const pool = await this.getPool()
      const result = await pool.request().query('SELECT 1 as test')
      console.log('✅ SQL Server - Conexión exitosa')
      return result.recordset.length > 0
    } catch (error: any) {
      console.error('❌ SQL Server - Error de conexión:', error.message)
      throw new Error(`SQL Server connection failed: ${error.message}`)
    }
  }

  /**
   * Inserta una factura procesada en la tabla CntCtaRendicionDocumentosIA
   *
   * IMPORTANTE: Si la factura tiene items individuales, se insertarán múltiples filas.
   * Si no tiene items, se inserta 1 fila con los datos generales.
   */
  async insertInvoice(invoice: InvoiceData): Promise<number> {
    try {
      console.log('📊 SQL Server - Insertando factura:', invoice.id)

      const pool = await this.getPool()

      // Mapear estado SUNAT
      const sunatVerificado = this.mapSunatVerified(invoice.sunatVerified)
      const estadoSunat = this.mapSunatEstado(invoice.sunatEstadoCp)

      // NUEVA LÓGICA: Solo insertar UNA fila por factura (no una por item)
      console.log('📊 SQL Server - Insertando 1 fila por factura (cabecera con totales)')

      // Determinar descripción: primer item si hay items, sino descripción general
      let descripcionProducto = 'SIN DETALLE DE ITEMS'
      let cantidadItems = 0

      if (invoice.items && invoice.items.length > 0) {
        // Si hay items, usar la descripción del primer item
        const primerItem = invoice.items[0]
        descripcionProducto = primerItem.descripcion || 'ITEM SIN DESCRIPCIÓN'
        cantidadItems = invoice.items.length
      } else if (invoice.documentType?.includes('RECIBO') || invoice.documentType?.includes('HONORARIOS')) {
        descripcionProducto = 'SERVICIO PROFESIONAL'
      }

      // Sanitizar y truncar campos según límites reales de SQL Server
      const descripcion = this.sanitizeString(descripcionProducto, 255)
      const razonSocial = this.sanitizeString(invoice.razonSocialEmisor, 255)
      const tipoDoc = this.sanitizeString(invoice.documentType, 255)
      const serieNum = this.sanitizeString(invoice.serieNumero, 255)
      const estado = this.sanitizeString(invoice.status, 255)
      const moneda = this.sanitizeString(invoice.currency, 255)
      const usuario = this.sanitizeString(invoice.usuario, 100)
      const nroRend = invoice.nroRendicion ? parseInt(invoice.nroRendicion, 10) : null
      // RUC debe mantenerse como string para preservar ceros iniciales
      const rucEmisor = this.sanitizeString(invoice.rucEmisor, 50)

      const result = await pool
        .request()
        .input('ID', sql.NVarChar(255), invoice.id)
        .input('Fecha', sql.DateTime, invoice.invoiceDate)
        .input('Estado', sql.NVarChar(255), estado)
        .input('RUCEmisor', sql.NVarChar(50), rucEmisor)
        .input('RazonSocialEmisor', sql.NVarChar(255), razonSocial)
        .input('SerieNumero', sql.NVarChar(255), serieNum)
        .input('TipoDocumento', sql.NVarChar(255), tipoDoc)
        .input('CantidadItems', sql.Float, cantidadItems)
        .input('DescripcionProducto', sql.NVarChar(255), descripcion)
        .input('SubtotalFactura', sql.Float, invoice.subtotal)
        .input('IGV', sql.Float, invoice.igvMonto)
        .input('TotalFactura', sql.Float, invoice.totalAmount)
        .input('Moneda', sql.NVarChar(255), moneda)
        .input('SUNATVerificado', sql.NVarChar(255), sunatVerificado)
        .input('EstadoSUNAT', sql.NVarChar(255), estadoSunat)
        .input('NroRend', sql.Int, nroRend)
        .input('Usuario', sql.VarChar(100), usuario)
        .query(`
          INSERT INTO [dbo].[CntCtaRendicionDocumentosIA] (
            [ID],
            [Fecha],
            [Estado],
            [RUC Emisor],
            [Razón Social Emisor],
            [Serie-Número],
            [Tipo Documento],
            [Cantidad Items],
            [Descripción Producto],
            [Subtotal Factura],
            [IGV],
            [Total Factura],
            [Moneda],
            [SUNAT Verificado],
            [Estado SUNAT],
            [NroRend],
            [Usuario]
          ) VALUES (
            @ID,
            @Fecha,
            @Estado,
            @RUCEmisor,
            @RazonSocialEmisor,
            @SerieNumero,
            @TipoDocumento,
            @CantidadItems,
            @DescripcionProducto,
            @SubtotalFactura,
            @IGV,
            @TotalFactura,
            @Moneda,
            @SUNATVerificado,
            @EstadoSUNAT,
            @NroRend,
            @Usuario
          )
        `)

      console.log('✅ SQL Server - 1 fila insertada correctamente')
      return 1
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar factura:', error.message)
      throw new Error(`Failed to insert invoice into SQL Server: ${error.message}`)
    }
  }


  /**
   * Actualiza una factura existente
   */
  async updateInvoice(invoiceId: string, updates: Partial<InvoiceData>): Promise<void> {
    try {
      console.log('📊 SQL Server - Actualizando factura:', invoiceId)

      const pool = await this.getPool()

      const setClauses: string[] = []
      const request = pool.request()
      request.input('ID', sql.NVarChar(50), invoiceId)

      if (updates.status) {
        setClauses.push('[Estado] = @Estado')
        request.input('Estado', sql.NVarChar(50), updates.status)
      }

      if (updates.sunatVerified !== undefined) {
        setClauses.push('[SUNAT Verificado] = @SUNATVerificado')
        request.input('SUNATVerificado', sql.NVarChar(20), this.mapSunatVerified(updates.sunatVerified))
      }

      if (updates.sunatEstadoCp) {
        setClauses.push('[Estado SUNAT] = @EstadoSUNAT')
        request.input('EstadoSUNAT', sql.NVarChar(50), this.mapSunatEstado(updates.sunatEstadoCp))
      }

      if (setClauses.length === 0) {
        console.log('⚠️ SQL Server - No hay campos para actualizar')
        return
      }

      await request.query(`
        UPDATE [dbo].[CntCtaRendicionDocumentosIA]
        SET ${setClauses.join(', ')}
        WHERE [ID] = @ID
      `)

      console.log('✅ SQL Server - Factura actualizada correctamente')
    } catch (error: any) {
      console.error('❌ SQL Server - Error al actualizar factura:', error.message)
      throw new Error(`Failed to update invoice in SQL Server: ${error.message}`)
    }
  }

  /**
   * Elimina una factura por ID de AMBAS tablas (Rendiciones y Caja Chica)
   */
  async deleteInvoice(invoiceId: string): Promise<number> {
    try {
      console.log('📊 SQL Server - Eliminando factura de AMBAS tablas:', invoiceId)

      const pool = await this.getPool()

      // Eliminar de CntCtaRendicionDocumentosIA
      const result1 = await pool
        .request()
        .input('ID', sql.NVarChar(255), invoiceId)
        .query('DELETE FROM [dbo].[CntCtaRendicionDocumentosIA] WHERE [ID] = @ID')

      const deletedRendicion = result1.rowsAffected[0] || 0

      // Eliminar de CntCtaCajaChicaDocumentosIA
      const result2 = await pool
        .request()
        .input('ID', sql.NVarChar(255), invoiceId)
        .query('DELETE FROM [dbo].[CntCtaCajaChicaDocumentosIA] WHERE [ID] = @ID')

      const deletedCajaChica = result2.rowsAffected[0] || 0

      const totalDeleted = deletedRendicion + deletedCajaChica
      console.log(`✅ SQL Server - Factura eliminada: ${deletedRendicion} de Rendiciones, ${deletedCajaChica} de CajaChica`)
      return totalDeleted
    } catch (error: any) {
      console.error('❌ SQL Server - Error al eliminar factura:', error.message)
      throw new Error(`Failed to delete invoice from SQL Server: ${error.message}`)
    }
  }

  /**
   * Verifica si una factura ya existe
   */
  async invoiceExists(invoiceId: string): Promise<boolean> {
    try {
      const pool = await this.getPool()
      const result = await pool
        .request()
        .input('ID', sql.NVarChar(50), invoiceId)
        .query('SELECT COUNT(*) as count FROM [dbo].[CntCtaRendicionDocumentosIA] WHERE [ID] = @ID')

      return result.recordset[0].count > 0
    } catch (error: any) {
      console.error('❌ SQL Server - Error al verificar existencia:', error.message)
      return false
    }
  }

  /**
   * Mapea el estado de verificación SUNAT a formato de la tabla
   */
  private mapSunatVerified(sunatVerified?: boolean | null): string {
    if (sunatVerified === true) return 'SI'
    if (sunatVerified === false) return 'NO'
    return 'PENDIENTE'
  }

  /**
   * Mapea el código de estado SUNAT a descripción legible
   */
  private mapSunatEstado(estadoCp?: string | null): string {
    if (!estadoCp) return ''

    switch (estadoCp) {
      case '1':
        return 'VÁLIDO'
      case '0':
        return 'NO EXISTE'
      case '2':
        return 'ANULADO'
      case '3':
        return 'RECHAZADO'
      default:
        return estadoCp
    }
  }

  /**
   * Obtiene estadísticas de facturas en SQL Server
   */
  async getStats(): Promise<any> {
    try {
      const pool = await this.getPool()
      const result = await pool.request().query(`
        SELECT
          COUNT(DISTINCT [ID]) as totalFacturas,
          COUNT(*) as totalItems,
          SUM(CAST([Total Factura] as DECIMAL(18,2))) as totalMonto,
          COUNT(CASE WHEN [SUNAT Verificado] = 'SI' THEN 1 END) as verificadasSUNAT,
          COUNT(CASE WHEN [Estado SUNAT] = 'VÁLIDO' THEN 1 END) as validasCompleto
        FROM [dbo].[CntCtaRendicionDocumentosIA]
      `)

      return result.recordset[0]
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener estadísticas:', error.message)
      throw error
    }
  }

  /**
   * Obtiene las rendiciones de un usuario
   * @param codUserAsg - Código de usuario (parte antes del @ del email). Si es null/vacío, devuelve TODAS las rendiciones.
   * @param soloAbiertas - Si es true, solo devuelve las abiertas (CodEstado='00'). Si es false, solo devuelve las cerradas (CodEstado='01'). Si es null/undefined, devuelve todas sin filtro. Default: true
   * @returns Lista de rendiciones
   */
  async getRendicionesPendientes(codUserAsg?: string | null, soloAbiertas: boolean | null = true): Promise<RendicionPendiente[]> {
    try {
      const pool = await this.getPool()
      const estadoFilter = soloAbiertas === null ? "" : (soloAbiertas ? "AND CodEstado = '00'" : "AND CodEstado = '01'")

      // Si no hay usuario especificado, devolver TODAS las rendiciones
      if (!codUserAsg) {
        const estadoMsg = soloAbiertas === null ? '(todas)' : (soloAbiertas ? '(solo abiertas)' : '(solo cerradas)')
        console.log(`📋 SQL Server - Consultando TODAS las rendiciones ${estadoMsg}`)

        const result = await pool
          .request()
          .query(`
            SELECT CodUserAsg, CodEstado, NroRend
            FROM AZALEIAPERU.DBO.CntCtaRendicionDeCuentas
            WHERE YEAR(FCHREG) >= 2025
              ${estadoFilter}
            ORDER BY NroRend DESC
          `)

        console.log(`✅ SQL Server - ${result.recordset.length} rendiciones encontradas (TODAS)`)
        return result.recordset
      }

      // Convertir a mayúsculas para coincidir con SQL Server
      const codUserAsgUpper = codUserAsg.toUpperCase()
      const estadoMsg = soloAbiertas === null ? '(todas)' : (soloAbiertas ? '(solo abiertas)' : '(solo cerradas)')
      console.log(`📋 SQL Server - Consultando rendiciones para: ${codUserAsgUpper} ${estadoMsg}`)

      const result = await pool
        .request()
        .input('CodUserAsg', sql.VarChar(50), codUserAsgUpper)
        .query(`
          SELECT CodUserAsg, CodEstado, NroRend
          FROM AZALEIAPERU.DBO.CntCtaRendicionDeCuentas
          WHERE YEAR(FCHREG) >= 2025
            AND CodUserAsg = @CodUserAsg
            ${estadoFilter}
          ORDER BY NroRend DESC
        `)

      console.log(`✅ SQL Server - ${result.recordset.length} rendiciones encontradas`)
      return result.recordset
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener rendiciones:', error.message)
      throw new Error(`Failed to get rendiciones: ${error.message}`)
    }
  }

  /**
   * Obtiene las cajas chicas de un usuario
   * @param codUserAsg - Código de usuario (parte antes del @ del email). Si es null/vacío, devuelve TODAS las cajas chicas.
   * @param soloAbiertas - Si es true, solo devuelve las abiertas (CodEstado='00'). Si es false, solo devuelve las cerradas (CodEstado='01'). Si es null/undefined, devuelve todas sin filtro. Default: true
   * @returns Lista de cajas chicas
   */
  async getCajasChicasPendientes(codUserAsg?: string | null, soloAbiertas: boolean | null = true): Promise<CajaChicaPendiente[]> {
    try {
      const pool = await this.getPool()
      const estadoFilter = soloAbiertas === null ? "" : (soloAbiertas ? "AND a.CodEstado = '00'" : "AND a.CodEstado = '01'")

      // Si no hay usuario especificado, devolver TODAS las cajas chicas
      if (!codUserAsg) {
        const estadoMsg = soloAbiertas === null ? '(todas)' : (soloAbiertas ? '(solo abiertas)' : '(solo cerradas)')
        console.log(`💰 SQL Server - Consultando TODAS las cajas chicas ${estadoMsg}`)

        const result = await pool
          .request()
          .query(`
            SELECT a.CodLocal, a.NroRend, a.CodUserAsg, a.CodEstado, b.DesEmpresa
            FROM AZALEIAPERU.DBO.CntCtaCajaChica a
            LEFT JOIN AZALEIAPERU.DBO.MaeEmpresas b ON a.CodLocal = b.CodEmpresa
            WHERE YEAR(a.FchReg) >= 2025
              ${estadoFilter}
            ORDER BY a.NroRend DESC
          `)

        console.log(`✅ SQL Server - ${result.recordset.length} cajas chicas encontradas (TODAS)`)
        return result.recordset
      }

      // Convertir a mayúsculas para coincidir con SQL Server
      const codUserAsgUpper = codUserAsg.toUpperCase()
      const estadoMsg = soloAbiertas === null ? '(todas)' : (soloAbiertas ? '(solo abiertas)' : '(solo cerradas)')
      console.log(`💰 SQL Server - Consultando cajas chicas para: ${codUserAsgUpper} ${estadoMsg}`)

      const result = await pool
        .request()
        .input('CodUserAsg', sql.VarChar(50), codUserAsgUpper)
        .query(`
          SELECT a.CodLocal, a.NroRend, a.CodUserAsg, a.CodEstado, b.DesEmpresa
          FROM AZALEIAPERU.DBO.CntCtaCajaChica a
          LEFT JOIN AZALEIAPERU.DBO.MaeEmpresas b ON a.CodLocal = b.CodEmpresa
          WHERE YEAR(a.FchReg) >= 2025
            AND a.CodUserAsg = @CodUserAsg
            ${estadoFilter}
          ORDER BY a.NroRend DESC
        `)

      console.log(`✅ SQL Server - ${result.recordset.length} cajas chicas encontradas`)
      return result.recordset
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener cajas chicas:', error.message)
      throw new Error(`Failed to get cajas chicas: ${error.message}`)
    }
  }

  /**
   * Obtiene la caja chica abierta para un CodLocal específico
   * @param codLocal - Código de local (1=Arica, 11=Lurín)
   * @returns La caja chica abierta o null si no existe
   */
  async getCajaChicaByCodLocal(codLocal: string): Promise<CajaChicaPendiente | null> {
    try {
      const pool = await this.getPool()
      console.log(`💰 SQL Server - Buscando caja chica abierta para CodLocal: ${codLocal}`)

      const result = await pool
        .request()
        .input('CodLocal', sql.VarChar(10), codLocal)
        .query(`
          SELECT TOP 1 a.CodLocal, a.NroRend, a.CodUserAsg, a.CodEstado, b.DesEmpresa
          FROM AZALEIAPERU.DBO.CntCtaCajaChica a
          LEFT JOIN AZALEIAPERU.DBO.MaeEmpresas b ON a.CodLocal = b.CodEmpresa
          WHERE YEAR(a.FchReg) >= 2025
            AND a.CodEstado = '00'
            AND a.CodLocal = @CodLocal
          ORDER BY a.NroRend DESC
        `)

      if (result.recordset.length > 0) {
        console.log(`✅ SQL Server - Caja chica encontrada: ${result.recordset[0].NroRend} (${result.recordset[0].CodUserAsg})`)
        return result.recordset[0]
      }

      console.log(`⚠️ SQL Server - No se encontró caja chica abierta para CodLocal: ${codLocal}`)
      return null
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener caja chica por CodLocal:', error.message)
      throw new Error(`Failed to get caja chica by CodLocal: ${error.message}`)
    }
  }

  /**
   * Inserta una factura procesada en la tabla CntCtaCajaChicaDocumentosIA
   */
  async insertCajaChicaInvoice(invoice: InvoiceData): Promise<number> {
    try {
      console.log('💰 SQL Server - Insertando factura de caja chica:', invoice.id)

      const pool = await this.getPool()

      // Mapear estado SUNAT
      const sunatVerificado = this.mapSunatVerified(invoice.sunatVerified)
      const estadoSunat = this.mapSunatEstado(invoice.sunatEstadoCp)

      console.log('💰 SQL Server - Insertando 1 fila por factura (cabecera con totales)')

      // Determinar descripción inteligente
      let descripcionProducto = 'GASTO DE CAJA CHICA'
      let cantidadItems = 0

      if (invoice.items && invoice.items.length > 0) {
        // Si hay items, usar el primer item
        const primerItem = invoice.items[0]
        descripcionProducto = primerItem.descripcion || 'VARIOS'
        cantidadItems = invoice.items.length

        // Si hay múltiples items, agregar indicador
        if (cantidadItems > 1) {
          descripcionProducto = `${descripcionProducto} (${cantidadItems} items)`
        }
      } else {
        // Si no hay items, generar descripción inteligente basada en tipo de documento y emisor
        const tipoDoc = invoice.documentType || ''
        const emisor = invoice.razonSocialEmisor || ''

        if (tipoDoc.includes('RECIBO') || tipoDoc.includes('HONORARIOS')) {
          descripcionProducto = 'SERVICIO PROFESIONAL'
          if (emisor) {
            descripcionProducto = `SERVICIO - ${emisor}`
          }
        } else if (tipoDoc.includes('FACTURA')) {
          if (emisor) {
            // Tomar primeras palabras significativas del emisor
            const palabras = emisor.split(' ').slice(0, 3).join(' ')
            descripcionProducto = `COMPRA - ${palabras}`
          } else {
            descripcionProducto = 'COMPRA DE BIENES/SERVICIOS'
          }
        } else if (tipoDoc.includes('BOLETA')) {
          if (emisor) {
            const palabras = emisor.split(' ').slice(0, 3).join(' ')
            descripcionProducto = `COMPRA - ${palabras}`
          } else {
            descripcionProducto = 'COMPRA MENOR'
          }
        } else if (tipoDoc.includes('NOTA')) {
          descripcionProducto = 'NOTA DE CRÉDITO/DÉBITO'
        } else {
          // Fallback: usar razón social del emisor
          if (emisor) {
            const palabras = emisor.split(' ').slice(0, 4).join(' ')
            descripcionProducto = palabras
          }
        }
      }

      // Sanitizar y truncar campos
      const descripcion = this.sanitizeString(descripcionProducto, 255)
      const razonSocial = this.sanitizeString(invoice.razonSocialEmisor, 255)
      const tipoDoc = this.sanitizeString(invoice.documentType, 255)
      const serieNum = this.sanitizeString(invoice.serieNumero, 50)
      const estado = this.sanitizeString(invoice.status, 50)
      const moneda = this.sanitizeString(invoice.currency, 10)
      const usuario = this.sanitizeString(invoice.usuario, 20)
      const nroCajaChica = invoice.nroRendicion ? parseInt(invoice.nroRendicion, 10) : null
      const rucEmisor = this.sanitizeString(invoice.rucEmisor, 20)
      const codLocal = this.sanitizeString(invoice.codLocal, 20)

      const result = await pool
        .request()
        .input('ID', sql.NVarChar(255), invoice.id)
        .input('Fecha', sql.DateTime, invoice.invoiceDate)
        .input('Estado', sql.NVarChar(255), estado)
        .input('RUCEmisor', sql.NVarChar(50), rucEmisor)
        .input('RazonSocialEmisor', sql.NVarChar(255), razonSocial)
        .input('SerieNumero', sql.NVarChar(255), serieNum)
        .input('TipoDocumento', sql.NVarChar(255), tipoDoc)
        .input('CantidadItems', sql.Float, cantidadItems)
        .input('DescripcionProducto', sql.NVarChar(255), descripcion)
        .input('SubtotalFactura', sql.Float, invoice.subtotal)
        .input('IGV', sql.Float, invoice.igvMonto)
        .input('TotalFactura', sql.Float, invoice.totalAmount)
        .input('Moneda', sql.NVarChar(255), moneda)
        .input('SUNATVerificado', sql.NVarChar(255), sunatVerificado)
        .input('EstadoSUNAT', sql.NVarChar(255), estadoSunat)
        .input('Usuario', sql.VarChar(20), usuario)
        .input('NroRend', sql.Int, nroCajaChica)
        .input('CodLocal', sql.VarChar(20), codLocal)
        .query(`
          INSERT INTO [dbo].[CntCtaCajaChicaDocumentosIA] (
            [ID],
            [Fecha],
            [Estado],
            [RUC Emisor],
            [Razón Social Emisor],
            [Serie-Número],
            [Tipo Documento],
            [Cantidad Items],
            [Descripción Producto],
            [Subtotal Factura],
            [IGV],
            [Total Factura],
            [Moneda],
            [SUNAT Verificado],
            [Estado SUNAT],
            [Usuario],
            [NroRend],
            [CodLocal]
          ) VALUES (
            @ID,
            @Fecha,
            @Estado,
            @RUCEmisor,
            @RazonSocialEmisor,
            @SerieNumero,
            @TipoDocumento,
            @CantidadItems,
            @DescripcionProducto,
            @SubtotalFactura,
            @IGV,
            @TotalFactura,
            @Moneda,
            @SUNATVerificado,
            @EstadoSUNAT,
            @Usuario,
            @NroRend,
            @CodLocal
          )
        `)

      console.log('✅ SQL Server - 1 fila insertada correctamente en CntCtaCajaChicaDocumentosIA')

      // 🆕 Actualizar CntCtaCajaChica con el usuario asignado
      if (nroCajaChica && codLocal && usuario) {
        try {
          // Usar email completo en mayúsculas
          const usernameForCaja = usuario.toUpperCase()

          console.log(`💰 SQL Server - Actualizando CntCtaCajaChica: NroRend=${nroCajaChica}, CodLocal=${codLocal}, CodUserAsg=${usernameForCaja}`)

          await pool
            .request()
            .input('CodUserAsg', sql.VarChar(50), usernameForCaja)
            .input('NroRend', sql.Int, nroCajaChica)
            .input('CodLocal', sql.VarChar(20), codLocal)
            .query(`
              UPDATE [dbo].[CntCtaCajaChica]
              SET CodUserAsg = @CodUserAsg
              WHERE NroRend = @NroRend AND CodLocal = @CodLocal
            `)

          console.log('✅ SQL Server - CntCtaCajaChica actualizado con CodUserAsg')
        } catch (updateError: any) {
          // No fallar si la actualización falla, solo loguear el error
          console.error('⚠️ SQL Server - Error al actualizar CntCtaCajaChica:', updateError.message)
        }
      }

      return 1
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar factura de caja chica:', error.message)
      throw new Error(`Failed to insert caja chica invoice into SQL Server: ${error.message}`)
    }
  }

  /**
   * Inserta una planilla de movilidad en las tablas CntCtaMovilidadPlanillas y CntCtaMovilidadGastos
   * Usa UPSERT: si ya existe la actualiza, si no la inserta
   */
  async insertMovilidadPlanilla(planilla: MovilidadPlanillaData): Promise<number> {
    try {
      console.log('🚗 SQL Server - Insertando/actualizando planilla de movilidad:', planilla.id)

      const pool = await this.getPool()

      // Sanitizar campos
      const nroPlanilla = this.sanitizeString(planilla.nroPlanilla, 50)
      const razonSocial = this.sanitizeString(planilla.razonSocial, 255)
      const ruc = this.sanitizeString(planilla.ruc, 50)
      const periodo = this.sanitizeString(planilla.periodo, 100)
      const nombresApellidos = this.sanitizeString(planilla.nombresApellidos, 255)
      const cargo = this.sanitizeString(planilla.cargo, 255)
      const dni = this.sanitizeString(planilla.dni, 20)
      const centroCosto = this.sanitizeString(planilla.centroCosto, 100)
      const usuario = this.sanitizeString(planilla.usuario, 100)
      const estado = this.sanitizeString(planilla.estado || 'PENDIENTE', 255)
      const nroRend = planilla.nroRendicion ? parseInt(planilla.nroRendicion, 10) : null
      const nroCajaChica = planilla.nroCajaChica ? parseInt(planilla.nroCajaChica, 10) : null
      const imageUrl = this.sanitizeString(planilla.imageUrl, 500)

      // Verificar si ya existe
      const existsCheck = await pool
        .request()
        .input('ID', sql.NVarChar(255), planilla.id)
        .query(`SELECT COUNT(*) as count FROM [dbo].[CntCtaMovilidadPlanillas] WHERE [ID] = @ID`)

      const exists = existsCheck.recordset[0].count > 0

      if (exists) {
        // UPDATE si ya existe
        console.log(`📝 SQL Server - Planilla ya existe, actualizando...`)
        await pool
          .request()
          .input('ID', sql.NVarChar(255), planilla.id)
          .input('NroPlanilla', sql.NVarChar(50), nroPlanilla)
          .input('RazonSocial', sql.NVarChar(255), razonSocial)
          .input('RUC', sql.NVarChar(50), ruc)
          .input('Periodo', sql.NVarChar(100), periodo)
          .input('FechaEmision', sql.DateTime, planilla.fechaEmision || new Date())
          .input('NombresApellidos', sql.NVarChar(255), nombresApellidos)
          .input('Cargo', sql.NVarChar(255), cargo)
          .input('DNI', sql.NVarChar(20), dni)
          .input('CentroCosto', sql.NVarChar(100), centroCosto)
          .input('TotalViaje', sql.Float, planilla.totalViaje || 0)
          .input('TotalDia', sql.Float, planilla.totalDia || 0)
          .input('TotalGeneral', sql.Float, planilla.totalGeneral || 0)
          .input('Usuario', sql.VarChar(100), usuario)
          .input('NroRend', sql.Int, nroRend)
          .input('NroCajaChica', sql.Int, nroCajaChica)
          .input('TipoOperacion', sql.VarChar(20), planilla.tipoOperacion || null)
          .input('Estado', sql.NVarChar(255), estado)
          .input('OCRData', sql.NVarChar(sql.MAX), planilla.ocrData ? JSON.stringify(planilla.ocrData) : null)
          .input('ImageUrl', sql.NVarChar(500), imageUrl)
          .query(`
            UPDATE [dbo].[CntCtaMovilidadPlanillas]
            SET [NroPlanilla] = @NroPlanilla,
                [RazonSocial] = @RazonSocial,
                [RUC] = @RUC,
                [Periodo] = @Periodo,
                [FechaEmision] = @FechaEmision,
                [NombresApellidos] = @NombresApellidos,
                [Cargo] = @Cargo,
                [DNI] = @DNI,
                [CentroCosto] = @CentroCosto,
                [TotalViaje] = @TotalViaje,
                [TotalDia] = @TotalDia,
                [TotalGeneral] = @TotalGeneral,
                [Usuario] = @Usuario,
                [NroRend] = @NroRend,
                [NroCajaChica] = @NroCajaChica,
                [TipoOperacion] = @TipoOperacion,
                [Estado] = @Estado,
                [OCRData] = @OCRData,
                [ImageUrl] = @ImageUrl
            WHERE [ID] = @ID
          `)
        console.log('✅ SQL Server - Planilla actualizada en CntCtaMovilidadPlanillas')
      } else {
        // INSERT si no existe
        await pool
          .request()
          .input('ID', sql.NVarChar(255), planilla.id)
          .input('NroPlanilla', sql.NVarChar(50), nroPlanilla)
          .input('RazonSocial', sql.NVarChar(255), razonSocial)
          .input('RUC', sql.NVarChar(50), ruc)
          .input('Periodo', sql.NVarChar(100), periodo)
          .input('FechaEmision', sql.DateTime, planilla.fechaEmision || new Date())
          .input('NombresApellidos', sql.NVarChar(255), nombresApellidos)
          .input('Cargo', sql.NVarChar(255), cargo)
          .input('DNI', sql.NVarChar(20), dni)
          .input('CentroCosto', sql.NVarChar(100), centroCosto)
          .input('TotalViaje', sql.Float, planilla.totalViaje || 0)
          .input('TotalDia', sql.Float, planilla.totalDia || 0)
          .input('TotalGeneral', sql.Float, planilla.totalGeneral || 0)
          .input('Usuario', sql.VarChar(100), usuario)
          .input('NroRend', sql.Int, nroRend)
          .input('NroCajaChica', sql.Int, nroCajaChica)
          .input('TipoOperacion', sql.VarChar(20), planilla.tipoOperacion || null)
          .input('Estado', sql.NVarChar(255), estado)
          .input('OCRData', sql.NVarChar(sql.MAX), planilla.ocrData ? JSON.stringify(planilla.ocrData) : null)
          .input('ImageUrl', sql.NVarChar(500), imageUrl)
          .query(`
            INSERT INTO [dbo].[CntCtaMovilidadPlanillas] (
              [ID], [NroPlanilla], [RazonSocial], [RUC], [Periodo], [FechaEmision],
              [NombresApellidos], [Cargo], [DNI], [CentroCosto],
              [TotalViaje], [TotalDia], [TotalGeneral],
              [Usuario], [NroRend], [NroCajaChica], [TipoOperacion], [Estado],
              [OCRData], [ImageUrl]
            ) VALUES (
              @ID, @NroPlanilla, @RazonSocial, @RUC, @Periodo, @FechaEmision,
              @NombresApellidos, @Cargo, @DNI, @CentroCosto,
              @TotalViaje, @TotalDia, @TotalGeneral,
              @Usuario, @NroRend, @NroCajaChica, @TipoOperacion, @Estado,
              @OCRData, @ImageUrl
            )
          `)
        console.log('✅ SQL Server - Planilla insertada en CntCtaMovilidadPlanillas')
      }

      // Eliminar gastos anteriores si existen (para re-insertar los actualizados)
      if (exists) {
        await pool
          .request()
          .input('PlanillaID', sql.NVarChar(255), planilla.id)
          .query(`DELETE FROM [dbo].[CntCtaMovilidadGastos] WHERE [PlanillaID] = @PlanillaID`)
        console.log('🗑️ SQL Server - Gastos anteriores eliminados')
      }

      // Insertar gastos (detalles)
      if (planilla.gastos && planilla.gastos.length > 0) {
        console.log(`🚗 SQL Server - Insertando ${planilla.gastos.length} gastos...`)

        for (const gasto of planilla.gastos) {
          const motivo = this.sanitizeString(gasto.motivo, 500)
          const origen = this.sanitizeString(gasto.origen, 255)
          const destino = this.sanitizeString(gasto.destino, 255)

          await pool
            .request()
            .input('PlanillaID', sql.NVarChar(255), planilla.id)
            .input('FechaGasto', sql.DateTime, gasto.fechaGasto || null)
            .input('Dia', sql.Int, gasto.dia || null)
            .input('Mes', sql.Int, gasto.mes || null)
            .input('Anio', sql.Int, gasto.anio || null)
            .input('Motivo', sql.NVarChar(500), motivo)
            .input('Origen', sql.NVarChar(255), origen)
            .input('Destino', sql.NVarChar(255), destino)
            .input('MontoViaje', sql.Float, gasto.montoViaje || 0)
            .input('MontoDia', sql.Float, gasto.montoDia || 0)
            .query(`
              INSERT INTO [dbo].[CntCtaMovilidadGastos] (
                [PlanillaID], [FechaGasto], [Dia], [Mes], [Anio],
                [Motivo], [Origen], [Destino], [MontoViaje], [MontoDia]
              ) VALUES (
                @PlanillaID, @FechaGasto, @Dia, @Mes, @Anio,
                @Motivo, @Origen, @Destino, @MontoViaje, @MontoDia
              )
            `)
        }

        console.log(`✅ SQL Server - ${planilla.gastos.length} gastos insertados`)
      }

      return planilla.gastos?.length || 0
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar planilla de movilidad:', error.message)
      throw new Error(`Failed to insert movilidad planilla into SQL Server: ${error.message}`)
    }
  }

  /**
   * 🆕 Inserta planilla de movilidad en la tabla correcta según el tipo de operación
   * - RENDICION: va a CntCtaRendicionDocumentosIA
   * - CAJA_CHICA: va a CntCtaCajaChicaDocumentosIA
   * Usa UPSERT: si ya existe actualiza, si no inserta
   */
  async insertMovilidadEnDocumentosIA(planilla: MovilidadPlanillaData): Promise<void> {
    try {
      // Determinar la tabla correcta según el tipo de operación
      const isRendicion = planilla.tipoOperacion === 'RENDICION'
      const tableName = isRendicion ? 'CntCtaRendicionDocumentosIA' : 'CntCtaCajaChicaDocumentosIA'

      console.log(`📄 SQL Server - Insertando/actualizando planilla en ${tableName}:`, planilla.id)
      console.log(`   Tipo operación: ${planilla.tipoOperacion}`)
      console.log(`   NroRendicion: ${planilla.nroRendicion}`)
      console.log(`   NroCajaChica: ${planilla.nroCajaChica}`)

      const pool = await this.getPool()

      // Sanitizar campos comunes
      const rucEmisor = this.sanitizeString(planilla.ruc, 50) // RUC como string para preservar ceros
      const razonSocialEmisor = this.sanitizeString(planilla.razonSocial, 255)
      const serieNumero = this.sanitizeString(planilla.nroPlanilla || 'MOVILIDAD', 255)
      const tipoDocumento = this.sanitizeString('PLANILLA MOVILIDAD', 255)
      const usuario = this.sanitizeString(planilla.usuario, 100)

      // Determinar el número de rendición o caja chica según el tipo
      const nroRend = isRendicion
        ? (planilla.nroRendicion ? parseInt(planilla.nroRendicion, 10) : null)
        : (planilla.nroCajaChica ? parseInt(planilla.nroCajaChica, 10) : null)

      // Calcular totales
      const cantidadItems = planilla.gastos?.length || 0
      const totalFactura = planilla.totalGeneral || 0

      // Generar descripción/concepto
      let descripcionRaw = ''
      if (!planilla.gastos || planilla.gastos.length === 0) {
        descripcionRaw = 'Gastos de movilidad'
      } else if (planilla.gastos.length === 1) {
        // Si hay un solo gasto, usar su detalle específico (sin prefijo)
        const gasto = planilla.gastos[0]
        const origen = gasto.origen || ''
        const destino = gasto.destino || ''
        if (origen && destino) {
          descripcionRaw = `${origen} → ${destino}`
        } else if (gasto.motivo) {
          descripcionRaw = gasto.motivo
        } else {
          descripcionRaw = 'Gasto de movilidad'
        }
      } else {
        // Múltiples gastos: usar resumen genérico
        descripcionRaw = `Gastos varios de movilidad (${cantidadItems} items)`
      }

      const descripcion = this.sanitizeString(descripcionRaw, 255) || 'Gastos de movilidad'

      // Verificar si ya existe
      const existsCheck = await pool
        .request()
        .input('ID', sql.NVarChar(255), planilla.id)
        .query(`SELECT COUNT(*) as count FROM [dbo].[${tableName}] WHERE [ID] = @ID`)

      const exists = existsCheck.recordset[0].count > 0

      if (isRendicion) {
        if (exists) {
          // UPDATE en CntCtaRendicionDocumentosIA
          console.log(`📝 SQL Server - Registro ya existe en ${tableName}, actualizando...`)
          await pool
            .request()
            .input('ID', sql.NVarChar(255), planilla.id)
            .input('Fecha', sql.DateTime, planilla.fechaEmision || new Date())
            .input('Estado', sql.NVarChar(255), 'COMPLETED')
            .input('RUCEmisor', sql.NVarChar(50), rucEmisor)
            .input('RazonSocialEmisor', sql.NVarChar(255), razonSocialEmisor)
            .input('SerieNumero', sql.NVarChar(255), serieNumero)
            .input('TipoDocumento', sql.NVarChar(255), tipoDocumento)
            .input('CantidadItems', sql.Float, cantidadItems)
            .input('DescripcionProducto', sql.NVarChar(255), descripcion)
            .input('SubtotalFactura', sql.Float, totalFactura)
            .input('IGV', sql.Float, 0)
            .input('TotalFactura', sql.Float, totalFactura)
            .input('NroRend', sql.Int, nroRend)
            .input('Usuario', sql.VarChar(100), usuario)
            .query(`
              UPDATE [dbo].[CntCtaRendicionDocumentosIA]
              SET [Fecha] = @Fecha,
                  [Estado] = @Estado,
                  [RUC Emisor] = @RUCEmisor,
                  [Razón Social Emisor] = @RazonSocialEmisor,
                  [Serie-Número] = @SerieNumero,
                  [Tipo Documento] = @TipoDocumento,
                  [Cantidad Items] = @CantidadItems,
                  [Descripción Producto] = @DescripcionProducto,
                  [Subtotal Factura] = @SubtotalFactura,
                  [IGV] = @IGV,
                  [Total Factura] = @TotalFactura,
                  [NroRend] = @NroRend,
                  [Usuario] = @Usuario
              WHERE [ID] = @ID
            `)
        } else {
          // INSERT EN CntCtaRendicionDocumentosIA (tabla de rendiciones)
          await pool
            .request()
            .input('ID', sql.NVarChar(255), planilla.id)
            .input('Fecha', sql.DateTime, planilla.fechaEmision || new Date())
            .input('Estado', sql.NVarChar(255), 'COMPLETED')
            .input('RUCEmisor', sql.NVarChar(50), rucEmisor)
            .input('RazonSocialEmisor', sql.NVarChar(255), razonSocialEmisor)
            .input('SerieNumero', sql.NVarChar(255), serieNumero)
            .input('TipoDocumento', sql.NVarChar(255), tipoDocumento)
            .input('CantidadItems', sql.Float, cantidadItems)
            .input('DescripcionProducto', sql.NVarChar(255), descripcion)
            .input('SubtotalFactura', sql.Float, totalFactura)
            .input('IGV', sql.Float, 0)
            .input('TotalFactura', sql.Float, totalFactura)
            .input('Moneda', sql.NVarChar(255), 'PEN')
            .input('SUNATVerificado', sql.NVarChar(255), 'NO APLICA')
            .input('EstadoSUNAT', sql.NVarChar(255), 'NO APLICA')
            .input('NroRend', sql.Int, nroRend)
            .input('Usuario', sql.VarChar(100), usuario)
            .query(`
              INSERT INTO [dbo].[CntCtaRendicionDocumentosIA] (
                [ID], [Fecha], [Estado], [RUC Emisor], [Razón Social Emisor],
                [Serie-Número], [Tipo Documento], [Cantidad Items],
                [Descripción Producto], [Subtotal Factura], [IGV], [Total Factura],
                [Moneda], [SUNAT Verificado], [Estado SUNAT], [NroRend], [Usuario]
              ) VALUES (
                @ID, @Fecha, @Estado, @RUCEmisor, @RazonSocialEmisor,
                @SerieNumero, @TipoDocumento, @CantidadItems,
                @DescripcionProducto, @SubtotalFactura, @IGV, @TotalFactura,
                @Moneda, @SUNATVerificado, @EstadoSUNAT, @NroRend, @Usuario
              )
            `)
        }
      } else {
        // Obtener CodLocal de la sede del usuario
        const codLocal = planilla.codLocal || null

        if (exists) {
          // UPDATE en CntCtaCajaChicaDocumentosIA
          console.log(`📝 SQL Server - Registro ya existe en ${tableName}, actualizando...`)
          await pool
            .request()
            .input('ID', sql.NVarChar(255), planilla.id)
            .input('Fecha', sql.DateTime, planilla.fechaEmision || new Date())
            .input('Estado', sql.NVarChar(255), 'COMPLETED')
            .input('RucEmisor', sql.Float, rucEmisor ? parseFloat(rucEmisor) : null)
            .input('RazonSocialEmisor', sql.NVarChar(255), razonSocialEmisor)
            .input('SerieNumero', sql.NVarChar(255), serieNumero)
            .input('TipoDocumento', sql.NVarChar(255), tipoDocumento)
            .input('CantidadItems', sql.Float, cantidadItems)
            .input('DescripcionProducto', sql.NVarChar(255), descripcion)
            .input('TotalFactura', sql.Float, totalFactura)
            .input('NroRend', sql.Int, nroRend)
            .input('Usuario', sql.VarChar(20), usuario)
            .input('CodLocal', sql.VarChar(20), codLocal)
            .query(`
              UPDATE [dbo].[CntCtaCajaChicaDocumentosIA]
              SET [Fecha] = @Fecha,
                  [Estado] = @Estado,
                  [RUC Emisor] = @RucEmisor,
                  [Razón Social Emisor] = @RazonSocialEmisor,
                  [Serie-Número] = @SerieNumero,
                  [Tipo Documento] = @TipoDocumento,
                  [Cantidad Items] = @CantidadItems,
                  [Descripción Producto] = @DescripcionProducto,
                  [Total Factura] = @TotalFactura,
                  [NroRend] = @NroRend,
                  [Usuario] = @Usuario,
                  [CodLocal] = @CodLocal
              WHERE [ID] = @ID
            `)
        } else {
          // INSERT EN CntCtaCajaChicaDocumentosIA (tabla de cajas chicas)
          await pool
            .request()
            .input('ID', sql.NVarChar(255), planilla.id)
            .input('Fecha', sql.DateTime, planilla.fechaEmision || new Date())
            .input('Estado', sql.NVarChar(255), 'COMPLETED')
            .input('RucEmisor', sql.Float, rucEmisor ? parseFloat(rucEmisor) : null)
            .input('RazonSocialEmisor', sql.NVarChar(255), razonSocialEmisor)
            .input('SerieNumero', sql.NVarChar(255), serieNumero)
            .input('TipoDocumento', sql.NVarChar(255), tipoDocumento)
            .input('CantidadItems', sql.Float, cantidadItems)
            .input('ItemNumero', sql.Float, 1) // Siempre 1 porque es una sola fila resumen
            .input('Cantidad', sql.Float, 1) // Siempre 1 (una planilla)
            .input('DescripcionProducto', sql.NVarChar(255), descripcion)
            .input('PrecioUnitario', sql.Float, totalFactura) // Total como precio unitario
            .input('TotalItem', sql.Float, totalFactura) // Total del item
            .input('SubtotalFactura', sql.Float, totalFactura)
            .input('IGV', sql.Float, 0)
            .input('TotalFactura', sql.Float, totalFactura)
            .input('Moneda', sql.NVarChar(255), 'PEN')
            .input('Usuario', sql.VarChar(20), usuario)
            .input('NroRend', sql.Int, nroRend)
            .input('CodMon', sql.VarChar(5), 'PEN')
            .input('CodLocal', sql.VarChar(20), codLocal)
            .query(`
              INSERT INTO [dbo].[CntCtaCajaChicaDocumentosIA] (
                [ID], [Fecha], [Estado], [RUC Emisor], [Razón Social Emisor],
                [Serie-Número], [Tipo Documento], [Cantidad Items],
                [Item #], [Cantidad], [Descripción Producto],
                [Precio Unitario], [Total Item], [Subtotal Factura],
                [IGV], [Total Factura], [Moneda], [Usuario], [NroRend], [CodMon], [CodLocal]
              ) VALUES (
                @ID, @Fecha, @Estado, @RucEmisor, @RazonSocialEmisor,
                @SerieNumero, @TipoDocumento, @CantidadItems,
                @ItemNumero, @Cantidad, @DescripcionProducto,
                @PrecioUnitario, @TotalItem, @SubtotalFactura,
                @IGV, @TotalFactura, @Moneda, @Usuario, @NroRend, @CodMon, @CodLocal
              )
            `)
        }
      }

      console.log(`✅ SQL Server - 1 registro ${exists ? 'actualizado' : 'insertado'} en ${tableName} con ${cantidadItems} items`)
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar planilla en DocumentosIA:', error.message)
      throw new Error(`Failed to insert into DocumentosIA: ${error.message}`)
    }
  }

  /**
   * Obtiene planillas de movilidad por usuario
   */
  async getMovilidadPlanillas(username: string, limit: number = 50): Promise<any[]> {
    try {
      console.log('🚗 SQL Server - Consultando planillas de movilidad para:', username)

      const pool = await this.getPool()
      const result = await pool
        .request()
        .input('Usuario', sql.VarChar(100), username)
        .input('Limit', sql.Int, limit)
        .query(`
          SELECT TOP (@Limit) *
          FROM [dbo].[CntCtaMovilidadPlanillas]
          WHERE [Usuario] = @Usuario
          ORDER BY [FechaCreacion] DESC
        `)

      console.log(`✅ SQL Server - ${result.recordset.length} planillas encontradas`)
      return result.recordset
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener planillas de movilidad:', error.message)
      throw new Error(`Failed to get movilidad planillas: ${error.message}`)
    }
  }

  /**
   * Obtiene los gastos de una planilla de movilidad
   */
  async getMovilidadGastos(planillaId: string): Promise<any[]> {
    try {
      const pool = await this.getPool()
      const result = await pool
        .request()
        .input('PlanillaID', sql.NVarChar(255), planillaId)
        .query(`
          SELECT *
          FROM [dbo].[CntCtaMovilidadGastos]
          WHERE [PlanillaID] = @PlanillaID
          ORDER BY [FechaGasto] ASC, [ID] ASC
        `)

      return result.recordset
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener gastos de movilidad:', error.message)
      throw new Error(`Failed to get movilidad gastos: ${error.message}`)
    }
  }

  /**
   * Inserta una planilla de gastos reparables en SQL Server
   */
  async insertGastoReparablePlanilla(data: {
    id: string
    nroPlanilla?: string
    razonSocial?: string
    ruc?: string
    periodo?: string
    fechaEmision?: Date
    nombresApellidos?: string
    cargo?: string
    dni?: string
    centroCosto?: string
    totalGeneral: number
    usuario: string
    nroRendicion?: string
    nroCajaChica?: string
    tipoOperacion?: 'RENDICION' | 'CAJA_CHICA'
    codLocal?: string
    items: Array<{
      fechaGasto?: Date
      dia?: number
      mes?: number
      anio?: number
      tipoDoc?: string
      concepto?: string
      tipoGasto?: string
      importe: number
    }>
  }): Promise<void> {
    try {
      console.log('📄 SQL Server - Insertando planilla de gastos reparables...')
      console.log('📄 Datos:', {
        id: data.id,
        nroPlanilla: data.nroPlanilla,
        totalGeneral: data.totalGeneral,
        itemsCount: data.items.length,
        tipoOperacion: data.tipoOperacion,
      })

      const pool = await this.getPool()
      const transaction = new sql.Transaction(pool)

      await transaction.begin()

      try {
        // Insertar planilla en CntCtaGastoReparablePlanillas
        await transaction
          .request()
          .input('ID', sql.NVarChar(255), data.id)
          .input('NroPlanilla', sql.NVarChar(50), data.nroPlanilla || null)
          .input('RazonSocial', sql.NVarChar(255), data.razonSocial || null)
          .input('RUC', sql.NVarChar(11), data.ruc || null)
          .input('Periodo', sql.NVarChar(50), data.periodo || null)
          .input('FechaEmision', sql.DateTime, data.fechaEmision || null)
          .input('NombresApellidos', sql.NVarChar(255), data.nombresApellidos || null)
          .input('Cargo', sql.NVarChar(100), data.cargo || null)
          .input('DNI', sql.NVarChar(8), data.dni || null)
          .input('CentroCosto', sql.NVarChar(100), data.centroCosto || null)
          .input('TotalGeneral', sql.Decimal(18, 2), data.totalGeneral)
          .input('Usuario', sql.NVarChar(100), data.usuario)
          .input('NroRendicion', sql.NVarChar(50), data.nroRendicion || null)
          .input('NroCajaChica', sql.NVarChar(50), data.nroCajaChica || null)
          .input('TipoOperacion', sql.NVarChar(20), data.tipoOperacion || null)
          .input('CodLocal', sql.NVarChar(10), data.codLocal || null)
          .query(`
            INSERT INTO [dbo].[CntCtaGastoReparablePlanillas]
            ([ID], [NroPlanilla], [RazonSocial], [RUC], [Periodo], [FechaEmision],
             [NombresApellidos], [Cargo], [DNI], [CentroCosto],
             [TotalGeneral], [Usuario], [FechaCreacion],
             [NroRendicion], [NroCajaChica], [TipoOperacion], [CodLocal])
            VALUES
            (@ID, @NroPlanilla, @RazonSocial, @RUC, @Periodo, @FechaEmision,
             @NombresApellidos, @Cargo, @DNI, @CentroCosto,
             @TotalGeneral, @Usuario, GETDATE(),
             @NroRendicion, @NroCajaChica, @TipoOperacion, @CodLocal)
          `)

        console.log('✅ SQL Server - Planilla insertada en CntCtaGastoReparablePlanillas')

        // Insertar items en CntCtaGastoReparableItems
        for (const item of data.items) {
          await transaction
            .request()
            .input('PlanillaID', sql.NVarChar(255), data.id)
            .input('FechaGasto', sql.DateTime, item.fechaGasto || null)
            .input('Dia', sql.Int, item.dia || null)
            .input('Mes', sql.Int, item.mes || null)
            .input('Anio', sql.Int, item.anio || null)
            .input('TipoDoc', sql.NVarChar(50), item.tipoDoc || null)
            .input('Concepto', sql.NVarChar(255), item.concepto || null)
            .input('TipoGasto', sql.NVarChar(100), item.tipoGasto || null)
            .input('Importe', sql.Decimal(18, 2), item.importe)
            .query(`
              INSERT INTO [dbo].[CntCtaGastoReparableItems]
              ([PlanillaID], [FechaGasto], [Dia], [Mes], [Anio],
               [TipoDoc], [Concepto], [TipoGasto], [Importe], [FechaCreacion])
              VALUES
              (@PlanillaID, @FechaGasto, @Dia, @Mes, @Anio,
               @TipoDoc, @Concepto, @TipoGasto, @Importe, GETDATE())
            `)
        }

        console.log(`✅ SQL Server - ${data.items.length} items insertados en CntCtaGastoReparableItems`)

        await transaction.commit()
        console.log('✅ SQL Server - Transacción completada para gastos reparables')
      } catch (error) {
        await transaction.rollback()
        throw error
      }
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar planilla de gastos reparables:', error.message)
      throw new Error(`Failed to insert gasto reparable planilla: ${error.message}`)
    }
  }

  /**
   * Inserta una planilla de gastos reparables en CntCtaCajaChicaDocumentosIA
   */
  async insertGastoReparableEnDocumentosIA(data: {
    id: string
    nroPlanilla?: string
    nombresApellidos?: string
    totalGeneral: number
    nroRendicion?: string
    nroCajaChica?: string
    tipoOperacion?: 'RENDICION' | 'CAJA_CHICA'
    codLocal?: string
    items: Array<{
      fechaGasto?: Date
      concepto?: string
      importe: number
    }>
  }): Promise<void> {
    try {
      console.log('📄 SQL Server - Insertando gasto reparable en DocumentosIA...')

      const pool = await this.getPool()

      // Determinar tabla según tipo de operación
      let tableName = 'CntCtaDocumentosIA'
      let nroRend = data.nroRendicion

      if (data.tipoOperacion === 'CAJA_CHICA' && data.nroCajaChica) {
        tableName = 'CntCtaCajaChicaDocumentosIA'
        nroRend = data.nroCajaChica
      } else if (data.tipoOperacion === 'RENDICION' && data.nroRendicion) {
        tableName = 'CntCtaDocumentosIA'
        nroRend = data.nroRendicion
      }

      if (!nroRend) {
        console.log('⚠️ SQL Server - Sin número de rendición/caja chica, no se inserta en DocumentosIA')
        return
      }

      // Verificar si ya existe
      const checkResult = await pool
        .request()
        .input('UniqueID', sql.NVarChar(255), data.id)
        .query(`SELECT TOP 1 [UniqueID] FROM [dbo].[${tableName}] WHERE [UniqueID] = @UniqueID`)

      const exists = checkResult.recordset.length > 0

      // Construir descripción con items
      let descripcion = `GASTOS REPARABLES - ${data.nombresApellidos || 'N/A'}`
      if (data.items.length > 0) {
        const conceptos = data.items
          .map((item) => item.concepto)
          .filter((c) => c)
          .slice(0, 3)
        if (conceptos.length > 0) {
          descripcion += ` (${conceptos.join(', ')}${data.items.length > 3 ? '...' : ''})`
        }
      }

      if (exists) {
        // Actualizar registro existente
        await pool
          .request()
          .input('UniqueID', sql.NVarChar(255), data.id)
          .input('NroRend', sql.NVarChar(50), nroRend)
          .input('CodLocal', sql.NVarChar(10), data.codLocal || null)
          .input('TipoDocumento', sql.NVarChar(50), 'GASTO REPARABLE')
          .input('NroDocumento', sql.NVarChar(100), data.nroPlanilla || null)
          .input('Proveedor', sql.NVarChar(255), data.nombresApellidos || null)
          .input('Descripcion', sql.NVarChar(sql.MAX), descripcion)
          .input('Total', sql.Decimal(18, 2), data.totalGeneral)
          .input('CantidadItems', sql.Int, data.items.length)
          .query(`
            UPDATE [dbo].[${tableName}]
            SET
              [NroRend] = @NroRend,
              [CodLocal] = @CodLocal,
              [TipoDocumento] = @TipoDocumento,
              [NroDocumento] = @NroDocumento,
              [Proveedor] = @Proveedor,
              [Descripcion] = @Descripcion,
              [Total] = @Total,
              [CantidadItems] = @CantidadItems,
              [FechaActualizacion] = GETDATE()
            WHERE [UniqueID] = @UniqueID
          `)
      } else {
        // Insertar nuevo registro
        await pool
          .request()
          .input('UniqueID', sql.NVarChar(255), data.id)
          .input('NroRend', sql.NVarChar(50), nroRend)
          .input('CodLocal', sql.NVarChar(10), data.codLocal || null)
          .input('TipoDocumento', sql.NVarChar(50), 'GASTO REPARABLE')
          .input('NroDocumento', sql.NVarChar(100), data.nroPlanilla || null)
          .input('Proveedor', sql.NVarChar(255), data.nombresApellidos || null)
          .input('Descripcion', sql.NVarChar(sql.MAX), descripcion)
          .input('Total', sql.Decimal(18, 2), data.totalGeneral)
          .input('CantidadItems', sql.Int, data.items.length)
          .query(`
            INSERT INTO [dbo].[${tableName}]
            ([UniqueID], [NroRend], [CodLocal], [TipoDocumento], [NroDocumento],
             [Proveedor], [Descripcion], [Total], [CantidadItems],
             [FechaCreacion], [FechaActualizacion])
            VALUES
            (@UniqueID, @NroRend, @CodLocal, @TipoDocumento, @NroDocumento,
             @Proveedor, @Descripcion, @Total, @CantidadItems,
             GETDATE(), GETDATE())
          `)
      }

      console.log(`✅ SQL Server - 1 registro ${exists ? 'actualizado' : 'insertado'} en ${tableName} con ${data.items.length} items`)
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar gasto reparable en DocumentosIA:', error.message)
      throw new Error(`Failed to insert gasto reparable into DocumentosIA: ${error.message}`)
    }
  }
}
