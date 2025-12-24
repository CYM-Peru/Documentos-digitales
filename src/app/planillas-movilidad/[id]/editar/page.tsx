'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'

interface MovilidadGasto {
  id?: number
  fechaGasto: string
  motivo: string
  origen: string
  destino: string
  montoViaje: number
}

export default function EditarPlanillaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const planillaId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [planilla, setPlanilla] = useState<any>(null)

  // Datos del formulario
  const [nroPlanilla, setNroPlanilla] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [ruc, setRuc] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [fechaEmision, setFechaEmision] = useState('')
  const [nombresApellidos, setNombresApellidos] = useState('')
  const [cargo, setCargo] = useState('')
  const [dni, setDni] = useState('')
  const [centroCosto, setCentroCosto] = useState('')
  const [gastos, setGastos] = useState<MovilidadGasto[]>([])

  const [camposConError, setCamposConError] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated' && planillaId) {
      cargarPlanilla()
    }
  }, [status, planillaId])

  const cargarPlanilla = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/planillas-movilidad/${planillaId}`)
      const data = await response.json()

      if (!data.success) {
        alert('Error al cargar la planilla')
        router.push('/')
        return
      }

      const p = data.planilla

      // Verificar permisos de edición
      // SUPER_ADMIN, VERIFICADOR, ORG_ADMIN, STAFF pueden editar cualquier planilla
      // El creador solo puede editar sus propias planillas rechazadas
      const adminRoles = ['SUPER_ADMIN', 'VERIFICADOR', 'ORG_ADMIN', 'STAFF']
      const isAdmin = adminRoles.includes(session?.user?.role || '')
      const isCreator = p.userId === session?.user?.id

      if (!isAdmin && !isCreator) {
        alert('No tienes permisos para editar esta planilla')
        router.push('/')
        return
      }

      // Los admins pueden editar planillas pendientes o rechazadas
      // Los usuarios normales solo pueden editar rechazadas
      const editableStates = isAdmin
        ? ['RECHAZADA', 'PENDIENTE_APROBACION']
        : ['RECHAZADA']

      if (!editableStates.includes(p.estadoAprobacion)) {
        const msg = isAdmin
          ? 'Solo puedes editar planillas pendientes o rechazadas'
          : 'Solo puedes editar planillas rechazadas'
        alert(msg)
        router.push('/')
        return
      }

      setPlanilla(p)
      setNroPlanilla(p.nroPlanilla || '')
      setRazonSocial(p.razonSocial || '')
      setRuc(p.ruc || '')
      setPeriodo(p.periodo || '')
      setFechaEmision(p.fechaEmision ? new Date(p.fechaEmision).toISOString().split('T')[0] : '')
      setNombresApellidos(p.nombresApellidos || '')
      setCargo(p.cargo || '')
      setDni(p.dni || '')
      setCentroCosto(p.centroCosto || '')

      // Cargar gastos
      if (p.gastos && p.gastos.length > 0) {
        setGastos(p.gastos.map((g: any) => ({
          id: g.id,
          fechaGasto: g.fechaGasto ? new Date(g.fechaGasto).toISOString().split('T')[0] : '',
          motivo: g.motivo || '',
          origen: g.origen || '',
          destino: g.destino || '',
          montoViaje: g.montoViaje || 0,
        })))
      }

      // Cargar campos con error
      if (p.camposConError && Array.isArray(p.camposConError)) {
        setCamposConError(p.camposConError)
      }

    } catch (error) {
      console.error('Error cargando planilla:', error)
      alert('Error al cargar la planilla')
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  const agregarGasto = () => {
    setGastos([...gastos, {
      fechaGasto: new Date().toISOString().split('T')[0],
      motivo: '',
      origen: '',
      destino: '',
      montoViaje: 0,
    }])
  }

  const eliminarGasto = (index: number) => {
    setGastos(gastos.filter((_, i) => i !== index))
  }

  const actualizarGasto = (index: number, campo: keyof MovilidadGasto, valor: any) => {
    const nuevosGastos = [...gastos]
    nuevosGastos[index] = { ...nuevosGastos[index], [campo]: valor }
    setGastos(nuevosGastos)
  }

  const handleGuardar = async () => {
    if (!nombresApellidos || !cargo || !dni) {
      alert('Por favor completa los campos obligatorios')
      return
    }

    if (gastos.length === 0) {
      alert('Debes agregar al menos un gasto')
      return
    }

    try {
      setSaving(true)

      const response = await fetch(`/api/planillas-movilidad/${planillaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nroPlanilla,
          razonSocial,
          ruc,
          periodo,
          fechaEmision,
          nombresApellidos,
          cargo,
          dni,
          centroCosto,
          gastos,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Planilla actualizada correctamente. Ahora está pendiente de aprobación nuevamente.')
        router.push('/')
      } else {
        alert(data.error || 'Error al actualizar la planilla')
      }
    } catch (error: any) {
      alert(error.message || 'Error al actualizar')
    } finally {
      setSaving(false)
    }
  }

  const tieneCampoError = (campo: string) => {
    return camposConError.includes(campo)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando planilla...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
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
            ✏️ Editar Planilla de Movilidad
          </h1>
          <p className="text-gray-600">
            Corrige los campos marcados con error y vuelve a enviar
          </p>
        </div>

        {/* Alerta de campos con error */}
        {camposConError.length > 0 && (
          <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-xl p-6">
            <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              Campos con errores detectados
            </h3>
            <p className="text-sm text-red-800 mb-2">El aprobador marcó los siguientes campos como incorrectos:</p>
            <div className="flex flex-wrap gap-2">
              {camposConError.map((campo) => (
                <span key={campo} className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-xs font-medium">
                  {campo.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {planilla?.comentariosAprobacion && (
          <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-xl p-4">
            <p className="font-semibold text-yellow-900">Comentarios del aprobador:</p>
            <p className="text-yellow-800 mt-1">{planilla.comentariosAprobacion}</p>
          </div>
        )}

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
          {/* Datos de la Planilla */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">📄 Datos de la Planilla</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  N° Planilla {tieneCampoError('nroPlanilla') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={nroPlanilla}
                  onChange={(e) => setNroPlanilla(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('nroPlanilla') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón Social {tieneCampoError('razonSocial') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('razonSocial') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RUC {tieneCampoError('ruc') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('ruc') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Periodo {tieneCampoError('periodo') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('periodo') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                  placeholder="Ej: 2024-11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Emisión {tieneCampoError('fechaEmision') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="date"
                  value={fechaEmision}
                  onChange={(e) => setFechaEmision(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('fechaEmision') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                />
              </div>
            </div>
          </div>

          {/* Datos del Trabajador */}
          <div>
            <h3 className="font-bold text-gray-900 mb-4">👤 Datos del Trabajador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombres y Apellidos * {tieneCampoError('nombresApellidos') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={nombresApellidos}
                  onChange={(e) => setNombresApellidos(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('nombresApellidos') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cargo * {tieneCampoError('cargo') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('cargo') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DNI * {tieneCampoError('dni') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('dni') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Centro de Costo {tieneCampoError('centroCosto') && <span className="text-red-600">⚠️</span>}
                </label>
                <input
                  type="text"
                  value={centroCosto}
                  onChange={(e) => setCentroCosto(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg ${tieneCampoError('centroCosto') ? 'border-red-500 bg-red-50 text-gray-900' : 'border-gray-300'}`}
                />
              </div>
            </div>
          </div>

          {/* Gastos */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">🚗 Gastos</h3>
              <button
                onClick={agregarGasto}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                + Agregar Gasto
              </button>
            </div>

            {gastos.map((gasto, index) => (
              <div key={index} className={`mb-4 p-4 border-2 rounded-lg ${tieneCampoError(`gasto_${index}`) ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800">
                    Gasto {index + 1} {tieneCampoError(`gasto_${index}`) && <span className="text-red-600">⚠️ Error</span>}
                  </h4>
                  <button
                    onClick={() => eliminarGasto(index)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Eliminar
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={gasto.fechaGasto}
                      onChange={(e) => actualizarGasto(index, 'fechaGasto', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Motivo</label>
                    <input
                      type="text"
                      value={gasto.motivo}
                      onChange={(e) => actualizarGasto(index, 'motivo', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                      placeholder="Ej: Traslado a reunión"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Origen</label>
                    <input
                      type="text"
                      value={gasto.origen}
                      onChange={(e) => actualizarGasto(index, 'origen', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                      placeholder="Ej: Oficina Central"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Destino</label>
                    <input
                      type="text"
                      value={gasto.destino}
                      onChange={(e) => actualizarGasto(index, 'destino', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                      placeholder="Ej: Sucursal Norte"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monto (S/)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={gasto.montoViaje}
                      onChange={(e) => actualizarGasto(index, 'montoViaje', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Botones */}
          <div className="flex gap-4 pt-6">
            <button
              onClick={() => router.push('/')}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : '💾 Guardar y Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
