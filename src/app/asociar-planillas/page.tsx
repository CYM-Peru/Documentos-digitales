'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface CajaChica {
  CodLocal: string
  NroRend: number
  CodUserAsg: string
  CodEstado: string
  DesEmpresa?: string
}

interface Planilla {
  id: string
  nroPlanilla: string
  nombresApellidos: string
  totalGeneral: number
  estadoAprobacion: string
  createdAt: string
  nroCajaChica?: string
  user: {
    name: string
    email: string
    sede?: {
      codLocal: string
      nombre: string
    }
  }
}

export default function AsociarPlanillasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [cajasChicas, setCajasChicas] = useState<CajaChica[]>([])
  const [planillasAprobadas, setPlanillasAprobadas] = useState<Planilla[]>([])
  const [selectedCajaChica, setSelectedCajaChica] = useState<string>('')
  const [selectedPlanillas, setSelectedPlanillas] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCajas, setLoadingCajas] = useState(false)
  const [asociando, setAsociando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userCodLocal, setUserCodLocal] = useState<string | null>(null)

  // Verificar acceso
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      const canAccess = ['VERIFICADOR', 'SUPER_ADMIN'].includes(session?.user?.role || '')
      if (!canAccess) {
        router.push('/select-operation')
      }
    }
  }, [status, session, router])

  // Cargar CodLocal del usuario
  useEffect(() => {
    const fetchUserCodLocal = async () => {
      if (status !== 'authenticated') return

      try {
        const response = await fetch('/api/users/me')
        const data = await response.json()
        if (data.success && data.user?.sede?.codLocal) {
          setUserCodLocal(data.user.sede.codLocal)
        } else if (session?.user?.role === 'SUPER_ADMIN') {
          // Super admin puede ver todas
          setUserCodLocal(null)
        }
      } catch (error) {
        console.error('Error obteniendo CodLocal:', error)
      }
    }
    fetchUserCodLocal()
  }, [status, session])

  // Cargar cajas chicas disponibles
  useEffect(() => {
    const fetchCajasChicas = async () => {
      try {
        setLoadingCajas(true)
        const response = await fetch('/api/cajas-chicas')
        const data = await response.json()
        if (data.success) {
          let cajas = data.cajasChicas || []
          console.log('📦 Cajas chicas recibidas:', cajas.length, cajas.map((c: CajaChica) => ({ CodLocal: c.CodLocal, NroRend: c.NroRend })))
          console.log('🏢 userCodLocal:', userCodLocal, typeof userCodLocal)
          // Filtrar por CodLocal del usuario si no es SUPER_ADMIN
          if (userCodLocal && session?.user?.role !== 'SUPER_ADMIN') {
            // Convertir ambos a string para comparación segura
            cajas = cajas.filter((c: CajaChica) => String(c.CodLocal) === String(userCodLocal))
            console.log('📦 Cajas después de filtrar por CodLocal:', cajas.length)
          }
          setCajasChicas(cajas)
        }
      } catch (error) {
        console.error('Error cargando cajas chicas:', error)
      } finally {
        setLoadingCajas(false)
      }
    }

    if (status === 'authenticated') {
      fetchCajasChicas()
    }
  }, [status, userCodLocal, session])

  // Cargar planillas aprobadas sin asociar
  useEffect(() => {
    const fetchPlanillas = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/planillas-movilidad/aprobadas-sin-asociar')
        const data = await response.json()
        if (data.success) {
          let planillas = data.planillas || []
          // Filtrar por CodLocal del usuario si no es SUPER_ADMIN
          if (userCodLocal && session?.user?.role !== 'SUPER_ADMIN') {
            // Convertir ambos a string para comparación segura
            planillas = planillas.filter((p: Planilla) => String(p.user?.sede?.codLocal) === String(userCodLocal))
          }
          setPlanillasAprobadas(planillas)
        }
      } catch (error) {
        console.error('Error cargando planillas:', error)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      fetchPlanillas()
    }
  }, [status, userCodLocal, session])

  const handleSelectPlanilla = (id: string) => {
    setSelectedPlanillas(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedPlanillas.length === planillasAprobadas.length) {
      setSelectedPlanillas([])
    } else {
      setSelectedPlanillas(planillasAprobadas.map(p => p.id))
    }
  }

  const handleAsociar = async () => {
    if (!selectedCajaChica || selectedPlanillas.length === 0) {
      setError('Debes seleccionar una caja chica y al menos una planilla')
      return
    }

    try {
      setAsociando(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/planillas-movilidad/asociar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planillaIds: selectedPlanillas,
          nroCajaChica: selectedCajaChica,
          codLocal: cajasChicas.find(c => c.NroRend.toString() === selectedCajaChica)?.CodLocal
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`${data.asociadas} planilla(s) asociada(s) correctamente a Caja Chica #${selectedCajaChica}`)
        setSelectedPlanillas([])
        setSelectedCajaChica('')
        // Recargar planillas
        const newResponse = await fetch('/api/planillas-movilidad/aprobadas-sin-asociar')
        const newData = await newResponse.json()
        if (newData.success) {
          let planillas = newData.planillas || []
          if (userCodLocal && session?.user?.role !== 'SUPER_ADMIN') {
            planillas = planillas.filter((p: Planilla) => String(p.user?.sede?.codLocal) === String(userCodLocal))
          }
          setPlanillasAprobadas(planillas)
        }
      } else {
        setError(data.error || 'Error al asociar planillas')
      }
    } catch (error: any) {
      setError(error.message || 'Error al asociar planillas')
    } finally {
      setAsociando(false)
    }
  }

  const totalSeleccionado = selectedPlanillas.reduce((sum, id) => {
    const planilla = planillasAprobadas.find(p => p.id === id)
    return sum + (planilla?.totalGeneral || 0)
  }, 0)

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Asociar Planillas a Caja Chica</h1>
            <p className="text-gray-600 mt-1">
              Selecciona las planillas aprobadas y vincúlalas a una caja chica
              {userCodLocal && <span className="ml-2 text-purple-600 font-medium">(CodLocal: {userCodLocal})</span>}
            </p>
          </div>
          <button
            onClick={() => router.push('/select-operation')}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all shadow-md border border-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver
          </button>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
            {success}
          </div>
        )}

        {/* Selector de Caja Chica */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">1. Selecciona la Caja Chica</h2>
          {loadingCajas ? (
            <div className="flex items-center gap-2 text-gray-600">
              <div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full"></div>
              <span>Cargando cajas chicas...</span>
            </div>
          ) : cajasChicas.length > 0 ? (
            <select
              value={selectedCajaChica}
              onChange={(e) => setSelectedCajaChica(e.target.value)}
              className="w-full md:w-auto min-w-[300px] px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
            >
              <option value="">-- Seleccionar Caja Chica --</option>
              {cajasChicas.map((caja) => (
                <option key={`${caja.CodLocal}-${caja.NroRend}`} value={caja.NroRend.toString()}>
                  {caja.CodLocal} - {caja.NroRend} - {caja.DesEmpresa || 'Sin empresa'}
                </option>
              ))}
            </select>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">No hay cajas chicas disponibles para tu sede.</p>
            </div>
          )}
        </div>

        {/* Lista de Planillas Aprobadas */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">2. Selecciona las Planillas Aprobadas</h2>
            {planillasAprobadas.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-purple-600 hover:text-purple-700 font-medium text-sm"
              >
                {selectedPlanillas.length === planillasAprobadas.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            )}
          </div>

          {planillasAprobadas.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-lg">No hay planillas aprobadas sin asociar</p>
              <p className="text-gray-400 text-sm mt-1">Las planillas aparecerán aquí cuando Amanda las apruebe</p>
            </div>
          ) : (
            <div className="space-y-3">
              {planillasAprobadas.map((planilla) => (
                <div
                  key={planilla.id}
                  onClick={() => handleSelectPlanilla(planilla.id)}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    selectedPlanillas.includes(planilla.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedPlanillas.includes(planilla.id)
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedPlanillas.includes(planilla.id) && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{planilla.nroPlanilla}</p>
                        <p className="text-sm text-gray-600">{planilla.nombresApellidos}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(planilla.createdAt).toLocaleDateString('es-PE')}
                          {planilla.user?.sede?.nombre && (
                            <span className="ml-2 text-purple-600">({planilla.user.sede.nombre})</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">S/. {planilla.totalGeneral.toFixed(2)}</p>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Aprobada</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con totales y botón */}
        {planillasAprobadas.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {selectedPlanillas.length} planilla(s) seleccionada(s)
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  Total: S/. {totalSeleccionado.toFixed(2)}
                </p>
              </div>
              <button
                onClick={handleAsociar}
                disabled={!selectedCajaChica || selectedPlanillas.length === 0 || asociando}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {asociando ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Asociando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Asociar a Caja Chica
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Spacer para el footer fijo */}
        {planillasAprobadas.length > 0 && <div className="h-24"></div>}
      </div>
    </div>
  )
}
