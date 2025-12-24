'use client'

import { useState, useEffect } from 'react'

interface MovilidadGasto {
  id: string | number
  fecha?: Date | string | null
  fechaGasto?: Date | string | null
  horaSalida?: string | null
  horaLlegada?: string | null
  nroDestino?: string | null
  destino?: string | null
  montoViaje: number
  montoDia: number
}

interface Planilla {
  id: string
  nroPlanilla?: string | null
  razonSocial?: string | null
  ruc?: string | null
  periodo?: string | null
  fechaEmision?: Date | string | null
  nombresApellidos: string
  cargo: string
  dni: string
  centroCosto?: string | null
  totalViaje: number
  totalDia: number
  totalGeneral: number
  gastos: MovilidadGasto[]
}

interface RechazoModalProps {
  planilla: Planilla
  onClose: () => void
  onConfirm: (comentarios: string, camposConError: string[]) => void
  processing: boolean
}

export default function RechazoModal({ planilla, onClose, onConfirm, processing }: RechazoModalProps) {
  const [comentarios, setComentarios] = useState('')
  const [camposSeleccionados, setCamposSeleccionados] = useState<string[]>([])

  const toggleCampo = (campo: string) => {
    if (camposSeleccionados.includes(campo)) {
      setCamposSeleccionados(camposSeleccionados.filter(c => c !== campo))
    } else {
      setCamposSeleccionados([...camposSeleccionados, campo])
    }
  }

  const handleSubmit = () => {
    if (!comentarios.trim()) {
      alert('Por favor ingrese un comentario explicando el motivo del rechazo')
      return
    }
    onConfirm(comentarios, camposSeleccionados)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-2xl">
          <h2 className="text-2xl font-bold">Rechazar Planilla</h2>
          <p className="text-red-100 mt-1">{planilla.nombresApellidos}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instrucciones */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-900 text-sm">
              Marque los campos que tienen errores para que el usuario sepa exactamente qué corregir.
            </p>
          </div>

          {/* Datos de la Planilla */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">📄</span> DATOS DE LA PLANILLA
            </h3>
            <div className="space-y-2 ml-6">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('razonSocial')}
                  onChange={() => toggleCampo('razonSocial')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Razón Social: <span className="font-medium">{planilla.razonSocial || 'N/A'}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('ruc')}
                  onChange={() => toggleCampo('ruc')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">RUC: <span className="font-medium">{planilla.ruc || 'N/A'}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('periodo')}
                  onChange={() => toggleCampo('periodo')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Periodo: <span className="font-medium">{planilla.periodo || 'N/A'}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('fechaEmision')}
                  onChange={() => toggleCampo('fechaEmision')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Fecha Emisión: <span className="font-medium">
                  {planilla.fechaEmision ? new Date(planilla.fechaEmision).toLocaleDateString('es-PE') : 'N/A'}
                </span></span>
              </label>
            </div>
          </div>

          {/* Datos del Trabajador */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">👤</span> DATOS DEL TRABAJADOR
            </h3>
            <div className="space-y-2 ml-6">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('nombresApellidos')}
                  onChange={() => toggleCampo('nombresApellidos')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Nombres y Apellidos: <span className="font-medium">{planilla.nombresApellidos}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('cargo')}
                  onChange={() => toggleCampo('cargo')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Cargo: <span className="font-medium">{planilla.cargo}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('dni')}
                  onChange={() => toggleCampo('dni')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">DNI: <span className="font-medium">{planilla.dni}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('centroCosto')}
                  onChange={() => toggleCampo('centroCosto')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Centro Costo: <span className="font-medium">{planilla.centroCosto || 'N/A'}</span></span>
              </label>
            </div>
          </div>

          {/* Gastos */}
          {planilla.gastos && planilla.gastos.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="text-lg">🚗</span> GASTOS
              </h3>
              <div className="space-y-2 ml-6">
                {planilla.gastos.map((gasto, index) => (
                  <label key={gasto.id} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={camposSeleccionados.includes(`gasto_${index}`)}
                      onChange={() => toggleCampo(`gasto_${index}`)}
                      className="w-4 h-4 text-red-600 mt-0.5"
                    />
                    <span className="text-sm text-gray-900">
                      <span className="font-medium">Gasto {index + 1}:</span> {(gasto.fecha || gasto.fechaGasto) ? new Date(gasto.fecha || gasto.fechaGasto!).toLocaleDateString('es-PE') : 'N/A'} - {gasto.horaSalida || 'N/A'} a {gasto.horaLlegada || 'N/A'} - {gasto.destino || 'N/A'} - S/ {gasto.montoViaje.toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Totales */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">💰</span> TOTALES
            </h3>
            <div className="space-y-2 ml-6">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('totalViaje')}
                  onChange={() => toggleCampo('totalViaje')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Total Viaje: <span className="font-medium">S/ {planilla.totalViaje.toFixed(2)}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('totalDia')}
                  onChange={() => toggleCampo('totalDia')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Total Día: <span className="font-medium">S/ {planilla.totalDia.toFixed(2)}</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={camposSeleccionados.includes('totalGeneral')}
                  onChange={() => toggleCampo('totalGeneral')}
                  className="w-4 h-4 text-red-600"
                />
                <span className="text-sm text-gray-900">Total General: <span className="font-medium">S/ {planilla.totalGeneral.toFixed(2)}</span></span>
              </label>
            </div>
          </div>

          {/* Comentarios */}
          <div>
            <label className="block font-bold text-gray-900 mb-2">
              📝 Comentario (requerido):
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Explique el motivo del rechazo..."
            />
          </div>

          {/* Resumen */}
          {camposSeleccionados.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="font-semibold text-red-900 mb-2">Campos marcados con error ({camposSeleccionados.length}):</p>
              <div className="flex flex-wrap gap-2">
                {camposSeleccionados.map((campo) => (
                  <span key={campo} className="bg-red-200 text-red-900 px-3 py-1 rounded-full text-xs font-medium">
                    {campo.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-3 justify-end border-t">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={processing || !comentarios.trim()}
            className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Rechazando...' : 'Rechazar Planilla'}
          </button>
        </div>
      </div>
    </div>
  )
}
