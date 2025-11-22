import { ImageAnnotatorClient } from '@google-cloud/vision'

interface VisionCredentials {
  serviceAccount: any
}

interface ExtractedData {
  vendorName?: string
  invoiceNumber?: string
  invoiceDate?: Date
  totalAmount?: number
  currency?: string
  taxAmount?: number
  // Campos específicos para facturas peruanas
  rucEmisor?: string
  razonSocialEmisor?: string
  domicilioFiscalEmisor?: string
  rucReceptor?: string
  dniReceptor?: string
  razonSocialReceptor?: string
  serieNumero?: string
  subtotal?: number
  igvTasa?: number
  igvMonto?: number
  rawData: any
}

export class VisionService {
  private client: ImageAnnotatorClient

  constructor(credentials: VisionCredentials) {
    console.log('VisionService - Initializing with service account:', {
      clientEmail: credentials.serviceAccount?.client_email || 'MISSING',
      projectId: credentials.serviceAccount?.project_id || 'MISSING',
    })

    this.client = new ImageAnnotatorClient({
      credentials: credentials.serviceAccount,
    })
  }

  async analyzeExpense(imageBuffer: Buffer): Promise<ExtractedData> {
    try {
      console.log('VisionService - Starting document text detection...')

      // Use document text detection for better OCR on invoices
      const [result] = await this.client.documentTextDetection({
        image: { content: imageBuffer },
      })

      console.log('VisionService - Document text detection completed')

      return this.extractExpenseData(result)
    } catch (error) {
      console.error('Vision API error:', error)
      throw new Error('Failed to analyze expense with Google Cloud Vision')
    }
  }

