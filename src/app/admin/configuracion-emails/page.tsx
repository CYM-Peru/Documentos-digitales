'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface NotificationSettings {
  id: string
  notificationTime: string
  enabled: boolean
  lastSentAt: string | null
  smtpHost: string | null
  smtpPort: number | null
  smtpUser: string | null
  smtpPass: string | null
  smtpSecure: boolean
  emailFrom: string | null
  approverEmails: string | null
  notifyOnNewPlanilla: boolean
  notifyOnApproval: boolean
  notifyOnRejection: boolean
  notifyDailySummary: boolean
}

export default function EmailConfigurationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // SMTP Configuration
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [emailFrom, setEmailFrom] = useState('')

  // Recipients
  const [approverEmails, setApproverEmails] = useState('')

  // Notification types
  const [notifyOnNewPlanilla, setNotifyOnNewPlanilla] = useState(true)
  const [notifyOnApproval, setNotifyOnApproval] = useState(true)
  const [notifyOnRejection, setNotifyOnRejection] = useState(true)
  const [notifyDailySummary, setNotifyDailySummary] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'SUPER_ADMIN') {
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

      if (data.success && data.settings) {
        const s = data.settings
        setSmtpHost(s.smtpHost || '')
        setSmtpPort(s.smtpPort || 587)
        setSmtpUser(s.smtpUser || '')
        setSmtpPass(s.smtpPass || '')
        setSmtpSecure(s.smtpSecure || false)
        setEmailFrom(s.emailFrom || '')
        setApproverEmails(s.approverEmails || '')
        setNotifyOnNewPlanilla(s.notifyOnNewPlanilla ?? true)
        setNotifyOnApproval(s.notifyOnApproval ?? true)
        setNotifyOnRejection(s.notifyOnRejection ?? true)
        setNotifyDailySummary(s.notifyDailySummary ?? true)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      setMessage({ type: 'error', text: 'Error al cargar la configuracion' })
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
          smtpHost: smtpHost || null,
          smtpPort: smtpPort || 587,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
          smtpSecure,
          emailFrom: emailFrom || null,
          approverEmails: approverEmails || null,
          notifyOnNewPlanilla,
          notifyOnApproval,
          notifyOnRejection,
          notifyDailySummary
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Configuracion guardada exitosamente' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al guardar' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!smtpHost || !smtpUser || !smtpPass) {
      setMessage({ type: 'error', text: 'Por favor completa los campos SMTP antes de probar' })
      return
    }

    try {
      setTesting(true)
      setMessage(null)

      const response = await fetch('/api/settings/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPass,
          smtpSecure,
          emailFrom: emailFrom || smtpUser
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage({ type: 'success', text: 'Conexion SMTP exitosa. Se envio un email de prueba.' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al probar la conexion SMTP' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setTesting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (session?.user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600 mb-4">Solo los Super Administradores pueden acceder a esta pagina.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4 md:p-8">
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
            Configuracion de Emails
          </h1>
          <p className="text-gray-600">
            Configura el servidor SMTP y las notificaciones por correo electronico
          </p>
        </div>

        {/* Mensaje */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <span className="text-xl">{message.type === 'success' ? '✓' : '✕'}</span>
            {message.text}
          </div>
        )}

        {/* SMTP Configuration */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Configuracion SMTP
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Servidor SMTP
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.office365.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Puerto SMTP
              </label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                placeholder="587"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Usuario SMTP (Email)
              </label>
              <input
                type="email"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="notificaciones@empresa.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Contrasena SMTP
              </label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="********"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre del Remitente
              </label>
              <input
                type="text"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
                placeholder="Sistema Cockpit <noreply@empresa.com>"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-gray-700">
                  Conexion Segura (SSL/TLS - Puerto 465)
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Nota:</strong> Para Office 365, usa smtp.office365.com puerto 587 sin SSL.
              Para Gmail, usa smtp.gmail.com puerto 587 sin SSL (necesitas App Password).
            </p>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={testing || !smtpHost || !smtpUser || !smtpPass}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {testing ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                Probando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Probar Conexion SMTP
              </>
            )}
          </button>
        </div>

        {/* Recipients Configuration */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Destinatarios
          </h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Emails de Aprobadores
            </label>
            <textarea
              value={approverEmails}
              onChange={(e) => setApproverEmails(e.target.value)}
              placeholder="aprobador1@empresa.com, aprobador2@empresa.com"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
            />
            <p className="mt-2 text-sm text-gray-600">
              Ingresa los emails separados por coma. Estos recibiran las notificaciones de planillas.
            </p>
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Tipos de Notificacion
          </h2>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">Nueva Planilla Creada</p>
                <p className="text-sm text-gray-600">Notificar cuando un usuario crea una nueva planilla</p>
              </div>
              <input
                type="checkbox"
                checked={notifyOnNewPlanilla}
                onChange={(e) => setNotifyOnNewPlanilla(e.target.checked)}
                className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">Planilla Aprobada</p>
                <p className="text-sm text-gray-600">Notificar al usuario cuando su planilla es aprobada</p>
              </div>
              <input
                type="checkbox"
                checked={notifyOnApproval}
                onChange={(e) => setNotifyOnApproval(e.target.checked)}
                className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">Planilla Rechazada</p>
                <p className="text-sm text-gray-600">Notificar al usuario cuando su planilla es rechazada</p>
              </div>
              <input
                type="checkbox"
                checked={notifyOnRejection}
                onChange={(e) => setNotifyOnRejection(e.target.checked)}
                className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">Resumen Diario</p>
                <p className="text-sm text-gray-600">Enviar un resumen diario de planillas pendientes a los aprobadores</p>
              </div>
              <input
                type="checkbox"
                checked={notifyDailySummary}
                onChange={(e) => setNotifyDailySummary(e.target.checked)}
                className="w-6 h-6 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-4 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              Guardando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Guardar Configuracion
            </>
          )}
        </button>
      </div>
    </div>
  )
}
