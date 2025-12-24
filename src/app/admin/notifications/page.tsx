'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function NotificationsSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notificationTime, setNotificationTime] = useState('09:00')
  const [enabled, setEnabled] = useState(true)
  const [lastSentAt, setLastSentAt] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'SUPER_ADMIN' && session?.user?.role !== 'ADMIN') {
        router.push('/')
        return
      }
      loadSettings()
    }
  }, [status, session, router])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings/notifications')
      const data = await response.json()

      if (data.success) {
        setNotificationTime(data.settings.notificationTime)
        setEnabled(data.settings.enabled)
        setLastSentAt(data.settings.lastSentAt)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationTime,
          enabled
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Configuración guardada exitosamente' })
        loadSettings()
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="mb-4 flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-colors shadow-sm border border-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Regresar
          </button>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            ⚙️ Configuración de Notificaciones
          </h1>
          <p className="text-gray-600">
            Configura el horario y preferencias de notificaciones automáticas
          </p>
        </div>

        {/* Mensaje */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Configuración */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
          {/* Estado */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div>
              <h3 className="font-semibold text-gray-900">Estado de Notificaciones</h3>
              <p className="text-sm text-gray-600">Activar o desactivar el envío automático</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                enabled ? 'bg-green-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Hora de envío */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              ⏰ Hora de Envío del Resumen Diario
            </label>
            <input
              type="time"
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-lg"
            />
            <p className="mt-2 text-sm text-gray-600">
              El sistema enviará un resumen diario a todos los aprobadores a esta hora
            </p>
          </div>

          {/* Última vez enviado */}
          {lastSentAt && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm font-semibold text-blue-900">Último envío:</p>
              <p className="text-sm text-blue-700">
                {new Date(lastSentAt).toLocaleString('es-PE', {
                  dateStyle: 'full',
                  timeStyle: 'short'
                })}
              </p>
            </div>
          )}

          {/* Información */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <h4 className="font-semibold text-amber-900 mb-2">ℹ️ Información</h4>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• El resumen se envía una vez al día a la hora configurada</li>
              <li>• Solo se envía si hay planillas pendientes de aprobación</li>
              <li>• Se envía a todos los usuarios con rol APROBADOR o SUPER_ADMIN</li>
              <li>• Los usuarios deben tener un número de teléfono configurado</li>
            </ul>
          </div>

          {/* Botón guardar */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : '💾 Guardar Configuración'}
          </button>
        </div>

        {/* Instrucciones de Cron */}
        <div className="mt-6 bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h3 className="font-bold text-gray-900 mb-4">🔧 Configuración del Cron Job</h3>
          <p className="text-sm text-gray-600 mb-4">
            Para que las notificaciones funcionen, asegúrate de que el cron job esté configurado en el servidor.
          </p>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <p className="mb-2"># Ejecutar cada hora</p>
            <p>0 * * * * cd /opt/invoice-system && POSTGRES_PASSWORD=azaleia_pg_2025_secure npx tsx scripts/send-daily-planillas-summary.ts &gt;&gt; /var/log/planillas-notifications.log 2&gt;&amp;1</p>
          </div>
        </div>
      </div>
    </div>
  )
}
