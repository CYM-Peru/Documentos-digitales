interface SunatCredentials {
  clientId: string
  clientSecret: string
  rucEmpresa: string // RUC de la empresa que consulta (receptor)
}

interface ComprobanteData {
  numRuc: string       // RUC del emisor
  codComp: string      // 01=Factura, 03=Boleta, 07=NC, 08=ND
  numeroSerie: string  // F001, B001, etc
  numero: string       // Número correlativo
  fechaEmision: string // DD/MM/YYYY
  monto: string        // Monto total con decimales
}

interface SunatApiResponse {
  success: boolean
  message: string
  data: {
    estadoCp: '0' | '1' | '2' | '3' // 0=No existe, 1=Válido, 2=Anulado, 3=Rechazado
    estadoRuc?: string   // 00=Activo, 01=Baja provisional, 02=Baja definitiva, 03=Baja de oficio
    condDomiRuc?: string
    observaciones?: string[]
  }
}

interface SunatValidationResponse {
  estadoCp: '0' | '1' | '2' | '3' // 0=No existe, 1=Válido, 2=Anulado, 3=Rechazado
  estadoRuc?: string   // 00=Activo, 01=Baja provisional, 02=Baja definitiva, 03=Baja de oficio
  observaciones?: string[]
}

interface RucData {
  ddpNumruc: string
  ddpNombre: string
  descDep?: string
  descProv?: string
  descDist?: string
  descEstado?: string
  descFlag22?: string
  ddpTpoemp?: string
  descTpoemp?: string
}

interface RucDomicilioFiscal {
  descTipvia?: string
  descNomvia?: string
  descNumer?: string
  descInterior?: string
  descDpto?: string
  descDist?: string
  descProv?: string
  descDep?: string
  ddpCiiu?: string
  descCiiu?: string
}

export class SunatService {
  private clientId: string
  private clientSecret: string
  private rucEmpresa: string
  private tokenUrl: string
  private validarUrl: string
  private cachedToken?: { token: string; expiresAt: number }

  constructor(credentials: SunatCredentials) {
    this.clientId = credentials.clientId
    this.clientSecret = credentials.clientSecret
    this.rucEmpresa = credentials.rucEmpresa
    this.tokenUrl = `https://api-seguridad.sunat.gob.pe/v1/clientesextranet/${this.clientId}/oauth2/token/`
    this.validarUrl = `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${this.rucEmpresa}/validarcomprobante`
  }

  /**
   * Obtiene un token OAuth2 de SUNAT (con caché)
   */
  private async obtenerToken(): Promise<string> {
    // Usar token en caché si aún es válido
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt) {
      console.log('🔐 SUNAT - Usando token en caché')
      return this.cachedToken.token
    }

