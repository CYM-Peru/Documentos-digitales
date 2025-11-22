'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('gemini')

  // WhatsApp states
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null)
  const [whatsappLoading, setWhatsappLoading] = useState(false)
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const [connectingWhatsapp, setConnectingWhatsapp] = useState(false)

  const [formData, setFormData] = useState({
    awsAccessKey: '',
    awsSecretKey: '',
    awsRegion: 'us-east-1',
    googleServiceAccount: '',
    googleSheetsId: '',
    googleDriveFolderId: '',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash-exp',
    geminiPrompt: '',
    sunatClientId: '',
    sunatClientSecret: '',
    sunatRuc: '',
    sunatEnabled: false,
    n8nWebhookUrl: '',
    ocrProvider: 'GEMINI_VISION',
    emailNotifications: true,
    webhookNotifications: false,
    whatsappEnabled: false,
    whatsappApproverNumbers: '',
    whatsappNotifyPlanillaCreated: true,
    whatsappNotifyPlanillaApproved: true,
    whatsappNotifyPlanillaRejected: true,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      if (session.user.role !== 'ORG_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
        router.push('/')
      } else {
        loadSettings()
      }
    }
  }, [status, session, router])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      const data = await response.json()

      if (data.settings) {
        setFormData((prev) => ({
          ...prev,
          ...data.settings,
          awsSecretKey: '',
          googleServiceAccount: '',
          geminiApiKey: '',
          sunatClientSecret: '',
        }))
      }

      // Cargar estado de WhatsApp
      loadWhatsAppStatus()
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadWhatsAppStatus = async () => {
    try {
      const response = await fetch('/api/whatsapp/connect')
      const data = await response.json()
      if (data.success) {
        setWhatsappStatus(data)
      }
    } catch (error) {
      console.error('Error loading WhatsApp status:', error)
    }
  }

  const handleConnectWhatsApp = async () => {
    setConnectingWhatsapp(true)
    setWhatsappMessage('')

    try {
      const response = await fetch('/api/whatsapp/connect', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setWhatsappMessage('QR generado! Escanea con WhatsApp')
        setWhatsappStatus(data)

        // Poll for connection status every 3 seconds
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch('/api/whatsapp/connect')
          const statusData = await statusResponse.json()

          if (statusData.whatsappConnected) {
            setWhatsappMessage('WhatsApp conectado exitosamente!')
            setWhatsappStatus(statusData)
            clearInterval(pollInterval)
            setConnectingWhatsapp(false)

            // Reload settings to get updated data
            loadSettings()
          }
        }, 3000)

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval)
          setConnectingWhatsapp(false)
        }, 120000)
      } else {
        setWhatsappMessage(`Error: ${data.error}`)
        setConnectingWhatsapp(false)
      }
    } catch (error: any) {
      setWhatsappMessage(`Error: ${error.message}`)
      setConnectingWhatsapp(false)
    }
  }

  const handleDisconnectWhatsApp = async () => {
    if (!confirm('¿Desconectar WhatsApp?')) return

    setWhatsappLoading(true)
    setWhatsappMessage('')

    try {
      // TODO: Implement disconnect endpoint
      setWhatsappMessage('Funcionalidad de desconexión pendiente')
    } catch (error: any) {
      setWhatsappMessage(`Error: ${error.message}`)
    } finally {
      setWhatsappLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    try {
      let serviceAccount = null
      if (formData.googleServiceAccount) {
        try {
          serviceAccount = JSON.parse(formData.googleServiceAccount)
        } catch (err) {
          setMessage('Error: Google Service Account debe ser un JSON válido')
          setSaving(false)
          return
        }
      }

      const payload: any = {
        awsAccessKey: formData.awsAccessKey || undefined,
        awsSecretKey: formData.awsSecretKey || undefined,
        awsRegion: formData.awsRegion,
        googleServiceAccount: serviceAccount,
        googleSheetsId: formData.googleSheetsId || undefined,
        googleDriveFolderId: formData.googleDriveFolderId || undefined,
        geminiApiKey: formData.geminiApiKey || undefined,
        geminiModel: formData.geminiModel || undefined,
        geminiPrompt: formData.geminiPrompt || undefined,
        n8nWebhookUrl: formData.n8nWebhookUrl || undefined,
        ocrProvider: formData.ocrProvider,
        emailNotifications: formData.emailNotifications,
        webhookNotifications: formData.webhookNotifications,
        whatsappEnabled: formData.whatsappEnabled,
        whatsappApproverNumbers: formData.whatsappApproverNumbers || undefined,
        whatsappNotifyPlanillaCreated: formData.whatsappNotifyPlanillaCreated,
        whatsappNotifyPlanillaApproved: formData.whatsappNotifyPlanillaApproved,
        whatsappNotifyPlanillaRejected: formData.whatsappNotifyPlanillaRejected,
      }

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        setMessage('✓ Configuración guardada exitosamente')
        setFormData((prev) => ({
          ...prev,
          awsSecretKey: '',
          googleServiceAccount: '',
          geminiApiKey: '',
          sunatClientSecret: '',
        }))
      } else {
        setMessage('✗ Error al guardar la configuración')
      }
    } catch (error) {
      console.error('Save error:', error)
      setMessage('✗ Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl mb-3">
            <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600 text-sm font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'gemini', name: 'Gemini AI', icon: '🤖', gradient: 'from-purple-500 to-indigo-500' },
    { id: 'whatsapp', name: 'WhatsApp', icon: '💬', gradient: 'from-green-500 to-emerald-600' },
    { id: 'sunat', name: 'SUNAT API', icon: '🔐', gradient: 'from-blue-600 to-indigo-600' },
    { id: 'google', name: 'Google Sheets', icon: '📊', gradient: 'from-green-500 to-emerald-500' },
    { id: 'aws', name: 'AWS Textract', icon: '☁️', gradient: 'from-orange-500 to-red-500' },
    { id: 'integrations', name: 'Integraciones', icon: '🔗', gradient: 'from-blue-500 to-cyan-500' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header - Compacto */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Configuración
                </h1>
                <p className="text-[10px] text-gray-600">{session?.user.organizationName}</p>
              </div>
            </div>
            {(session?.user.role === 'ORG_ADMIN' || session?.user.role === 'SUPER_ADMIN') && (
              <button
                onClick={() => router.push('/admin/users')}
                className="px-3 py-1.5 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Usuarios
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main content - Compacto */}
      <main className="max-w-6xl mx-auto px-3 py-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Tabs - Compacto */}
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1.5 border border-gray-200 shadow-sm">
            <div className="flex gap-1.5 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-300 ${
                    activeTab === tab.id
                      ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md transform scale-[1.01]`
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-base mr-1">{tab.icon}</span>
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Gemini AI Tab - Compacto */}
          {activeTab === 'gemini' && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-100 shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                      🤖 Google AI Studio (Gemini Vision)
                    </h2>
                    <p className="text-xs text-gray-600">IA de última generación para análisis de facturas</p>
                  </div>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-md font-semibold"
                  >
                    Obtener API Key →
                  </a>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      🔑 Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={formData.geminiApiKey}
                      onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-all"
                      placeholder="AIzaSy... (dejar en blanco para mantener actual)"
                    />
                    <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                        ✓ Gratis: 1,500 facturas/día
                      </span>
                      <span className="text-gray-400">•</span>
                      <span>Muy económico después</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      🎯 Modelo de Gemini
                    </label>
                    <select
                      value={formData.geminiModel}
                      onChange={(e) => setFormData({ ...formData, geminiModel: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-all"
                    >
                      <option value="gemini-2.0-flash-exp">⚡ Gemini 2.0 Flash (Experimental) - Rápido y preciso</option>
                      <option value="gemini-1.5-pro">💎 Gemini 1.5 Pro - Máxima calidad</option>
                      <option value="gemini-1.5-flash">⚖️ Gemini 1.5 Flash - Balance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      💬 Prompt Personalizado para Análisis de Facturas
                    </label>
                    <textarea
                      value={formData.geminiPrompt}
                      onChange={(e) => setFormData({ ...formData, geminiPrompt: e.target.value })}
                      rows={8}
                      className="w-full px-3 py-2 text-xs border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-gray-900 bg-white transition-all"
                      placeholder="Escribe aquí tu prompt personalizado para que la IA analice las facturas...

Por ejemplo:
Analiza esta factura peruana y extrae:
- Nombre del proveedor
- RUC
- Total a pagar
- Subtotal
- IGV
- etc."
                    />
                    <p className="text-[10px] text-gray-500 mt-1.5 bg-blue-50 border border-blue-200 rounded-lg p-2">
                      💡 <strong>Tip:</strong> Deja en blanco para usar el prompt por defecto optimizado para facturas peruanas SUNAT
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp Notifications Tab */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-green-100 shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">
                      💬 Notificaciones WhatsApp
                    </h2>
                    <p className="text-xs text-gray-600">Notifica automáticamente a usuarios sobre planillas de movilidad</p>
                  </div>
                </div>

                {/* Estado de conexión */}
                <div className="mb-4 p-3 rounded-lg border-2 bg-gradient-to-r from-green-50 to-emerald-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${whatsappStatus?.whatsappConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                      <span className="text-sm font-bold text-gray-900">
                        {whatsappStatus?.whatsappConnected ? '✅ Conectado' : '⚪ Desconectado'}
                      </span>
                    </div>
                    {whatsappStatus?.whatsappPhoneNumber && (
                      <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded-lg border border-green-200">
                        📱 {whatsappStatus.whatsappPhoneNumber}
                      </span>
                    )}
                  </div>

                  {whatsappStatus?.whatsappConnectedAt && (
                    <p className="text-xs text-gray-600">
                      Conectado el: {new Date(whatsappStatus.whatsappConnectedAt).toLocaleString('es-PE')}
                    </p>
                  )}
                </div>

                {/* QR Code o botón de conexión */}
                {!whatsappStatus?.whatsappConnected && (
                  <div className="mb-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                    {whatsappStatus?.qrCode ? (
                      <div className="text-center">
                        <h3 className="text-sm font-bold text-gray-900 mb-3">
                          📱 Escanea el código QR con WhatsApp
                        </h3>
                        <div className="inline-block p-3 bg-white rounded-xl shadow-lg border-2 border-green-300">
                          <img
                            src={whatsappStatus.qrCode}
                            alt="QR Code"
                            className="w-64 h-64 mx-auto"
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-3">
                          1. Abre WhatsApp en tu teléfono<br/>
                          2. Ve a Configuración → Dispositivos vinculados<br/>
                          3. Toca "Vincular un dispositivo"<br/>
                          4. Escanea este código QR
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-3">
                          <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full"></div>
                          <span className="text-xs text-green-700 font-semibold">
                            Esperando conexión...
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <h3 className="text-sm font-bold text-gray-900 mb-2">
                          Conectar WhatsApp
                        </h3>
                        <p className="text-xs text-gray-600 mb-4">
                          Conecta un número de WhatsApp para enviar notificaciones automáticas
                        </p>
                        <button
                          type="button"
                          onClick={handleConnectWhatsApp}
                          disabled={connectingWhatsapp}
                          className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold text-sm hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                          {connectingWhatsapp ? (
                            <span className="flex items-center gap-2">
                              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                              Generando QR...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              📱 Generar Código QR
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Mensajes de estado */}
                {whatsappMessage && (
                  <div className={`mb-4 p-3 rounded-lg border-2 text-sm font-semibold ${
                    whatsappMessage.includes('Error')
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'bg-green-50 border-green-500 text-green-700'
                  }`}>
                    {whatsappMessage}
                  </div>
                )}

                {/* Configuración de notificaciones */}
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                    <h3 className="font-bold text-gray-900 text-sm mb-3">⚙️ Configuración de Notificaciones</h3>

                    <label className="flex items-center gap-2 cursor-pointer group mb-3">
                      <input
                        type="checkbox"
                        checked={formData.whatsappEnabled}
                        onChange={(e) => setFormData({ ...formData, whatsappEnabled: e.target.checked })}
                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        disabled={!whatsappStatus?.whatsappConnected}
                      />
                      <span className="text-sm text-gray-700 font-semibold group-hover:text-green-600 transition-colors">
                        ✅ Activar notificaciones WhatsApp
                      </span>
                    </label>

                    {!whatsappStatus?.whatsappConnected && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                        ⚠️ Primero debes conectar WhatsApp para activar las notificaciones
                      </p>
                    )}

                    <div className="space-y-2 pl-7">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.whatsappNotifyPlanillaCreated}
                          onChange={(e) => setFormData({ ...formData, whatsappNotifyPlanillaCreated: e.target.checked })}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          disabled={!formData.whatsappEnabled}
                        />
                        <span className="text-xs text-gray-700 font-medium group-hover:text-green-600 transition-colors">
                          🆕 Notificar cuando se crea una planilla
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.whatsappNotifyPlanillaApproved}
                          onChange={(e) => setFormData({ ...formData, whatsappNotifyPlanillaApproved: e.target.checked })}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          disabled={!formData.whatsappEnabled}
                        />
                        <span className="text-xs text-gray-700 font-medium group-hover:text-green-600 transition-colors">
                          ✅ Notificar cuando se aprueba una planilla
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={formData.whatsappNotifyPlanillaRejected}
                          onChange={(e) => setFormData({ ...formData, whatsappNotifyPlanillaRejected: e.target.checked })}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          disabled={!formData.whatsappEnabled}
                        />
                        <span className="text-xs text-gray-700 font-medium group-hover:text-green-600 transition-colors">
                          ❌ Notificar cuando se rechaza una planilla
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      📞 Números de Aprobadores (WhatsApp)
                    </label>
                    <input
                      type="text"
                      value={formData.whatsappApproverNumbers}
                      onChange={(e) => setFormData({ ...formData, whatsappApproverNumbers: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white transition-all"
                      placeholder="51968801771,51952393110"
                      disabled={!formData.whatsappEnabled}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Ingresa los números de WhatsApp de los aprobadores separados por comas.<br/>
                      Formato: código de país + número (sin espacios ni símbolos)<br/>
                      Ejemplo: <code className="bg-gray-100 px-1 py-0.5 rounded">51968801771,51952393110</code>
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-blue-900 mb-2">📋 Cómo funciona:</h4>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Cuando un usuario crea una planilla, se envía WhatsApp a los aprobadores</li>
                      <li>Cuando se aprueba/rechaza una planilla, se envía WhatsApp al usuario</li>
                      <li>Los mensajes se envían automáticamente desde el número conectado</li>
                      <li>Asegúrate de que el número tenga WhatsApp Business (recomendado)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUNAT API Tab - Compacto */}
          {activeTab === 'sunat' && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-blue-100 shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                      🔐 API de Validación SUNAT
                    </h2>
                    <p className="text-xs text-gray-600">Verifica automáticamente los comprobantes contra SUNAT</p>
                  </div>
                  <a
                    href="https://www.sunat.gob.pe"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-md font-semibold"
                  >
                    Más Info →
                  </a>
                </div>

                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-bold text-blue-900 text-xs mb-0.5">¿Qué es esto?</h3>
                        <p className="text-[11px] text-blue-800 mb-1">
                          La API de SUNAT te permite validar si una factura/boleta realmente existe en los sistemas oficiales.
                        </p>
                        <ul className="text-[11px] text-blue-800 space-y-0.5">
                          <li>• ✅ Detecta facturas falsas o clonadas</li>
                          <li>• ✅ Verifica que el comprobante esté activo</li>
                          <li>• ✅ Valida montos, RUC, serie y número</li>
                          <li>• ✅ Comprobación oficial y legal</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.sunatEnabled}
                        onChange={(e) => setFormData({ ...formData, sunatEnabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-gray-700">
                        ⚡ Activar validación automática con SUNAT
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      🆔 Client ID
                    </label>
                    <input
                      type="text"
                      value={formData.sunatClientId}
                      onChange={(e) => setFormData({ ...formData, sunatClientId: e.target.value })}
                      className="w-full px-3 py-2 text-xs border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all font-mono"
                      placeholder="f23d42a8-e073-4499-b0c3-a895eaa7d929"
                      disabled={!formData.sunatEnabled}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      🔑 Client Secret
                    </label>
                    <input
                      type="password"
                      value={formData.sunatClientSecret}
                      onChange={(e) => setFormData({ ...formData, sunatClientSecret: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all"
                      placeholder="4pfZleue7tVAhieUhLvDMA== (dejar en blanco para mantener actual)"
                      disabled={!formData.sunatEnabled}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      🏢 RUC de tu Empresa
                    </label>
                    <input
                      type="text"
                      value={formData.sunatRuc}
                      onChange={(e) => setFormData({ ...formData, sunatRuc: e.target.value })}
                      maxLength={11}
                      pattern="[0-9]{11}"
                      className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all font-mono"
                      placeholder="20123456789 (11 dígitos)"
                      disabled={!formData.sunatEnabled}
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Este es el RUC de tu empresa (receptor), no del emisor
                    </p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <h4 className="font-bold text-green-900 text-xs mb-1.5 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      ¿Cómo funciona?
                    </h4>
                    <ol className="text-[11px] text-green-800 space-y-0.5 list-decimal list-inside">
                      <li>Gemini AI extrae los datos de la factura (RUC, serie, número, monto)</li>
                      <li>Automáticamente se consulta la API de SUNAT</li>
                      <li>SUNAT responde si el comprobante existe y es válido</li>
                      <li>Se muestra un badge azul "✓ SUNAT" si es legítimo</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Google Sheets Tab - Compacto */}
          {activeTab === 'google' && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-green-100 shadow-md">
                <h2 className="text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-3">
                  📊 Google Sheets / Drive
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Service Account JSON
                    </label>
                    <textarea
                      value={formData.googleServiceAccount}
                      onChange={(e) => setFormData({ ...formData, googleServiceAccount: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 text-xs border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-gray-900 bg-white transition-all"
                      placeholder='{"type": "service_account", ...}'
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Google Sheets ID
                      </label>
                      <input
                        type="text"
                        value={formData.googleSheetsId}
                        onChange={(e) => setFormData({ ...formData, googleSheetsId: e.target.value })}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white transition-all"
                        placeholder="1abc...xyz"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Google Drive Folder ID (opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.googleDriveFolderId}
                        onChange={(e) => setFormData({ ...formData, googleDriveFolderId: e.target.value })}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white transition-all"
                        placeholder="1abc...xyz"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AWS Tab - Compacto */}
          {activeTab === 'aws' && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-orange-100 shadow-md">
                <h2 className="text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-3">
                  ☁️ AWS Textract (OCR)
                </h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        AWS Access Key ID
                      </label>
                      <input
                        type="text"
                        value={formData.awsAccessKey}
                        onChange={(e) => setFormData({ ...formData, awsAccessKey: e.target.value })}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 bg-white transition-all"
                        placeholder="AKIA..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        AWS Secret Access Key
                      </label>
                      <input
                        type="password"
                        value={formData.awsSecretKey}
                        onChange={(e) => setFormData({ ...formData, awsSecretKey: e.target.value })}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 bg-white transition-all"
                        placeholder="Dejar en blanco para mantener actual"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      AWS Region
                    </label>
                    <select
                      value={formData.awsRegion}
                      onChange={(e) => setFormData({ ...formData, awsRegion: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 bg-white transition-all"
                    >
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-west-2">US West (Oregon)</option>
                      <option value="eu-west-1">EU (Ireland)</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab - Compacto */}
          {activeTab === 'integrations' && (
            <div className="space-y-3 animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-blue-100 shadow-md">
                <h2 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-3">
                  🔗 Integraciones y Notificaciones
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      n8n Webhook URL
                    </label>
                    <input
                      type="url"
                      value={formData.n8nWebhookUrl}
                      onChange={(e) => setFormData({ ...formData, n8nWebhookUrl: e.target.value })}
                      className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-all"
                      placeholder="http://localhost:5678/webhook/..."
                    />
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 space-y-2">
                    <h3 className="font-bold text-gray-900 text-xs">Notificaciones</h3>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.emailNotifications}
                        onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700 font-medium group-hover:text-blue-600 transition-colors">
                        📧 Notificaciones por email
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.webhookNotifications}
                        onChange={(e) => setFormData({ ...formData, webhookNotifications: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700 font-medium group-hover:text-blue-600 transition-colors">
                        🔔 Notificaciones vía webhook
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Message - Compacto */}
          {message && (
            <div
              className={`p-3 rounded-xl border-2 text-sm font-semibold animate-scale-in ${
                message.includes('Error') || message.includes('✗')
                  ? 'bg-red-50 border-red-500 text-red-700'
                  : 'bg-green-50 border-green-500 text-green-700'
              }`}
            >
              {message}
            </div>
          )}

          {/* Submit button - Compacto */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-md hover:shadow-lg"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Guardando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Guardar Configuración
              </span>
            )}
          </button>
        </form>
      </main>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
