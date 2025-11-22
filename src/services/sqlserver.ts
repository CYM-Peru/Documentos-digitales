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
   * Elimina una factura por ID
   */
  async deleteInvoice(invoiceId: string): Promise<number> {
    try {
      console.log('📊 SQL Server - Eliminando factura:', invoiceId)

      const pool = await this.getPool()
      const result = await pool
        .request()
        .input('ID', sql.NVarChar(50), invoiceId)
        .query('DELETE FROM [dbo].[CntCtaRendicionDocumentosIA] WHERE [ID] = @ID')

      const deletedRows = result.rowsAffected[0] || 0
      console.log(`✅ SQL Server - Factura eliminada (${deletedRows} fila(s))`)
      return deletedRows
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
   * Obtiene las rendiciones pendientes de un usuario
   * @param codUserAsg - Código de usuario (parte antes del @ del email)
   * @returns Lista de rendiciones pendientes
   */
  async getRendicionesPendientes(codUserAsg: string): Promise<RendicionPendiente[]> {
    try {
      // Convertir a mayúsculas para coincidir con SQL Server
      const codUserAsgUpper = codUserAsg.toUpperCase()
      console.log('📋 SQL Server - Consultando rendiciones pendientes para:', codUserAsgUpper)

      const pool = await this.getPool()
      const result = await pool
        .request()
        .input('CodUserAsg', sql.VarChar(50), codUserAsgUpper)
        .query(`
          SELECT CodUserAsg, CodEstado, NroRend
          FROM AZALEIAPERU.DBO.CntCtaRendicionDeCuentas
          WHERE CodEstado = '00'
            AND YEAR(FCHREG) >= 2025
            AND CodUserAsg = @CodUserAsg
          ORDER BY NroRend DESC
        `)

      console.log(`✅ SQL Server - ${result.recordset.length} rendiciones pendientes encontradas`)
      return result.recordset
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener rendiciones pendientes:', error.message)
      throw new Error(`Failed to get rendiciones pendientes: ${error.message}`)
    }
  }

  /**
   * Obtiene las cajas chicas pendientes de un usuario
   * @param codUserAsg - Código de usuario (parte antes del @ del email)
   * @returns Lista de cajas chicas pendientes
   */
  async getCajasChicasPendientes(codUserAsg: string): Promise<CajaChicaPendiente[]> {
    try {
      // Convertir a mayúsculas para coincidir con SQL Server
      const codUserAsgUpper = codUserAsg.toUpperCase()
      console.log('💰 SQL Server - Consultando cajas chicas pendientes para:', codUserAsgUpper)

      const pool = await this.getPool()
      const result = await pool
        .request()
        .input('CodUserAsg', sql.VarChar(50), codUserAsgUpper)
        .query(`
          SELECT CodLocal, NroRend, CodUserAsg, CodEstado
          FROM [dbo].[CntCtaCajaChica]
          WHERE CodEstado = '00'
            AND CodUserAsg = @CodUserAsg
          ORDER BY NroRend DESC
        `)

      console.log(`✅ SQL Server - ${result.recordset.length} cajas chicas pendientes encontradas`)
      return result.recordset
    } catch (error: any) {
      console.error('❌ SQL Server - Error al obtener cajas chicas pendientes:', error.message)
      throw new Error(`Failed to get cajas chicas pendientes: ${error.message}`)
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

      // Determinar descripción
      let descripcionProducto = 'SIN DETALLE DE ITEMS'
      let cantidadItems = 0

      if (invoice.items && invoice.items.length > 0) {
        const primerItem = invoice.items[0]
        descripcionProducto = primerItem.descripcion || 'ITEM SIN DESCRIPCIÓN'
        cantidadItems = invoice.items.length
      } else if (invoice.documentType?.includes('RECIBO') || invoice.documentType?.includes('HONORARIOS')) {
        descripcionProducto = 'SERVICIO PROFESIONAL'
      }

      // Sanitizar y truncar campos
      const descripcion = this.sanitizeString(descripcionProducto, 255)
      const razonSocial = this.sanitizeString(invoice.razonSocialEmisor, 255)
      const tipoDoc = this.sanitizeString(invoice.documentType, 255)
      const serieNum = this.sanitizeString(invoice.serieNumero, 255)
      const estado = this.sanitizeString(invoice.status, 255)
      const moneda = this.sanitizeString(invoice.currency, 255)
      const usuario = this.sanitizeString(invoice.usuario, 100)
      const nroCajaChica = invoice.nroRendicion ? parseInt(invoice.nroRendicion, 10) : null
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
        .input('NroCajaChica', sql.Int, nroCajaChica)
        .input('Usuario', sql.VarChar(100), usuario)
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
            [NroCajaChica],
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
            @NroCajaChica,
            @Usuario
          )
        `)

      console.log('✅ SQL Server - 1 fila insertada correctamente en CntCtaCajaChicaDocumentosIA')
      return 1
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar factura de caja chica:', error.message)
      throw new Error(`Failed to insert caja chica invoice into SQL Server: ${error.message}`)
    }
  }

  /**
   * Inserta una planilla de movilidad en las tablas CntCtaMovilidadPlanillas y CntCtaMovilidadGastos
   */
  async insertMovilidadPlanilla(planilla: MovilidadPlanillaData): Promise<number> {
    try {
      console.log('🚗 SQL Server - Insertando planilla de movilidad:', planilla.id)

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

      // Insertar planilla (cabecera)
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
   * 🆕 Inserta planilla de movilidad en CntCtaCajaChicaDocumentosIA
   * Se ejecuta cuando la planilla se asigna a una rendición o caja chica
   */
  async insertMovilidadEnDocumentosIA(planilla: MovilidadPlanillaData): Promise<void> {
    try {
      console.log('📄 SQL Server - Insertando planilla en CntCtaCajaChicaDocumentosIA:', planilla.id)

      const pool = await this.getPool()

      // Sanitizar campos
      const rucEmisor = this.sanitizeString(planilla.ruc, 50)
      const razonSocialEmisor = this.sanitizeString(planilla.razonSocial, 255)
      const vendorName = this.sanitizeString(
        planilla.nombresApellidos + ' - Movilidad',
        255
      )
      const usuario = this.sanitizeString(planilla.usuario, 100)

      // Determinar NroRend o NroCajaChica
      const nroRend = planilla.nroRendicion ? parseInt(planilla.nroRendicion, 10) : null
      const nroCajaChica = planilla.nroCajaChica ? parseInt(planilla.nroCajaChica, 10) : null

      // Insertar en CntCtaCajaChicaDocumentosIA
      await pool
        .request()
        .input('ID', sql.NVarChar(255), planilla.id)
        .input('RucEmisor', sql.NVarChar(50), rucEmisor)
        .input('RazonSocialEmisor', sql.NVarChar(255), razonSocialEmisor)
        .input('VendorName', sql.NVarChar(255), vendorName)
        .input('InvoiceNumber', sql.NVarChar(100), planilla.nroPlanilla || null)
        .input('InvoiceDate', sql.DateTime, planilla.fechaEmision || new Date())
        .input('TotalAmount', sql.Float, planilla.totalGeneral || 0)
        .input('Usuario', sql.VarChar(100), usuario)
        .input('NroRend', sql.Int, nroRend)
        .input('NroCajaChica', sql.Int, nroCajaChica)
        .input('TipoOperacion', sql.VarChar(20), planilla.tipoOperacion || null)
        .input('Status', sql.VarChar(50), 'COMPLETED')
        .input('CreatedAt', sql.DateTime, new Date())
        .query(`
          INSERT INTO [dbo].[CntCtaCajaChicaDocumentosIA] (
            [ID], [RucEmisor], [RazonSocialEmisor], [VendorName],
            [InvoiceNumber], [InvoiceDate], [TotalAmount],
            [Usuario], [NroRend], [NroCajaChica], [TipoOperacion],
            [Status], [CreatedAt]
          ) VALUES (
            @ID, @RucEmisor, @RazonSocialEmisor, @VendorName,
            @InvoiceNumber, @InvoiceDate, @TotalAmount,
            @Usuario, @NroRend, @NroCajaChica, @TipoOperacion,
            @Status, @CreatedAt
          )
        `)

      console.log('✅ SQL Server - Planilla insertada en CntCtaCajaChicaDocumentosIA')
    } catch (error: any) {
      console.error('❌ SQL Server - Error al insertar en CntCtaCajaChicaDocumentosIA:', error.message)
      throw new Error(`Failed to insert into CntCtaCajaChicaDocumentosIA: ${error.message}`)
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
}