  private extractExpenseData(result: any): ExtractedData {
    let data: ExtractedData = {
      rawData: result,
    }

    // Get full text from the document
    const fullText = result.fullTextAnnotation?.text || ''
    console.log('VisionService - Extracted text length:', fullText.length)

    // Detectar tipo de documento
    const documentType = this.detectDocumentType(fullText)
    console.log('📄 Tipo de documento detectado:', documentType)

    // Extract structured data using text blocks
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      const lines = this.extractLines(result.textAnnotations)
      console.log('📝 Total de líneas detectadas:', lines.length)

      // ========== EXTRACCIÓN ESPECÍFICA PARA FACTURAS PERUANAS (SUNAT) ==========

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineLower = line.toLowerCase()
        const nextLine = i + 1 < lines.length ? lines[i + 1] : ''
        const prevLine = i > 0 ? lines[i - 1] : ''
        // Buscar en las siguientes 10 líneas para números (aumentado de 5 a 10)
        const next10Lines = lines.slice(i + 1, i + 11).join(' ')
        // Buscar en líneas anteriores para contexto
        const prev3Lines = lines.slice(Math.max(0, i - 3), i).join(' ')

        // 1. RUC del Emisor (11 dígitos, generalmente empieza con 10 o 20)
        const rucMatch = line.match(/\b(10|20)\d{9}\b/)
        if (rucMatch && !data.rucEmisor) {
          data.rucEmisor = rucMatch[0]
          console.log('✓ RUC Emisor encontrado:', data.rucEmisor)
        }

        // 2. Serie y Número de Factura/Boleta (varios formatos)
        // Formato con letra: F001-12345678, B001-12345678
        let serieMatch = line.match(/\b([FBTE]\d{3}[-\s]?\d{5,8})\b/i)
        // Formato solo números: 8092-00272073 (puede ser B092 detectado como 8092)
        if (!serieMatch) {
          serieMatch = line.match(/\b(\d{4}[-]\d{8})\b/)
        }
        if (serieMatch && !data.serieNumero) {
          let serieNumero = serieMatch[0].replace(/\s/g, '')

          // POST-PROCESAMIENTO: Corregir error común B/8 en boletas
          // Si es BOLETA y empieza con 8, probablemente sea B
          const esBoleta = fullText.toUpperCase().includes('BOLETA')
          if (esBoleta && serieNumero.match(/^8\d{3}-/)) {
            serieNumero = 'B' + serieNumero.substring(1)
            console.log('✓ Serie corregida (8→B para BOLETA):', serieNumero)
          }
          // Si es FACTURA y empieza con 8, probablemente sea F
          const esFactura = fullText.toUpperCase().includes('FACTURA')
          if (esFactura && serieNumero.match(/^8\d{3}-/)) {
            serieNumero = 'F' + serieNumero.substring(1)
            console.log('✓ Serie corregida (8→F para FACTURA):', serieNumero)
          }

          data.serieNumero = serieNumero
          data.invoiceNumber = serieNumero
          console.log('✓ Serie/Número encontrado:', data.serieNumero)
        }

        // 3. Razón Social del Emisor (usualmente después del RUC o al inicio)
        if (!data.razonSocialEmisor) {
          // Si encontramos palabras clave de empresa
          if (lineLower.includes('s.a.') || lineLower.includes('s.r.l') ||
              lineLower.includes('e.i.r.l') || lineLower.includes('s.a.c')) {
            // Buscar en líneas anteriores para obtener el nombre completo
            const contextLines = prev3Lines + ' ' + line
            // Buscar desde la primera palabra en mayúsculas hasta S.A./S.R.L/etc
            const match = contextLines.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,}(?:S\.A\.|S\.R\.L|E\.I\.R\.L|S\.A\.C)\.?)/i)
            if (match && match[1]) {
              const razonSocial = match[1].trim()
              // Solo aceptar si tiene más de 5 caracteres (no solo "S.A.")
              if (razonSocial.length > 5) {
                data.razonSocialEmisor = razonSocial
                data.vendorName = razonSocial
                console.log('✓ Razón Social Emisor:', data.razonSocialEmisor)
              }
            }
          }
        }

        // 4. Domicilio Fiscal (buscar direcciones)
        if (!data.domicilioFiscalEmisor) {
          if (lineLower.includes('calle') || lineLower.includes('av.') ||
              lineLower.includes('avenida') || lineLower.includes('jr.') ||
              lineLower.includes('jirón') || lineLower.includes('psje')) {
            data.domicilioFiscalEmisor = line + (nextLine && !nextLine.match(/\d{11}/) ? ' ' + nextLine : '')
            console.log('✓ Domicilio Fiscal:', data.domicilioFiscalEmisor)
          }
        }

        // 5. Fecha de Emisión
        if (!data.invoiceDate) {
          // Buscar patrones de fecha peruanos: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY
          const dateMatch = line.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
          if (dateMatch) {
            // Buscar contexto de fecha
            const isFechaEmision = lineLower.includes('fecha') || lineLower.includes('emisión') ||
                                   lineLower.includes('emision') || lineLower.includes('fec.')
            const hasFechaAbove = i > 0 && lines[i-1].toLowerCase().includes('fecha')

            if (isFechaEmision || hasFechaAbove) {
              const parsedDate = this.parseDateAdvanced(line, next10Lines)
              if (parsedDate) {
                data.invoiceDate = parsedDate
                console.log('✓ Fecha encontrada:', parsedDate.toLocaleDateString('es-PE'))
              }
            }
          }
        }

        // 8. TOTAL A PAGAR - MÁXIMA PRIORIDAD (detectar primero antes que subtotal/IGV)
        // Buscar "TOTAL A PAGAR" en líneas consecutivas
        const combinedNext = line + ' ' + nextLine + ' ' + next10Lines
        const combinedNextLower = combinedNext.toLowerCase()

        if (!data.totalAmount && combinedNextLower.includes('total') && combinedNextLower.includes('pagar')) {
          const totalAmt = this.extractAmount(line, next10Lines)
          if (totalAmt && totalAmt > 0) {
            data.totalAmount = totalAmt
            console.log('✓✓✓ TOTAL A PAGAR encontrado:', totalAmt)
          }
        }

        // 6. Subtotal / Valor de Venta (sin IGV) / Operación Gravada
        // IMPORTANTE: En Perú, "OP GRAVADA" o "OPERACIÓN GRAVADA" es la base imponible (sin IGV)
        if (!data.subtotal) {
          const combinedLower = (line + ' ' + nextLine + ' ' + next10Lines).toLowerCase()
          const isOpGravada = combinedLower.includes('op') && combinedLower.includes('gravada')
          const isValorVenta = combinedLower.includes('valor') && combinedLower.includes('venta')
          const isSubtotal = combinedLower.includes('subtotal')
          const isBaseImponible = combinedLower.includes('base') && combinedLower.includes('imponible')

          if (isOpGravada || isValorVenta || isBaseImponible || isSubtotal) {
            const amount = this.extractAmount(line, next10Lines)
            if (amount && amount > 0) {
              data.subtotal = amount
              console.log('✓ Subtotal/OP GRAVADA encontrado:', amount, '- Patrón:', isOpGravada ? 'OP GRAVADA' : isValorVenta ? 'VALOR VENTA' : 'SUBTOTAL')
            }
          }
        }

        // 7. IGV (Impuesto General a las Ventas) - Mejorado
        if (!data.igvMonto) {
          const igvContext = (line + ' ' + nextLine + ' ' + next10Lines).toLowerCase()
          if (igvContext.includes('i.g.v') || igvContext.includes('igv')) {
            const igvAmount = this.extractAmount(line, next10Lines)
            if (igvAmount && igvAmount > 0) {
              data.igvMonto = igvAmount
              data.taxAmount = igvAmount
              console.log('✓ IGV Monto encontrado:', igvAmount)

              // Extraer tasa del texto
              const tasaMatch = igvContext.match(/(\d{1,2})\s*%/)
              if (tasaMatch) {
                data.igvTasa = parseFloat(tasaMatch[1])
                console.log('✓ IGV Tasa encontrada:', data.igvTasa + '%')
              }
            }
          }
        }

        // 9. IMPORTE TOTAL (solo si no encontramos TOTAL A PAGAR)
        if (!data.totalAmount && combinedNextLower.includes('importe') && combinedNextLower.includes('total')) {
          const totalAmt = this.extractAmount(line, next10Lines)
          if (totalAmt && totalAmt > 0) {
            data.totalAmount = totalAmt
            console.log('✓ Importe Total encontrado:', totalAmt)
          }
        }

        // 9. RUC/DNI del Receptor (cliente)
        if (!data.rucReceptor && !data.dniReceptor) {
          if (lineLower.includes('cliente') || lineLower.includes('señor') ||
              lineLower.includes('adquiriente')) {
            // Buscar RUC del cliente
            const clientRuc = nextLine.match(/\b(10|20)\d{9}\b/)
            if (clientRuc) {
              data.rucReceptor = clientRuc[0]
              console.log('✓ RUC Receptor:', data.rucReceptor)
            }
            // Buscar DNI del cliente (8 dígitos)
            const clientDni = nextLine.match(/\b\d{8}\b/)
            if (clientDni && !clientRuc) {
              data.dniReceptor = clientDni[0]
              console.log('✓ DNI Receptor:', data.dniReceptor)
            }
          }
        }
      }

      // Calcular campos faltantes si es posible
      if (data.totalAmount && data.igvMonto && !data.subtotal) {
        data.subtotal = data.totalAmount - data.igvMonto
        console.log('✓ Subtotal calculado:', data.subtotal)
      }

      if (data.subtotal && data.totalAmount && !data.igvMonto) {
        data.igvMonto = data.totalAmount - data.subtotal
        data.taxAmount = data.igvMonto
        console.log('✓ IGV calculado:', data.igvMonto)
      }

      // Solo calcular tasa si no se encontró en el texto
      if (!data.igvTasa && data.igvMonto && data.subtotal && data.subtotal > 0) {
        const calculatedTasa = Math.round((data.igvMonto / data.subtotal) * 100)
        // Verificar que la tasa calculada sea razonable (10% o 18% para Perú)
        if (calculatedTasa >= 8 && calculatedTasa <= 20) {
          data.igvTasa = calculatedTasa
          console.log('✓ IGV Tasa calculada:', data.igvTasa + '%')
        }
      }
    }

    // Extract currency (Perú usa Soles - PEN)
    const currencyMatch = fullText.match(/S\/|PEN|soles?|nuevos soles/i)
    if (currencyMatch) {
      data.currency = 'PEN'
    } else if (fullText.match(/\$|USD|dólares?/i)) {
      data.currency = 'USD'
    }

    console.log('VisionService - Datos extraídos (Perú) - ANTES DE IA:', {
      rucEmisor: data.rucEmisor || 'NOT FOUND',
      razonSocialEmisor: data.razonSocialEmisor ? 'FOUND' : 'NOT FOUND',
      serieNumero: data.serieNumero || 'NOT FOUND',
      invoiceDate: data.invoiceDate ? 'FOUND' : 'NOT FOUND',
      subtotal: data.subtotal || 'NOT FOUND',
      igvMonto: data.igvMonto || 'NOT FOUND',
      igvTasa: data.igvTasa ? data.igvTasa + '%' : 'NOT FOUND',
      totalAmount: data.totalAmount || 'NOT FOUND',
      currency: data.currency || 'NOT FOUND',
    })

    // ========== POST-PROCESAMIENTO INTELIGENTE CON IA ==========
    // Si los datos están mal o incompletos, usar análisis de contexto
    data = this.intelligentPostProcessing(data, fullText)

    console.log('VisionService - Datos extraídos (Perú) - DESPUÉS DE IA:', {
      rucEmisor: data.rucEmisor || 'NOT FOUND',
      razonSocialEmisor: data.razonSocialEmisor ? 'FOUND' : 'NOT FOUND',
      serieNumero: data.serieNumero || 'NOT FOUND',
      invoiceDate: data.invoiceDate ? 'FOUND' : 'NOT FOUND',
      subtotal: data.subtotal || 'NOT FOUND',
      igvMonto: data.igvMonto || 'NOT FOUND',
      igvTasa: data.igvTasa ? data.igvTasa + '%' : 'NOT FOUND',
      totalAmount: data.totalAmount || 'NOT FOUND',
      currency: data.currency || 'NOT FOUND',
    })

    return data
  }

  private extractLines(textAnnotations: any[]): string[] {
    if (textAnnotations.length === 0) return []

    // First annotation is the full text, skip it
    const words = textAnnotations.slice(1)
    const lines: string[] = []
    let currentLine = ''
    let lastY = -1

    for (const word of words) {
      const vertices = word.boundingPoly?.vertices || []
      if (vertices.length === 0) continue

      const y = vertices[0].y || 0

      // New line detection (if Y coordinate changes significantly)
      // REDUCIDO de 10 a 3 para agrupar mejor las palabras en la misma línea
      if (lastY !== -1 && Math.abs(y - lastY) > 3) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim())
        }
        currentLine = word.description
      } else {
        currentLine += ' ' + word.description
      }

      lastY = y
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }

    return lines
  }

  private extractValue(line: string, nextLine: string): string {
    // Try to extract value from the same line first
    const parts = line.split(/[:：]/);
    if (parts.length > 1) {
      const value = parts[1].trim()
      if (value) return value
    }

    // If not found in same line, use next line
    return nextLine.trim()
  }

  private extractAmount(line: string, nextLine: string): number | undefined {
    // Try to find amount in the same line
    const combined = line + ' ' + nextLine
    // Mejorado: Buscar montos con formato decimal, ignorar porcentajes
    const amountMatch = combined.match(/[\$€S\/]?\s*[\d,]+\.?\d*/g)

    if (amountMatch) {
      for (const match of amountMatch) {
        // Ignorar si está seguido de % (es un porcentaje, no un monto)
        const matchIndex = combined.indexOf(match)
        const afterMatch = combined.substring(matchIndex + match.length, matchIndex + match.length + 3)
        if (afterMatch.includes('%')) continue

        const amount = this.parseAmount(match)
        if (amount && amount > 0) return amount
      }
    }

    return undefined
  }

  private intelligentPostProcessing(data: ExtractedData, fullText: string): ExtractedData {
    console.log('🤖 Iniciando post-procesamiento inteligente...')

    // ===== TOTAL A PAGAR - MÁXIMA PRIORIDAD =====
    // Buscar "TOTAL A PAGAR" y el número que viene después (permite saltos de línea)
    let totalAPagarMatch = fullText.match(/TOTAL\s*A\s*PAGAR[\s\S]{0,30}?(\d+[.,]\d+)/i)
    if (totalAPagarMatch) {
      const totalAPagar = this.parseAmount(totalAPagarMatch[1])
      if (totalAPagar && totalAPagar > 0) {
        data.totalAmount = totalAPagar
        console.log('🎯 IA: TOTAL A PAGAR corregido:', totalAPagar)
      }
    }

    // Si no encontró, buscar "MONTO PAGADO", "IMPORTE TOTAL", etc.
    if (!totalAPagarMatch) {
      const alternativas = [
        /MONTO\s*PAGADO[\s\S]{0,30}?(\d+[.,]\d+)/i,
        /IMPORTE\s*TOTAL[\s\S]{0,30}?(\d+[.,]\d+)/i,
        /TOTAL\s*NETO[\s\S]{0,30}?(\d+[.,]\d+)/i,
      ]

      for (const regex of alternativas) {
        const match = fullText.match(regex)
        if (match) {
          const total = this.parseAmount(match[1])
          if (total && total > 0) {
            data.totalAmount = total
            console.log('🎯 IA: Total alternativo detectado:', total)
            break
          }
        }
      }
    }

    // ===== OP GRAVADA (Subtotal sin IGV) =====
    const opGravadaMatch = fullText.match(/OP\.?\s*GRAVADA[\s\S]{0,30}?(\d+[.,]\d+)/i)
    if (opGravadaMatch) {
      const opGravada = this.parseAmount(opGravadaMatch[1])
      if (opGravada && opGravada > 0) {
        data.subtotal = opGravada
        console.log('🎯 IA: OP GRAVADA corregido:', opGravada)
      }
    }

    // ===== IGV =====
    const igvMatch = fullText.match(/I\.?G\.?V\.?\s*\((\d+)%\)[\s\S]{0,30}?(\d+[.,]\d+)/i)
    if (igvMatch) {
      const tasa = parseFloat(igvMatch[1])
      const monto = this.parseAmount(igvMatch[2])
      if (monto && monto > 0) {
        data.igvMonto = monto
        data.taxAmount = monto
        data.igvTasa = tasa
        console.log('🎯 IA: IGV corregido:', monto, `(${tasa}%)`)
      }
    }

    // ===== VALIDACIÓN DE COHERENCIA =====
    // Si tenemos subtotal e IGV, el total debe ser subtotal + IGV
    if (data.subtotal && data.igvMonto && data.totalAmount) {
      const calculatedTotal = data.subtotal + data.igvMonto
      const difference = Math.abs(calculatedTotal - data.totalAmount)

      if (difference > 1) {
        console.log('⚠️ IA: Inconsistencia detectada!')
        console.log(`  Subtotal: ${data.subtotal}`)
        console.log(`  IGV: ${data.igvMonto}`)
        console.log(`  Total calculado: ${calculatedTotal}`)
        console.log(`  Total detectado: ${data.totalAmount}`)
        console.log(`  Diferencia: ${difference}`)

        // Si la diferencia es grande, confiar en TOTAL A PAGAR
        console.log('  → Confiando en TOTAL A PAGAR y recalculando subtotal/IGV')
      } else {
        console.log('✅ IA: Validación de coherencia OK')
      }
    }

    return data
  }

  private detectDocumentType(fullText: string): 'BOLETA' | 'FACTURA' | 'TICKET' | 'UNKNOWN' {
    const textUpper = fullText.toUpperCase()
    if (textUpper.includes('BOLETA DE VENTA ELECTRONICA') || textUpper.includes('BOLETA ELECTRONICA')) {
      return 'BOLETA'
    }
    if (textUpper.includes('FACTURA ELECTRONICA') || textUpper.includes('FACTURA DE VENTA')) {
      return 'FACTURA'
    }
    if (textUpper.includes('TICKET') || textUpper.includes('VALE')) {
      return 'TICKET'
    }
    return 'UNKNOWN'
  }

  private parseDateAdvanced(dateStr: string, nextLines: string = ''): Date | undefined {
    try {
      const combined = dateStr + ' ' + nextLines

      // Buscar formatos peruanos comunes
      // 1. DD/MM/YYYY o DD/MM/YY
      const match1 = combined.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
      if (match1) {
        let day = parseInt(match1[1])
        let month = parseInt(match1[2])
        let year = parseInt(match1[3])

        // Si el año es de 2 dígitos, convertir a 4
        if (year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year
        }

        // Validar que sea una fecha válida
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2030) {
          const date = new Date(year, month - 1, day)
          if (!isNaN(date.getTime())) {
            return date
          }
        }
      }

      // 2. Formato escrito: "22 de octubre de 2025" o similar
      const match2 = combined.match(/(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:de\s+)?(\d{4})/)
      if (match2) {
        const meses: { [key: string]: number } = {
          'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
          'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
          'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
        }
        const day = parseInt(match2[1])
        const monthName = match2[2].toLowerCase()
        const year = parseInt(match2[3])

        if (meses[monthName] !== undefined) {
          const date = new Date(year, meses[monthName], day)
          if (!isNaN(date.getTime())) {
            return date
          }
        }
      }

      return undefined
    } catch {
      return undefined
    }
  }

  private parseDate(dateStr: string): Date | undefined {
    return this.parseDateAdvanced(dateStr, '')
  }

  private parseAmount(amountStr: string): number | undefined {
    try {
      // Remove currency symbols and spaces
      const cleaned = amountStr.replace(/[^\d,.-]/g, '').replace(/,/g, '')
      const amount = parseFloat(cleaned)
      return isNaN(amount) ? undefined : amount
    } catch {
      return undefined
    }
  }
}
