'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Gasto {
  id: string
  fechaGasto: string
  motivo: string
  origen: string
  destino: string
  montoViaje: number
}

interface Planilla {
  id: string
  nroPlanilla: string | null
  razonSocial: string | null
  ruc: string | null
  periodo: string | null
  fechaEmision: string | null
  nombresApellidos: string
  cargo: string
  dni: string
  centroCosto: string | null
  totalViaje: number
  totalGeneral: number
  estadoAprobacion: string
  fechaAprobacion: string | null
  gastos: Gasto[]
  aprobadoPor: {
    name: string
    email: string
  } | null
}

export default function PrintPlanillaPage() {
  const params = useParams()
  const [planilla, setPlanilla] = useState<Planilla | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPlanilla = async () => {
      try {
        const response = await fetch(`/api/planillas-movilidad/${params.id}`)
        const data = await response.json()
        if (data.success) {
          setPlanilla(data.planilla)
          // ❌ NO auto-print - El usuario decide cuándo imprimir
        }
      } catch (error) {
        console.error('Error loading planilla:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlanilla()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando planilla...</p>
        </div>
      </div>
    )
  }

  if (!planilla) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 font-bold">Planilla no encontrada</p>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <>
      <style jsx global>{`
        /* Forzar estilos para evitar tema oscuro */
        body {
          background: white !important;
          color: #000000 !important;
        }
        * {
          color: inherit !important;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto bg-white p-8" style={{ backgroundColor: 'white', color: '#000000' }}>
        {/* Header */}
        <div className="mb-6 border-b-2 border-gray-800 pb-4">
          <div className="flex justify-between items-start">
            {/* Logo */}
            <div className="flex items-start gap-4">
              <img
                src="/logos/aza-logo___fd6b04ba7fbeb476c60b5e703bd653aa.svg"
                alt="Logo Azaleia"
                className="h-16 w-auto object-contain"
                style={{ maxHeight: '64px' }}
                onError={(e) => {
                  // Ocultar si no existe el logo
                  console.log('Error cargando logo')
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900" style={{ color: '#111827' }}>PLANILLA DE MOVILIDAD</h1>
                <p className="text-sm text-gray-600 mt-1" style={{ color: '#4B5563' }}>{planilla.razonSocial || 'AZALEIA PERÚ'}</p>
                <p className="text-sm text-gray-600" style={{ color: '#4B5563' }}>RUC: {planilla.ruc || 'N/A'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900" style={{ color: '#111827' }}>N° {planilla.nroPlanilla || 'S/N'}</p>
              <p className="text-sm text-gray-600" style={{ color: '#4B5563' }}>Período: {planilla.periodo || 'N/A'}</p>
              <p className="text-sm text-gray-600" style={{ color: '#4B5563' }}>Fecha: {formatDate(planilla.fechaEmision)}</p>
            </div>
          </div>
        </div>

        {/* Datos del Trabajador */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-3">DATOS DEL TRABAJADOR</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 font-semibold">Nombres y Apellidos:</p>
              <p className="text-sm text-gray-900 font-bold">{planilla.nombresApellidos}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">DNI:</p>
              <p className="text-sm text-gray-900">{planilla.dni}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Cargo:</p>
              <p className="text-sm text-gray-900">{planilla.cargo}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Centro de Costo:</p>
              <p className="text-sm text-gray-900">{planilla.centroCosto || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Tabla de Gastos */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">DETALLE DE GASTOS DE MOVILIDAD</h2>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">N°</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">FECHA</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">MOTIVO</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">ORIGEN</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-bold">DESTINO</th>
                <th className="border border-gray-300 px-3 py-2 text-right text-xs font-bold">MONTO (S/)</th>
              </tr>
            </thead>
            <tbody>
              {planilla.gastos.map((gasto, idx) => (
                <tr key={gasto.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-3 py-2 text-xs text-center">{idx + 1}</td>
                  <td className="border border-gray-300 px-3 py-2 text-xs">{formatDate(gasto.fechaGasto)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-xs">{gasto.motivo || '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-xs">{gasto.origen || '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-xs">{gasto.destino || '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-xs text-right font-semibold">
                    {gasto.montoViaje.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-800 text-white font-bold">
                <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right text-sm">
                  TOTAL:
                </td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                  S/ {planilla.totalGeneral.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Aprobación */}
        {planilla.estadoAprobacion === 'APROBADA' && (
          <div className="mb-6 bg-green-50 p-4 rounded-lg border-2 border-green-500">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="text-lg font-bold text-green-900">PLANILLA APROBADA</h3>
            </div>
            <p className="text-sm text-green-800">
              <span className="font-semibold">Aprobado por:</span> {planilla.aprobadoPor?.name || 'N/A'}
            </p>
            <p className="text-sm text-green-800">
              <span className="font-semibold">Fecha de aprobación:</span> {formatDate(planilla.fechaAprobacion)}
            </p>
          </div>
        )}

        {/* Firmas */}
        <div className="mt-12 grid grid-cols-2 gap-8">
          <div>
            <div className="border-t-2 border-gray-800 pt-2">
              <p className="text-sm font-bold text-gray-900 text-center">{planilla.nombresApellidos}</p>
              <p className="text-xs text-gray-600 text-center">Firma del Trabajador</p>
            </div>
          </div>
          <div>
            <div className="border-t-2 border-gray-800 pt-2">
              <p className="text-sm font-bold text-gray-900 text-center">{planilla.aprobadoPor?.name || ''}</p>
              <p className="text-xs text-gray-600 text-center">Firma del Aprobador</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500 border-t border-gray-300 pt-4">
          <p>Documento generado electrónicamente - {new Date().toLocaleString('es-PE')}</p>
        </div>

        {/* Print Button (only visible on screen) */}
        <div className="no-print mt-8 flex justify-center gap-4">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={() => window.close()}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors shadow-lg"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>
    </>
  )
}
