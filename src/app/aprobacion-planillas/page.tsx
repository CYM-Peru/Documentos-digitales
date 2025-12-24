'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import RechazoModal from '@/components/RechazoModal'

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
  const [showRechazoModal, setShowRechazoModal] = useState(false)
  const [comentarios, setComentarios] = useState('')
  const [processing, setProcessing] = useState(false)
  const [filter, setFilter] = useState<'PENDIENTE' | 'TODAS'>('PENDIENTE')

  // Estados para selección masiva
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkAction, setBulkAction] = useState<'APROBAR' | 'RECHAZAR' | 'DELETE' | null>(null)
  const [bulkComentarios, setBulkComentarios] = useState('')
  const [processingBulk, setProcessingBulk] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      // Solo APROBADOR y SUPER_ADMIN pueden acceder a esta vista
      const allowedRoles = ['APROBADOR', 'SUPER_ADMIN']
      if (!allowedRoles.includes(session?.user?.role || '')) {
        alert('No tienes permisos para acceder a esta página. Solo el rol APROBADOR puede aprobar planillas.')
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
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Error loading planillas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Funciones de selección
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    const pendientes = planillasFiltradas.filter(p => p.estadoAprobacion === 'PENDIENTE_APROBACION')
    if (selectedIds.size === pendientes.length && pendientes.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendientes.map(p => p.id)))
    }
  }

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return

    if (bulkAction === 'DELETE' && !confirm(`¿Estás seguro de eliminar ${selectedIds.size} planilla(s)?`)) {
      return
    }

    setProcessingBulk(true)

    try {
      const response = await fetch('/api/planillas-movilidad/bulk-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planillaIds: Array.from(selectedIds),
          action: bulkAction,
          comentarios: bulkComentarios || undefined,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        alert(result.message + (result.errors?.length > 0 ? `\n\nErrores:\n${result.errors.join('\n')}` : ''))
        setShowBulkActionModal(false)
        setBulkAction(null)
        setBulkComentarios('')
        setSelectedIds(new Set())
        await loadPlanillas()
      } else {
        alert(result.error || 'Error al realizar la acción')
      }
    } catch (error) {
      console.error('Error bulk action:', error)
      alert('Error al realizar la acción')
    } finally {
      setProcessingBulk(false)
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

  const handleRechazar = async (comentarios: string, camposConError: string[]) => {
    if (!selectedPlanilla) return

    try {
      setProcessing(true)
      const response = await fetch(`/api/planillas-movilidad/${selectedPlanilla.id}/aprobar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'RECHAZAR',
          comentarios,
          camposConError,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Planilla rechazada correctamente')
        setShowRechazoModal(false)
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

  const pendientesCount = planillas.filter(p => p.estadoAprobacion === 'PENDIENTE_APROBACION').length
  const canDelete = ['SUPER_ADMIN', 'STAFF'].includes(session?.user?.role || '')

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
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => setFilter('PENDIENTE')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'PENDIENTE'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Pendientes ({pendientesCount})
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
              Actualizar
            </button>
          </div>
        </div>

        {/* Barra de acciones masivas */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-600 rounded-2xl p-4 mb-4 shadow-lg flex items-center justify-between flex-wrap gap-4 animate-slideDown">
            <div className="flex items-center gap-3 text-white">
              <div className="bg-white/20 rounded-full p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold">{selectedIds.size} planilla{selectedIds.size > 1 ? 's' : ''} seleccionada{selectedIds.size > 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setBulkAction('APROBAR')
                  setShowBulkActionModal(true)
                }}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Aprobar
              </button>
              <button
                onClick={() => {
                  setBulkAction('RECHAZAR')
                  setShowBulkActionModal(true)
                }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Rechazar
              </button>
              {canDelete && (
                <button
                  onClick={() => {
                    setBulkAction('DELETE')
                    setShowBulkActionModal(true)
                  }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Vista de Tabla */}
        {planillasFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">
              {filter === 'PENDIENTE'
                ? 'No hay planillas pendientes de aprobación'
                : 'No hay planillas registradas'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  <tr>
                    <th className="px-3 py-3 text-left">
                      {filter === 'PENDIENTE' && pendientesCount > 0 && (
                        <input
                          type="checkbox"
                          checked={selectedIds.size === pendientesCount && pendientesCount > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 rounded border-2 border-white/50 text-blue-600 focus:ring-2 focus:ring-white/50 cursor-pointer"
                        />
                      )}
                    </th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Estado</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">N° Planilla</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Nombres y Apellidos</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Cargo</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">DNI</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Centro Costo</th>
                    <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Total General</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Creado por</th>
                    <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Fecha</th>
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap sticky right-0 bg-gradient-to-r from-blue-600 to-purple-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {planillasFiltradas.map((planilla, index) => {
                    const isPendiente = planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                    const isSelected = selectedIds.has(planilla.id)

                    return (
                      <>
                        <tr
                          key={planilla.id}
                          className={`border-b hover:bg-blue-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          } ${isSelected ? 'bg-blue-100' : ''}`}
                        >
                          <td className="px-3 py-3">
                            {isPendiente && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(planilla.id)}
                                className="w-4 h-4 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
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
                          </td>
                          <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                            {planilla.nroPlanilla || '-'}
                          </td>
                          <td className="px-3 py-3 text-gray-900 font-medium whitespace-nowrap">
                            {planilla.nombresApellidos}
                          </td>
                          <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                            {planilla.cargo}
                          </td>
                          <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                            {planilla.dni}
                          </td>
                          <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                            {planilla.centroCosto || '-'}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-900 font-bold text-blue-600 whitespace-nowrap">
                            {formatCurrency(planilla.totalGeneral)}
                          </td>
                          <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                            {planilla.user.name || planilla.user.email}
                          </td>
                          <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                            {formatDate(planilla.createdAt)}
                          </td>
                          <td className="px-3 py-3 sticky right-0 bg-white">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() =>
                                  setSelectedPlanilla(
                                    selectedPlanilla?.id === planilla.id ? null : planilla
                                  )
                                }
                                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium transition-colors"
                                title="Ver detalle"
                              >
                                {selectedPlanilla?.id === planilla.id ? '▲' : '▼'}
                              </button>
                              {isPendiente && (
                                <>
                                  <button
                                    onClick={() => handleAprobar(planilla.id)}
                                    disabled={processing}
                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                                    title="Aprobar"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedPlanilla(planilla)
                                      setShowRechazoModal(true)
                                    }}
                                    disabled={processing}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                                    title="Rechazar"
                                  >
                                    ✗
                                  </button>
                                </>
                              )}
                              {planilla.estadoAprobacion === 'APROBADA' && (
                                <button
                                  onClick={() =>
                                    window.open(`/planillas-movilidad/${planilla.id}/print`, '_blank')
                                  }
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors"
                                  title="Imprimir"
                                >
                                  🖨
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Fila expandible con detalle */}
                        {selectedPlanilla?.id === planilla.id && (
                          <tr key={`${planilla.id}-detail`}>
                            <td colSpan={11} className="px-6 py-4 bg-blue-50 border-b">
                              <div className="space-y-4">
                                <h4 className="font-semibold text-gray-900 text-base">
                                  Detalle de Gastos ({planilla.gastos.length})
                                </h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-gray-900 font-semibold">#</th>
                                        <th className="px-3 py-2 text-left text-gray-900 font-semibold">Fecha</th>
                                        <th className="px-3 py-2 text-left text-gray-900 font-semibold">Motivo</th>
                                        <th className="px-3 py-2 text-left text-gray-900 font-semibold">Origen</th>
                                        <th className="px-3 py-2 text-left text-gray-900 font-semibold">Destino</th>
                                        <th className="px-3 py-2 text-right text-gray-900 font-semibold">Monto Viaje</th>
                                        <th className="px-3 py-2 text-right text-gray-900 font-semibold">Monto Día</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {planilla.gastos.map((gasto, idx) => (
                                        <tr key={gasto.id} className="border-t border-gray-200">
                                          <td className="px-3 py-2 text-gray-700">{idx + 1}</td>
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
                                          <td className="px-3 py-2 text-right text-gray-900 font-medium">
                                            {formatCurrency(gasto.montoViaje)}
                                          </td>
                                          <td className="px-3 py-2 text-right text-gray-900 font-medium">
                                            {formatCurrency(gasto.montoDia)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-semibold">
                                      <tr>
                                        <td colSpan={5} className="px-3 py-2 text-right text-gray-900">
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
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Acción Masiva */}
      {showBulkActionModal && bulkAction && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBulkActionModal(false)
              setBulkAction(null)
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
            <div className={`p-6 rounded-t-3xl ${
              bulkAction === 'DELETE'
                ? 'bg-gradient-to-r from-red-600 to-rose-600'
                : bulkAction === 'RECHAZAR'
                ? 'bg-gradient-to-r from-orange-600 to-red-600'
                : 'bg-gradient-to-r from-green-600 to-emerald-600'
            } text-white`}>
              <h3 className="font-bold text-xl">
                {bulkAction === 'APROBAR' && 'Aprobar Planillas'}
                {bulkAction === 'RECHAZAR' && 'Rechazar Planillas'}
                {bulkAction === 'DELETE' && 'Eliminar Planillas'}
              </h3>
              <p className="text-white/80 text-sm mt-1">{selectedIds.size} planilla{selectedIds.size > 1 ? 's' : ''} seleccionada{selectedIds.size > 1 ? 's' : ''}</p>
            </div>
            <div className="p-6">
              {bulkAction === 'APROBAR' && (
                <div className="bg-green-50 p-4 rounded-xl mb-4">
                  <p className="text-green-800 font-medium">
                    Se aprobarán {selectedIds.size} planilla{selectedIds.size > 1 ? 's' : ''} y se enviarán al sistema contable.
                  </p>
                </div>
              )}

              {bulkAction === 'RECHAZAR' && (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Motivo del rechazo (opcional)</label>
                  <textarea
                    value={bulkComentarios}
                    onChange={(e) => setBulkComentarios(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 bg-white"
                    rows={3}
                    placeholder="Escriba el motivo del rechazo..."
                  />
                </div>
              )}

              {bulkAction === 'DELETE' && (
                <div className="bg-red-50 p-4 rounded-xl">
                  <p className="text-red-800 font-medium">
                    ¿Estás seguro de eliminar {selectedIds.size} planilla{selectedIds.size > 1 ? 's' : ''}?
                  </p>
                  <p className="text-red-600 text-sm mt-2">Esta acción no se puede deshacer.</p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkActionModal(false)
                    setBulkAction(null)
                    setBulkComentarios('')
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBulkAction}
                  disabled={processingBulk}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-semibold disabled:opacity-50 transition-all shadow-lg ${
                    bulkAction === 'DELETE'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                      : bulkAction === 'RECHAZAR'
                      ? 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700'
                      : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                  }`}
                >
                  {processingBulk ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rechazo Individual */}
      {showRechazoModal && selectedPlanilla && (
        <RechazoModal
          planilla={selectedPlanilla}
          onClose={() => {
            setShowRechazoModal(false)
            setSelectedPlanilla(null)
          }}
          onConfirm={handleRechazar}
          processing={processing}
        />
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