    console.log('🔐 SUNAT - Solicitando nuevo token OAuth2...')

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.sunat.gob.pe/v1/contribuyente/contribuyentes',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SUNAT Token Error ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      // Cachear token (expira 5 minutos antes del tiempo real para seguridad)
      this.cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000,
      }

      console.log('✅ SUNAT - Token obtenido exitosamente')
      return data.access_token
    } catch (error: any) {
      console.error('❌ SUNAT - Error al obtener token:', error.message)
      throw new Error('Failed to obtain SUNAT token')
    }
  }

  /**
   * Valida un comprobante electrónico contra SUNAT (sin reintentos)
   */
  async validarComprobante(datos: ComprobanteData): Promise<SunatValidationResponse> {
    console.log('📝 SUNAT - Validando comprobante:', {
      ruc: datos.numRuc,
      tipo: datos.codComp,
      serie: datos.numeroSerie,
      numero: datos.numero,
    })

    try {
      const token = await this.obtenerToken()

      const response = await fetch(this.validarUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datos),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SUNAT Validation Error ${response.status}: ${errorText}`)
      }

      const apiResponse: SunatApiResponse = await response.json()

      // Extraer datos del campo "data"
      const resultado: SunatValidationResponse = {
        estadoCp: apiResponse.data.estadoCp,
        estadoRuc: apiResponse.data.estadoRuc,
        observaciones: apiResponse.data.observaciones,
      }

      console.log('✅ SUNAT - Respuesta recibida:', {
        success: apiResponse.success,
        message: apiResponse.message,
        estadoCp: resultado.estadoCp,
        estadoRuc: resultado.estadoRuc,
        observaciones: resultado.observaciones,
      })

      return resultado
    } catch (error: any) {
      console.error('❌ SUNAT - Error al validar comprobante:', error.message)
      throw new Error('Failed to validate with SUNAT')
    }
  }

  /**
   * Validación INTELIGENTE con reintentos automáticos
   * Prueba con variaciones de monto y fecha si el primer intento falla
   */
  async validarComprobanteConReintentos(
    datos: ComprobanteData,
    maxReintentos: number = 3
  ): Promise<{ resultado: SunatValidationResponse; intentos: number; variacionUsada?: string }> {
    console.log('🧠 SUNAT - Validación inteligente iniciada')

    // Intento 1: Datos exactos
    try {
      const resultado = await this.validarComprobante(datos)

      // Si encuentra el comprobante (estadoCp != "0"), retornar inmediatamente
      if (resultado.estadoCp !== '0') {
        console.log('✅ SUNAT - Comprobante encontrado en el primer intento')
        return { resultado, intentos: 1 }
      }

      console.log('⚠️ SUNAT - Comprobante no encontrado, intentando con variaciones...')
    } catch (error) {
      console.log('⚠️ SUNAT - Error en primer intento:', error)
    }

    // Si no se encuentra, probar con variaciones de monto (±0.01, ±0.02)
    const montoOriginal = parseFloat(datos.monto)
    const variacionesMonto = [
      { monto: (montoOriginal + 0.01).toFixed(2), desc: 'monto +0.01' },
      { monto: (montoOriginal - 0.01).toFixed(2), desc: 'monto -0.01' },
      { monto: (montoOriginal + 0.02).toFixed(2), desc: 'monto +0.02' },
      { monto: (montoOriginal - 0.02).toFixed(2), desc: 'monto -0.02' },
    ]

    for (const variacion of variacionesMonto.slice(0, maxReintentos - 1)) {
      try {
        console.log(`🔄 SUNAT - Reintentando con ${variacion.desc}...`)
        const resultado = await this.validarComprobante({
          ...datos,
          monto: variacion.monto,
        })

        if (resultado.estadoCp !== '0') {
          console.log(`✅ SUNAT - Comprobante encontrado con ${variacion.desc}`)
          return {
            resultado,
            intentos: variacionesMonto.indexOf(variacion) + 2,
            variacionUsada: variacion.desc,
          }
        }
      } catch (error) {
        console.log(`⚠️ SUNAT - Error con ${variacion.desc}:`, error)
      }
    }

    // Si aún no se encuentra, probar con variaciones de fecha (±1 día)
    const [dia, mes, anio] = datos.fechaEmision.split('/')
    const fecha = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia))

    const variacionesFecha = [
      { dias: 1, desc: 'fecha +1 día' },
      { dias: -1, desc: 'fecha -1 día' },
    ]

    for (const variacion of variacionesFecha) {
      try {
        const nuevaFecha = new Date(fecha)
        nuevaFecha.setDate(nuevaFecha.getDate() + variacion.dias)

        const diaStr = String(nuevaFecha.getDate()).padStart(2, '0')
        const mesStr = String(nuevaFecha.getMonth() + 1).padStart(2, '0')
        const anioStr = nuevaFecha.getFullYear()
        const fechaStr = `${diaStr}/${mesStr}/${anioStr}`

        console.log(`🔄 SUNAT - Reintentando con ${variacion.desc}: ${fechaStr}`)
        const resultado = await this.validarComprobante({
          ...datos,
          fechaEmision: fechaStr,
        })

        if (resultado.estadoCp !== '0') {
          console.log(`✅ SUNAT - Comprobante encontrado con ${variacion.desc}`)
          return {
            resultado,
            intentos: maxReintentos + variacionesFecha.indexOf(variacion) + 1,
            variacionUsada: variacion.desc,
          }
        }
      } catch (error) {
        console.log(`⚠️ SUNAT - Error con ${variacion.desc}:`, error)
      }
    }

    // Intento CRÍTICO: Probar invirtiendo día y mes (error común de IA)
    // Si la IA extrajo mal: 11/03/2025 cuando debería ser 03/11/2025
    if (parseInt(dia) <= 12 && parseInt(mes) <= 12 && dia !== mes) {
      try {
        const fechaInvertida = `${mes}/${dia}/${anio}`
        console.log(`🔄 SUNAT - Reintentando con fecha invertida (día↔mes): ${fechaInvertida}`)
        const resultado = await this.validarComprobante({
          ...datos,
          fechaEmision: fechaInvertida,
        })

        if (resultado.estadoCp !== '0') {
          console.log(`✅ SUNAT - ¡Comprobante encontrado con fecha invertida! (error de IA corregido)`)
          return {
            resultado,
            intentos: maxReintentos + variacionesFecha.length + 1,
            variacionUsada: `fecha invertida (${fechaInvertida})`,
          }
        }
      } catch (error) {
        console.log(`⚠️ SUNAT - Error con fecha invertida:`, error)
      }
    }

    // Si no se encontró con ninguna variación, retornar el estado "0" (no existe)
    console.log('⚠️ SUNAT - Comprobante no encontrado después de todos los reintentos')
    return {
      resultado: { estadoCp: '0' },
      intentos: maxReintentos + variacionesFecha.length,
    }
  }

  /**
   * Convierte datos extraídos por IA al formato que espera SUNAT
   */
  static convertirDatosParaSunat(ocrData: {
    rucEmisor?: string
    documentTypeCode?: string
    serieNumero?: string
    invoiceDate?: Date
    totalAmount?: number
  }): ComprobanteData | null {
    // Validar que tenemos los datos mínimos necesarios
    if (!ocrData.rucEmisor || !ocrData.documentTypeCode || !ocrData.serieNumero || !ocrData.totalAmount) {
      console.log('⚠️ SUNAT - Datos insuficientes para validar')
      return null
    }

    // Extraer serie y número del formato "F001-00012345"
    const match = ocrData.serieNumero.match(/^([A-Z0-9]+)-(\d+)$/)
    if (!match) {
      console.log('⚠️ SUNAT - Formato de serie-número inválido:', ocrData.serieNumero)
      return null
    }

    const [, numeroSerie, numero] = match

    // Convertir fecha al formato DD/MM/YYYY (usar UTC para evitar problemas de timezone)
    let fechaEmision = ''
    if (ocrData.invoiceDate) {
      const date = new Date(ocrData.invoiceDate)
      const dia = String(date.getUTCDate()).padStart(2, '0')
      const mes = String(date.getUTCMonth() + 1).padStart(2, '0')
      const anio = date.getUTCFullYear()
      fechaEmision = `${dia}/${mes}/${anio}`
    }

    return {
      numRuc: ocrData.rucEmisor,
      codComp: ocrData.documentTypeCode,
      numeroSerie: numeroSerie,
      numero: numero,
      fechaEmision: fechaEmision,
      monto: ocrData.totalAmount.toFixed(2),
    }
  }

  /**
   * Interpreta el resultado de la validación SUNAT
   */
  static interpretarEstado(estadoCp: string): {
    valido: boolean
    mensaje: string
    color: string
  } {
    switch (estadoCp) {
      case '1':
        return {
          valido: true,
          mensaje: 'Comprobante VÁLIDO en SUNAT',
          color: 'green',
        }
      case '0':
        return {
          valido: false,
          mensaje: 'Comprobante NO EXISTE en SUNAT',
          color: 'red',
        }
      case '2':
        return {
          valido: false,
          mensaje: 'Comprobante ANULADO',
          color: 'orange',
        }
      case '3':
        return {
          valido: false,
          mensaje: 'Comprobante RECHAZADO por SUNAT',
          color: 'red',
        }
      default:
        return {
          valido: false,
          mensaje: 'Estado desconocido',
          color: 'gray',
        }
    }
  }

  /**
   * Descarga el XML del comprobante desde SUNAT
   * Requiere los mismos datos que la validación
   */
  async descargarXML(datos: ComprobanteData): Promise<string> {
    console.log('📥 SUNAT - Descargando XML del comprobante:', {
      ruc: datos.numRuc,
      tipo: datos.codComp,
      serie: datos.numeroSerie,
      numero: datos.numero,
    })

    try {
      const token = await this.obtenerToken()

      // URL para obtener el XML/CDR del comprobante
      const downloadUrl = `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${this.rucEmpresa}/validarcomprobante`

      const response = await fetch(downloadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datos),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SUNAT XML Error ${response.status}: ${errorText}`)
      }

      const resultado = await response.json()

      // SUNAT no proporciona XML directamente en la API de validación
      // La API solo valida, no retorna el XML
      // Para obtener el XML real, se necesita acceso al sistema OSE del emisor
      console.log('⚠️ SUNAT - La API de validación no proporciona el XML directamente')
      console.log('📝 SUNAT - Datos del comprobante validado:', resultado)

      // Generar un XML de respuesta con los datos de validación
      const xmlValidacion = this.generarXMLValidacion(datos, resultado)

      return xmlValidacion
    } catch (error: any) {
      console.error('❌ SUNAT - Error al descargar XML:', error.message)
      throw new Error('Failed to download XML from SUNAT')
    }
  }

  /**
   * Genera un XML con los datos de validación SUNAT
   * (No es el XML original del comprobante, sino un resumen de validación)
   */
  private generarXMLValidacion(datos: ComprobanteData, validacion: any): string {
    const fecha = new Date().toISOString()

    return `<?xml version="1.0" encoding="UTF-8"?>
<ValidacionSUNAT>
  <FechaConsulta>${fecha}</FechaConsulta>
  <Comprobante>
    <NumRuc>${datos.numRuc}</NumRuc>
    <CodComp>${datos.codComp}</CodComp>
    <NumeroSerie>${datos.numeroSerie}</NumeroSerie>
    <Numero>${datos.numero}</Numero>
    <FechaEmision>${datos.fechaEmision}</FechaEmision>
    <Monto>${datos.monto}</Monto>
  </Comprobante>
  <ResultadoValidacion>
    <EstadoCP>${validacion.estadoCp || 'N/A'}</EstadoCP>
    <EstadoRUC>${validacion.estadoRuc || 'N/A'}</EstadoRUC>
    <Observaciones>${validacion.observaciones ? validacion.observaciones.join(', ') : 'Ninguna'}</Observaciones>
  </ResultadoValidacion>
  <Nota>
    Este XML contiene los datos de validación de SUNAT.
    Para obtener el XML original del comprobante electrónico (firmado digitalmente),
    debe solicitarlo directamente al emisor o acceder al portal del OSE.
  </Nota>
</ValidacionSUNAT>`
  }

  /**
   * Consulta información oficial de un RUC en SUNAT
   */
  async consultarRuc(ruc: string): Promise<RucData & { domicilioFiscal?: RucDomicilioFiscal }> {
    console.log('🔍 SUNAT - Consultando RUC:', ruc)

    try {
      const token = await this.obtenerToken()

      // El RUC a consultar va directamente en la URL
      const response = await fetch(
        `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ SUNAT RUC Query Error:', errorText)
        throw new Error(`SUNAT RUC Query Error ${response.status}: ${errorText}`)
      }

      const data: RucData = await response.json()

      console.log('✅ SUNAT - Datos del RUC obtenidos:', {
        ruc: data.ddpNumruc,
        nombre: data.ddpNombre,
        estado: data.descEstado,
      })

      // Consultar domicilio fiscal separadamente
      let domicilioFiscal: RucDomicilioFiscal | undefined
      try {
        const domicilioResponse = await fetch(
          `https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/${ruc}/domiciliofiscal`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (domicilioResponse.ok) {
          domicilioFiscal = await domicilioResponse.json()
          console.log('✅ SUNAT - Domicilio fiscal obtenido')
        }
      } catch (error) {
        console.log('⚠️ SUNAT - No se pudo obtener domicilio fiscal (no crítico)')
      }

      return { ...data, domicilioFiscal }
    } catch (error: any) {
      console.error('❌ SUNAT - Error al consultar RUC:', error.message)
      throw new Error('Failed to query RUC from SUNAT')
    }
  }

  /**
   * Interpreta el estado del RUC
   */
  static interpretarEstadoRuc(estado?: string): {
    activo: boolean
    mensaje: string
    color: string
  } {
    if (!estado) {
      return {
        activo: false,
        mensaje: 'Estado desconocido',
        color: 'gray',
      }
    }

    const estadoUpper = estado.toUpperCase()

    if (estadoUpper.includes('ACTIVO')) {
      return {
        activo: true,
        mensaje: 'RUC ACTIVO',
        color: 'green',
      }
    } else if (estadoUpper.includes('BAJA DEFINITIVA')) {
      return {
        activo: false,
        mensaje: 'RUC con BAJA DEFINITIVA',
        color: 'red',
      }
    } else if (estadoUpper.includes('BAJA')) {
      return {
        activo: false,
        mensaje: 'RUC dado de BAJA',
        color: 'orange',
      }
    } else if (estadoUpper.includes('SUSPENDIDO')) {
      return {
        activo: false,
        mensaje: 'RUC SUSPENDIDO',
        color: 'orange',
      }
    } else {
      return {
        activo: false,
        mensaje: estado,
        color: 'gray',
      }
    }
  }
}
