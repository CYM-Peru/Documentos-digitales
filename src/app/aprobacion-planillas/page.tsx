'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface MovilidadGasto {
  id: number
  dia?: number | null
  mes?: number | null
  anio?: number | null
  fechaGasto?: string | null
  motivo?: string | null
  origen?: string | null
  destino?: string | null
  montoViaje: number
  montoDia: number
}

interface MovilidadPlanilla {
  id: string
  nroPlanilla?: string | null
  razonSocial?: string | null
  ruc?: string | null
  periodo?: string | null
  fechaEmision?: string | null
  nombresApellidos: string
  cargo: string
  dni: string
  centroCosto?: string | null
  totalViaje: number
  totalDia: number
  totalGeneral: number
  tipoOperacion?: string | null
  nroRendicion?: string | null
  nroCajaChica?: string | null
  estadoAprobacion: string
  createdAt: string
  user: {
    name?: string | null
    email?: string | null
  }
  gastos: MovilidadGasto[]
}

export default function AprobacionPlanillasPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [planillas, setPlanillas] = useState<MovilidadPlanilla[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlanilla, setSelectedPlanilla] = useState<MovilidadPlanilla | null>(null)
  const [comentarios, setComentarios] = useState('')
  const [processing, setProcessing] = useState(false)
  const [filter, setFilter] = useState<'PENDIENTE' | 'TODAS'>('PENDIENTE')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      // Verificar rol APROBADOR
      if (session?.user?.role !== 'APROBADOR') {
        alert('No tiene permisos para acceder a esta página')
        router.push('/')
        return
      }
      loadPlanillas()
    }
  }, [status, session, router])

  const loadPlanillas = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/planillas-movilidad/pendientes')
      const data = await response.json()

      if (data.success) {
        setPlanillas(data.planillas || [])
      }
    } catch (error) {
      console.error('Error loading planillas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAprobar = async (planillaId: string) => {
    if (!confirm('¿Está seguro de aprobar esta planilla?')) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/planillas-movilidad/${planillaId}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'APROBAR',
          comentarios: comentarios || null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Planilla aprobada correctamente')
        setComentarios('')
        setSelectedPlanilla(null)
        loadPlanillas()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error aprobando planilla:', error)
      alert('Error al aprobar planilla')
    } finally {
      setProcessing(false)
    }
  }

  const handleRechazar = async (planillaId: string) => {
    if (!comentarios.trim()) {
      alert('Por favor ingrese un comentario explicando el motivo del rechazo')
      return
    }

    if (!confirm('¿Está seguro de rechazar esta planilla?')) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/planillas-movilidad/${planillaId}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'RECHAZAR',
          comentarios,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Planilla rechazada correctamente')
        setComentarios('')
        setSelectedPlanilla(null)
        loadPlanillas()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Error rechazando planilla:', error)
      alert('Error al rechazar planilla')
    } finally {
      setProcessing(false)
    }
  }

  const formatDate = (date?: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('es-PE')
  }

  const formatCurrency = (amount: number) => {
    return `S/ ${amount.toFixed(2)}`
  }

  const planillasFiltradas =
    filter === 'PENDIENTE'
      ? planillas.filter((p) => p.estadoAprobacion === 'PENDIENTE_APROBACION')
      : planillas

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors shadow-sm border border-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Regresar
          </button>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Aprobación de Planillas de Movilidad
          </h1>
          <p className="text-gray-600">
            Aprobador: {session?.user?.name || session?.user?.email}
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setFilter('PENDIENTE')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'PENDIENTE'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Pendientes (
              {planillas.filter((p) => p.estadoAprobacion === 'PENDIENTE_APROBACION').length})
            </button>
            <button
              onClick={() => setFilter('TODAS')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'TODAS'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Todas ({planillas.length})
            </button>
            <button
              onClick={loadPlanillas}
              className="ml-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Lista de Planillas */}
        {planillasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">
              {filter === 'PENDIENTE'
                ? 'No hay planillas pendientes de aprobación'
                : 'No hay planillas registradas'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {planillasFiltradas.map((planilla) => (
              <div
                key={planilla.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-2 border-transparent hover:border-blue-200"
              >
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {planilla.nombresApellidos}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                              ? 'bg-yellow-100 text-yellow-800'
                              : planilla.estadoAprobacion === 'APROBADA'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                            ? 'PENDIENTE'
                            : planilla.estadoAprobacion}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Cargo:</span> {planilla.cargo}
                        </div>
                        <div>
                          <span className="font-medium">DNI:</span> {planilla.dni}
                        </div>
                        <div>
                          <span className="font-medium">Creado por:</span>{' '}
                          {planilla.user.name || planilla.user.email}
                        </div>
                        <div>
                          <span className="font-medium">Fecha:</span>{' '}
                          {formatDate(planilla.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(planilla.totalGeneral)}
                      </div>
                      <div className="text-xs text-gray-500">Total General</div>
                    </div>
                  </div>

                  {/* Detalle de gastos */}
                  {selectedPlanilla?.id === planilla.id && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="font-semibold text-gray-900 mb-3">
                        Detalle de Gastos ({planilla.gastos.length})
                      </h4>

                      {/* Vista de tabla para desktop */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Fecha</th>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Motivo</th>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Origen</th>
                              <th className="px-3 py-2 text-left text-gray-900 font-semibold">Destino</th>
                              <th className="px-3 py-2 text-right text-gray-900 font-semibold">Viaje</th>
                              <th className="px-3 py-2 text-right text-gray-900 font-semibold">Día</th>
                            </tr>
                          </thead>
                          <tbody>
                            {planilla.gastos.map((gasto) => (
                              <tr key={gasto.id} className="border-t">
                                <td className="px-3 py-2 text-gray-900">
                                  {gasto.fechaGasto
                                    ? formatDate(gasto.fechaGasto)
                                    : gasto.dia && gasto.mes && gasto.anio
                                    ? `${gasto.dia}/${gasto.mes}/${gasto.anio}`
                                    : 'N/A'}
                                </td>
                                <td className="px-3 py-2 text-gray-900">{gasto.motivo || '-'}</td>
                                <td className="px-3 py-2 text-gray-900">{gasto.origen || '-'}</td>
                                <td className="px-3 py-2 text-gray-900">{gasto.destino || '-'}</td>
                                <td className="px-3 py-2 text-right text-gray-900">
                                  {formatCurrency(gasto.montoViaje)}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-900">
                                  {formatCurrency(gasto.montoDia)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 font-semibold">
                            <tr>
                              <td colSpan={4} className="px-3 py-2 text-right text-gray-900">
                                Totales:
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                {formatCurrency(planilla.totalViaje)}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-900">
                                {formatCurrency(planilla.totalDia)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Vista de tarjetas para móviles */}
                      <div className="md:hidden space-y-3">
                        {planilla.gastos.map((gasto, index) => (
                          <div key={gasto.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                Gasto #{index + 1}
                              </span>
                              <span className="text-xs text-gray-500">
                                {gasto.fechaGasto
                                  ? formatDate(gasto.fechaGasto)
                                  : gasto.dia && gasto.mes && gasto.anio
                                  ? `${gasto.dia}/${gasto.mes}/${gasto.anio}`
                                  : 'N/A'}
                              </span>
                            </div>

                            <div className="space-y-2 text-sm">
                              {gasto.motivo && (
                                <div>
                                  <span className="font-semibold text-gray-700">Motivo:</span>
                                  <p className="text-gray-900 mt-0.5">{gasto.motivo}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="font-semibold text-gray-700">Origen:</span>
                                  <p className="text-gray-900">{gasto.origen || '-'}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-700">Destino:</span>
                                  <p className="text-gray-900">{gasto.destino || '-'}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-300">
                                <div>
                                  <span className="font-semibold text-gray-700">Monto Viaje:</span>
                                  <p className="text-gray-900 font-bold">{formatCurrency(gasto.montoViaje)}</p>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-700">Monto Día:</span>
                                  <p className="text-gray-900 font-bold">{formatCurrency(gasto.montoDia)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Totales para móviles */}
                        <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-sm font-semibold text-gray-700">Total Viaje:</span>
                              <p className="text-lg font-bold text-blue-600">{formatCurrency(planilla.totalViaje)}</p>
                            </div>
                            <div>
                              <span className="text-sm font-semibold text-gray-700">Total Día:</span>
                              <p className="text-lg font-bold text-blue-600">{formatCurrency(planilla.totalDia)}</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-blue-300">
                            <span className="text-sm font-semibold text-gray-700">Total General:</span>
                            <p className="text-2xl font-bold text-blue-700">{formatCurrency(planilla.totalGeneral)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Comentarios y acciones */}
                      {planilla.estadoAprobacion === 'PENDIENTE_APROBACION' && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Comentarios (opcional para aprobar, requerido para rechazar)
                            </label>
                            <textarea
                              value={comentarios}
                              onChange={(e) => setComentarios(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                              rows={3}
                              placeholder="Ingrese comentarios..."
                              disabled={processing}
                            />
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleAprobar(planilla.id)}
                              disabled={processing}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processing ? 'Procesando...' : '✓ Aprobar'}
                            </button>
                            <button
                              onClick={() => handleRechazar(planilla.id)}
                              disabled={processing}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processing ? 'Procesando...' : '✗ Rechazar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Botón de Imprimir - Solo para planillas aprobadas */}
                      {planilla.estadoAprobacion === 'APROBADA' && (
                        <div className="mt-4">
                          <button
                            onClick={() => window.open(`/planillas-movilidad/${planilla.id}/print`, '_blank')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            🖨️ Imprimir Planilla
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botón Ver/Ocultar */}
                  <button
                    onClick={() =>
                      setSelectedPlanilla(
                        selectedPlanilla?.id === planilla.id ? null : planilla
                      )
                    }
                    className="mt-4 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors"
                  >
                    {selectedPlanilla?.id === planilla.id ? '▲ Ocultar detalle' : '▼ Ver detalle'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
