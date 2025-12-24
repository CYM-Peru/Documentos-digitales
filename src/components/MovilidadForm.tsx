'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface MovilidadGasto {
  fechaGasto: string // Formato YYYY-MM-DD
  motivo?: string
  origen?: string
  destino?: string
  montoViaje?: number
}

interface Rendicion {
  CodUserAsg: string
  CodEstado: string
  NroRend: number
  CodLocal?: string
}

interface CajaChica {
  CodLocal: number
  NroRend: number
  CodUserAsg: string
  CodEstado: string
  DesEmpresa?: string
}

interface MovilidadFormProps {
  onCancel: () => void
  onSuccess: () => void
}

export default function MovilidadForm({
  onCancel,
  onSuccess,
}: MovilidadFormProps) {
  const { data: session } = useSession()
  const [mode, setMode] = useState<'select' | 'ocr' | 'manual'>('select')
  const [loading, setLoading] = useState(false)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null)

  // Datos de la planilla
  const [nroPlanilla, setNroPlanilla] = useState('')
  const [razonSocial, setRazonSocial] = useState('CALZADOS AZALEIA PERU S.A.')
  const [ruc, setRuc] = useState('90000000004')
  // Generar periodo actual: MES AÑO (ej: DICIEMBRE 2025)
  const getCurrentPeriodo = () => {
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                   'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
    const now = new Date()
    return `${meses[now.getMonth()]} ${now.getFullYear()}`
  }
  const [periodo, setPeriodo] = useState(getCurrentPeriodo())
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0])
  const [nombresApellidos, setNombresApellidos] = useState('')
  const [cargo, setCargo] = useState('')
  const [dni, setDni] = useState('')
  const [centroCosto, setCentroCosto] = useState('')

  // Solo para USER_L3: Selección de destino (rendición o caja chica)
  const isUserL3 = session?.user?.role === 'USER_L3'
  const [tipoOperacion, setTipoOperacion] = useState<'RENDICION' | 'CAJA_CHICA' | ''>('')
  const [nroRendicion, setNroRendicion] = useState('')
  const [rendiciones, setRendiciones] = useState<Rendicion[]>([])
  const [loadingRendiciones, setLoadingRendiciones] = useState(false)

  // Nota: La asignación a caja chica/rendición se hace después por el VERIFICADOR (excepto USER_L3)

  // Gastos
  const [gastos, setGastos] = useState<MovilidadGasto[]>([
    { fechaGasto: new Date().toISOString().split('T')[0], motivo: '', origen: '', destino: '', montoViaje: 0 }
  ])

  // Precarga datos del usuario (nombre, dni, cargo)
  useEffect(() => {
    const loadUserData = async () => {
      if (session?.user?.name) {
        setNombresApellidos(session.user.name)
      }
      // Cargar dni y cargo desde la API
      try {
        const response = await fetch('/api/users/me')
        const data = await response.json()
        if (data.success && data.user) {
          if (data.user.dni) setDni(data.user.dni)
          if (data.user.cargo) setCargo(data.user.cargo)
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      }
    }
    if (session) {
      loadUserData()
    }
  }, [session])

  // Cargar rendiciones cuando USER_L3 selecciona RENDICION
  useEffect(() => {
    if (isUserL3 && tipoOperacion === 'RENDICION') {
      const loadRendiciones = async () => {
        setLoadingRendiciones(true)
        try {
          const response = await fetch('/api/rendiciones')
          const data = await response.json()
          if (data.success || data.rendiciones) {
            setRendiciones(data.rendiciones || [])
          }
        } catch (error) {
          console.error('Error loading rendiciones:', error)
        } finally {
          setLoadingRendiciones(false)
        }
      }
      loadRendiciones()
    }
  }, [isUserL3, tipoOperacion])


  const agregarGasto = () => {
    setGastos([...gastos, { fechaGasto: new Date().toISOString().split('T')[0], motivo: '', origen: '', destino: '', montoViaje: 0 }])
  }

  const eliminarGasto = (index: number) => {
    if (gastos.length > 1) {
      setGastos(gastos.filter((_, i) => i !== index))
    }
  }

  const actualizarGasto = (index: number, campo: keyof MovilidadGasto, valor: any) => {
    const nuevosGastos = [...gastos]
    nuevosGastos[index] = { ...nuevosGastos[index], [campo]: valor }
    setGastos(nuevosGastos)
  }

  const calcularTotales = () => {
    const totalViaje = gastos.reduce((sum, g) => sum + (g.montoViaje || 0), 0)
    return { totalViaje, totalGeneral: totalViaje }
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setOcrError(null)

      // Mostrar preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Procesar con OCR automáticamente
      setOcrProcessing(true)
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/planillas-movilidad/ocr', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Error procesando imagen')
        }

        if (result.success && result.data) {
          // Poblar campos con datos extraídos
          const data = result.data

          if (data.nombresApellidos) setNombresApellidos(data.nombresApellidos)
          if (data.cargo) setCargo(data.cargo)
          if (data.dni) setDni(data.dni)
          if (data.centroCosto) setCentroCosto(data.centroCosto)
          if (data.periodo) setPeriodo(data.periodo)

          // Poblar gastos si hay
          if (data.gastos && data.gastos.length > 0) {
            setGastos(data.gastos.map((g: any) => ({
              fechaGasto: g.fechaGasto || new Date().toISOString().split('T')[0],
              motivo: g.motivo || '',
              origen: g.origen || '',
              destino: g.destino || '',
              montoViaje: g.montoViaje || 0,
            })))
          }

          // Guardar URL de imagen
          if (result.imageUrl) {
            setSavedImageUrl(result.imageUrl)
          }

          console.log('✅ OCR completado, datos poblados')
        }
      } catch (error: any) {
        console.error('OCR Error:', error)
        setOcrError(error.message || 'Error procesando la imagen')
      } finally {
        setOcrProcessing(false)
      }
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const totales = calcularTotales()

      // Preparar datos (el correlativo se asigna automáticamente en el backend)
      const planillaData: any = {
        id: `movilidad-${Date.now()}`,
        // nroPlanilla se genera automáticamente en el backend
        razonSocial,
        ruc,
        periodo,
        fechaEmision: new Date(fechaEmision),
        nombresApellidos,
        cargo,
        dni,
        centroCosto,
        totalViaje: totales.totalViaje,
        totalDia: 0, // Campo eliminado del formulario
        totalGeneral: totales.totalGeneral,
        estado: 'PENDIENTE',
        gastos: gastos.map(g => ({
          fechaGasto: new Date(g.fechaGasto),
          motivo: g.motivo,
          origen: g.origen,
          destino: g.destino,
          montoViaje: g.montoViaje || 0,
          montoDia: 0, // Campo eliminado del formulario
        })),
      }

      // La asignación a caja chica/rendición se hace después por el VERIFICADOR (excepto USER_L3)
      // USER_L3 puede asignar destino al crear la planilla
      if (isUserL3 && tipoOperacion) {
        planillaData.tipoOperacion = tipoOperacion
        if (tipoOperacion === 'RENDICION' && nroRendicion) {
          planillaData.nroRendicion = nroRendicion
        }
        // Si es CAJA_CHICA, no se asigna número, se envía con codLocal 1
      }

      // Si hay imagen procesada, usar la URL guardada del servidor
      if (savedImageUrl) {
        planillaData.imageUrl = savedImageUrl
      }

      // Guardar planilla
      const response = await fetch('/api/planillas-movilidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planillaData),
      })

      if (!response.ok) {
        throw new Error('Error al enviar la solicitud')
      }

      // Guardar dni y cargo del usuario para autocompletar en futuros formularios
      if (dni || cargo) {
        try {
          await fetch('/api/users/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, cargo }),
          })
        } catch (e) {
          console.error('Error guardando datos del usuario:', e)
        }
      }

      alert('✓ Solicitud enviada correctamente\n\nTu planilla está pendiente de aprobación por Amanda Arroyo.\nSerás notificado cuando sea aprobada.')
      onSuccess()
    } catch (error: any) {
      console.error('Error:', error)
      alert(error.message || 'Error al guardar la planilla')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'select') {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 my-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Planilla de Movilidad</h2>
          <p className="text-gray-600 mb-8">¿Cómo deseas ingresar la planilla?</p>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => setMode('ocr')}
              className="group bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl p-8 border-2 border-blue-300 hover:border-blue-500 transition-all"
            >
              <div className="text-blue-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Escanear Planilla</h3>
              <p className="text-sm text-gray-600">Toma foto de una planilla física</p>
            </button>

            <button
              onClick={() => setMode('manual')}
              className="group bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 rounded-xl p-8 border-2 border-amber-300 hover:border-amber-500 transition-all"
            >
              <div className="text-amber-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Llenar Manual</h3>
              <p className="text-sm text-gray-600">Ingresa los datos desde cero</p>
            </button>
          </div>

          <button
            onClick={onCancel}
            className="mt-8 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'ocr') {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 md:p-8 my-4 md:my-8 max-h-[90vh] overflow-y-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Escanear Planilla de Movilidad</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Captura o sube la imagen de la planilla
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              disabled={ocrProcessing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
          </div>

          {imagePreview && (
            <div className="mb-6 relative">
              <img src={imagePreview} alt="Preview" className="w-full rounded-xl border-2 border-gray-200" />
              {ocrProcessing && (
                <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                  <div className="bg-white rounded-xl p-6 text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-800 font-semibold">Procesando con IA...</p>
                    <p className="text-sm text-gray-500 mt-1">Extrayendo datos de la planilla</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {ocrError}
              </p>
              <p className="text-xs text-red-600 mt-1">Puedes continuar e ingresar los datos manualmente.</p>
            </div>
          )}

          {!ocrProcessing && imageFile && !ocrError && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-green-800">
                <strong>✓ Imagen procesada.</strong> Los datos han sido extraídos automáticamente.
              </p>
              <p className="text-xs text-green-600 mt-1">Revisa y corrige los datos en el siguiente paso si es necesario.</p>
            </div>
          )}

          {!imageFile && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Toma una foto clara de la planilla. La IA extraerá automáticamente los datos del trabajador y los gastos.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setMode('manual')}
              disabled={!imageFile || ocrProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {ocrProcessing ? 'Procesando...' : 'Continuar con datos'}
            </button>
            <button
              onClick={() => setMode('select')}
              disabled={ocrProcessing}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Modo manual
  const totales = calcularTotales()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-0 md:p-4 overflow-y-auto overflow-x-hidden">
      <div className="bg-white rounded-none md:rounded-2xl shadow-2xl w-full md:max-w-6xl h-full md:h-auto md:my-8 max-h-screen md:max-h-[95vh] overflow-y-auto overflow-x-hidden">
        <div className="w-full max-w-full p-4 md:p-8 overflow-x-hidden">
        <div className="flex justify-between items-center mb-4 md:mb-6">
          <h2 className="text-xl md:text-3xl font-bold text-gray-900">Planilla de Movilidad</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 md:space-y-8">
          {/* Cabecera */}
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">Información General</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° Planilla</label>
                <input
                  type="text"
                  value=""
                  disabled
                  className="w-full max-w-full px-3 md:px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 text-sm md:text-base cursor-not-allowed"
                  placeholder="Se asigna al guardar"
                />
                <p className="text-xs text-amber-600 mt-1">Correlativo automático</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social</label>
                <input
                  type="text"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RUC</label>
                <input
                  type="text"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
                <input
                  type="text"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                  placeholder="Noviembre 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Emisión</label>
                <input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Datos del Trabajador */}
          <div>
            <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">Datos del Trabajador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombres y Apellidos *</label>
                <input
                  type="text"
                  value={nombresApellidos}
                  onChange={(e) => setNombresApellidos(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DNI *</label>
                <input
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  required
                  maxLength={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centro de Costo</label>
                <input
                  type="text"
                  value={centroCosto}
                  onChange={(e) => setCentroCosto(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Selector de Destino - Solo para USER_L3 */}
          {isUserL3 && (
            <div className="bg-purple-50 rounded-xl p-4 md:p-6 border-2 border-purple-200">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4">
                Asignar a Rendición o Caja Chica
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Como Asesor L3, puedes asociar esta planilla directamente a una rendición o caja chica.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Destino</label>
                  <select
                    value={tipoOperacion}
                    onChange={(e) => {
                      setTipoOperacion(e.target.value as 'RENDICION' | 'CAJA_CHICA' | '')
                      setNroRendicion('') // Limpiar selección anterior
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <option value="">-- Sin asignar (pendiente) --</option>
                    <option value="RENDICION">Rendición de Cuentas</option>
                    <option value="CAJA_CHICA">Caja Chica</option>
                  </select>
                </div>

                {tipoOperacion === 'RENDICION' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Número de Rendición</label>
                    {loadingRendiciones ? (
                      <div className="flex items-center gap-2 text-gray-500 py-2">
                        <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                        <span className="text-sm">Cargando rendiciones...</span>
                      </div>
                    ) : rendiciones.length > 0 ? (
                      <select
                        value={nroRendicion}
                        onChange={(e) => setNroRendicion(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                      >
                        <option value="">-- Seleccionar Rendición --</option>
                        {rendiciones.map((r) => (
                          <option key={r.NroRend} value={r.NroRend}>
                            {r.NroRend} - {r.CodEstado === '00' ? 'Abierta' : 'Cerrada'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-amber-600 py-2">No tienes rendiciones asignadas</p>
                    )}
                  </div>
                )}

                {tipoOperacion === 'CAJA_CHICA' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Caja Chica</label>
                    <p className="text-sm text-purple-700 bg-purple-100 rounded-lg px-4 py-2">
                      Se asignará automáticamente con CodLocal 1 (Arica)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gastos */}
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 md:mb-4">
              <h3 className="text-lg md:text-xl font-bold text-gray-800">Gastos de Movilidad</h3>
              <button
                onClick={agregarGasto}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm md:text-base whitespace-nowrap"
              >
                + Agregar Gasto
              </button>
            </div>

            <div className="space-y-4">
              {gastos.map((gasto, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-700">Gasto #{index + 1}</span>
                    {gastos.length > 1 && (
                      <button
                        onClick={() => eliminarGasto(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                      <input
                        type="date"
                        value={gasto.fechaGasto}
                        onChange={(e) => actualizarGasto(index, 'fechaGasto', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Motivo</label>
                      <input
                        type="text"
                        value={gasto.motivo || ''}
                        onChange={(e) => actualizarGasto(index, 'motivo', e.target.value)}
                        className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                        placeholder="Ej: Monitoreo PC"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Origen</label>
                      <input
                        type="text"
                        value={gasto.origen || ''}
                        onChange={(e) => actualizarGasto(index, 'origen', e.target.value)}
                        className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                        placeholder="Ej: Paucarpata"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Destino</label>
                      <input
                        type="text"
                        value={gasto.destino || ''}
                        onChange={(e) => actualizarGasto(index, 'destino', e.target.value)}
                        className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                        placeholder="Ej: Sabandia"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Monto (S/)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={gasto.montoViaje || ''}
                        onChange={(e) => actualizarGasto(index, 'montoViaje', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="bg-amber-50 rounded-xl p-6 border-2 border-amber-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Total General</h3>
            <div className="text-center">
              <p className="text-5xl font-bold text-amber-700">S/ {totales.totalGeneral.toFixed(2)}</p>
              <p className="text-sm text-gray-600 mt-2">Total de gastos de movilidad</p>
            </div>
          </div>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={handleSubmit}
              disabled={loading || !nombresApellidos || !cargo || !dni}
              className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold py-3 sm:py-4 rounded-xl transition-colors text-base sm:text-lg"
            >
              {loading ? 'Enviando...' : '✓ Solicitar Aprobación'}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="sm:px-8 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-semibold py-3 sm:py-4 rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
