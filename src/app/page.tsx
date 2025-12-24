'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import CameraCapture from '@/components/CameraCapture'
import MobileCameraCapture from '@/components/MobileCameraCapture'
import MultiUploadProgress from '@/components/MultiUploadProgress'
import LogoutAnimation from '@/components/LogoutAnimation'
import TimeBasedBackground from '@/components/TimeBasedBackground'
import MovilidadForm from '@/components/MovilidadForm'
import GastoReparableForm from '@/components/GastoReparableForm'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useTimeOfDay } from '@/hooks/useTimeOfDay'
import { useNotifications } from '@/hooks/useNotifications'
import { FadeIn, SlideUp, ScaleIn, AnimatedCard } from '@/components/animations'
import { motion } from 'framer-motion'

interface Invoice {
  id: string
  imageUrl: string
  thumbnailUrl?: string
  vendorName?: string
  invoiceNumber?: string
  totalAmount?: number
  status: string
  createdAt: string
  currency?: string
  // Campos específicos SUNAT
  documentType?: string
  documentTypeCode?: string
  rucEmisor?: string
  razonSocialEmisor?: string
  domicilioFiscalEmisor?: string
  rucReceptor?: string
  dniReceptor?: string
  razonSocialReceptor?: string
  serieNumero?: string
  subtotal?: number
  igvTasa?: number
  igvMonto?: number
  taxAmount?: number
  invoiceDate?: string
  ocrData?: any
  // Verificación SUNAT
  sunatVerified?: boolean
  sunatEstadoCp?: string
  sunatEstadoRuc?: string
  sunatObservaciones?: string[]
  sunatVerifiedAt?: string
  // Detección de duplicados
  isDuplicate?: boolean
  duplicateOfId?: string
  duplicateDetectionMethod?: string
  qrCode?: string
  // Tipo de operación
  tipoOperacion?: string
  nroRendicion?: string
  // Campos adicionales OCR y edición
  anotacionManuscrita?: string
  conceptoGasto?: string
  glosaEditada?: string
  resumenItems?: string
  observacion?: string
  // Usuario que creó la factura
  user?: {
    name?: string
    email?: string
  }
}

interface Rendicion {
  CodUserAsg: string
  CodEstado: string
  NroRend: number
  CodLocal?: string
  NroCajaChica?: number
  DesEmpresa?: string
}

interface CajaChica {
  CodUserAsg: string
  CodEstado: string
  NroRend: number
  CodLocal?: string
  DesEmpresa?: string
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isMobile = useIsMobile()
  const { period } = useTimeOfDay()
  const { requestPermission, isSupported: notificationsSupported } = useNotifications()
  const [showCamera, setShowCamera] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [estadoCierre, setEstadoCierre] = useState<'todas' | 'abiertas' | 'cerradas'>('abiertas') // Filtro abiertas/cerradas
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [pollingActive, setPollingActive] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [columnCount, setColumnCount] = useState<4 | 5 | 6>(6) // Selector de columnas
  const [nroRendicion, setNroRendicion] = useState('')
  const [rendiciones, setRendiciones] = useState<Rendicion[]>([])
  const [loadingRendiciones, setLoadingRendiciones] = useState(false)
  const [userFilter, setUserFilter] = useState<string>('all') // 🆕 Filtro por usuario
  const [users, setUsers] = useState<Array<{id: string, name: string, email: string}>>([]) // 🆕 Lista de usuarios
  const [multiUploadProgress, setMultiUploadProgress] = useState<Array<{fileName: string, status: 'pending' | 'uploading' | 'success' | 'error', error?: string}>>([])
  const [showMultiUploadProgress, setShowMultiUploadProgress] = useState(false)
  const [showLogoutAnimation, setShowLogoutAnimation] = useState(false)
  const [operationType, setOperationType] = useState<'RENDICION' | 'CAJA_CHICA' | 'PLANILLA_MOVILIDAD' | 'GASTO_REPARABLE' | null>(null)
  const [showMovilidadForm, setShowMovilidadForm] = useState(false)
  const [showGastoReparableForm, setShowGastoReparableForm] = useState(false)
  const [pendingPlanillasCount, setPendingPlanillasCount] = useState(0)
  const [userPlanillasCount, setUserPlanillasCount] = useState({ pendientes: 0, aprobadas: 0, rechazadas: 0 })
  const [userPlanillas, setUserPlanillas] = useState<any[]>([])
  const [lastUserPlanillasState, setLastUserPlanillasState] = useState<string>('')
  const [showUserPlanillasModal, setShowUserPlanillasModal] = useState(false)
  const [planillas, setPlanillas] = useState<any[]>([]) // 🆕 Para mostrar planillas en vista principal
  const [selectedPlanilla, setSelectedPlanilla] = useState<any | null>(null) // 🆕 Planilla seleccionada para ver detalles
  const [showPlanillaDetailModal, setShowPlanillaDetailModal] = useState(false) // 🆕 Modal de detalles de planilla
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false) // 🆕 Estado del menú hamburguesa

  // 🆕 Estados para asignación de destino de planilla
  const [assignDestinationType, setAssignDestinationType] = useState<'RENDICION' | 'CAJA_CHICA' | ''>('')
  const [assignRendicionNumber, setAssignRendicionNumber] = useState('')
  const [assignCajaChicaNumber, setAssignCajaChicaNumber] = useState('')
  const [assignCodLocal, setAssignCodLocal] = useState('')
  const [assigningDestino, setAssigningDestino] = useState(false)
  const [availableRendiciones, setAvailableRendiciones] = useState<Rendicion[]>([])
  const [availableCajasChicas, setAvailableCajasChicas] = useState<Rendicion[]>([])
  const [loadingAvailableList, setLoadingAvailableList] = useState(false)

  const [showAssignNumberModal, setShowAssignNumberModal] = useState(false)
  const [assigningNumber, setAssigningNumber] = useState(false)
  const [invoiceToAssign, setInvoiceToAssign] = useState<Invoice | null>(null)
  const [newNumber, setNewNumber] = useState('')
  const [isPageVisible, setIsPageVisible] = useState(true) // Page Visibility API

  // Estados para edición de factura en modal
  const [editingObservacion, setEditingObservacion] = useState('')
  const [editingConcepto, setEditingConcepto] = useState('')
  const [imageRotation, setImageRotation] = useState(0)
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [showAssignToModal, setShowAssignToModal] = useState(false)
  const [assignToType, setAssignToType] = useState<'RENDICION' | 'CAJA_CHICA' | ''>('')
  const [assignToNumber, setAssignToNumber] = useState('')

  // Helper function para obtener el nombre del tipo de documento
  const getDocumentTypeName = (plural = false, capitalized = true) => {
    if (!operationType) return plural ? 'documentos' : 'documento'

    const names = {
      RENDICION: { singular: 'rendicion', plural: 'rendiciones' },
      CAJA_CHICA: { singular: 'caja chica', plural: 'cajas chicas' },
      PLANILLA_MOVILIDAD: { singular: 'planilla', plural: 'planillas' },
      GASTO_REPARABLE: { singular: 'gasto reparable', plural: 'gastos reparables' }
    }

    const name = plural ? names[operationType].plural : names[operationType].singular
    return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name
  }

  // Helper function para obtener el CodLocal de una caja chica seleccionada
  const getCodLocalFromNroRendicion = (nroRend: string): string | undefined => {
    if (!nroRend || operationType !== 'CAJA_CHICA') return undefined
    const found = rendiciones.find(r => String(r.NroRend) === String(nroRend))
    return found?.CodLocal
  }

  // 🆕 Función para cargar planillas de movilidad
  const loadPlanillas = useCallback(async () => {
    try {
      console.log('🔄 Cargando planillas de movilidad...')
      setLoading(true)
      const response = await fetch('/api/planillas-movilidad')
      const data = await response.json()
      console.log('📊 Respuesta API planillas:', data)
      if (data.success) {
        setPlanillas(data.planillas || [])
        console.log('📋 Planillas cargadas:', data.planillas?.length || 0)
      } else {
        console.error('❌ API retornó success: false')
      }
    } catch (error) {
      console.error('❌ Error loading planillas:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // 🆕 Función para asignar planilla a rendición o caja chica
  const handleAsignarDestino = async () => {
    if (!selectedPlanilla) return

    // Validar que se seleccionó un tipo
    if (!assignDestinationType) {
      alert('Por favor seleccione si desea asignar a Rendición o Caja Chica')
      return
    }

    // Validar que se ingresó el número correspondiente
    if (assignDestinationType === 'RENDICION' && !assignRendicionNumber) {
      alert('Por favor ingrese el número de rendición')
      return
    }

    if (assignDestinationType === 'CAJA_CHICA' && !assignCajaChicaNumber) {
      alert('Por favor ingrese el número de caja chica')
      return
    }

    try {
      setAssigningDestino(true)

      const response = await fetch(`/api/planillas-movilidad/${selectedPlanilla.id}/asignar-destino`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoOperacion: assignDestinationType,
          nroRendicion: assignDestinationType === 'RENDICION' ? assignRendicionNumber : undefined,
          nroCajaChica: assignDestinationType === 'CAJA_CHICA' ? assignCajaChicaNumber : undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || 'Planilla asignada exitosamente')

        // Actualizar planilla seleccionada con los nuevos datos
        setSelectedPlanilla(data.planilla)

        // Recargar lista de planillas
        loadPlanillas()

        // Limpiar formulario
        setAssignDestinationType('')
        setAssignRendicionNumber('')
        setAssignCajaChicaNumber('')
        setAssignCodLocal('')
      } else {
        alert(data.error || 'Error al asignar planilla')
      }
    } catch (error) {
      console.error('Error asignando destino:', error)
      alert('Error al asignar planilla')
    } finally {
      setAssigningDestino(false)
    }
  }

  // Función para eliminar planilla (solo SUPER_ADMIN y STAFF)
  const handleEliminarPlanilla = async (planillaId: string, nroPlanilla?: string) => {
    if (!confirm(`¿Estás seguro de eliminar la planilla ${nroPlanilla || planillaId}?\n\nEsta acción no se puede deshacer.`)) {
      return
    }

    try {
      const response = await fetch(`/api/planillas-movilidad/${planillaId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message)
        setShowPlanillaDetailModal(false)
        setSelectedPlanilla(null)
        loadPlanillas()
      } else {
        alert(data.error || 'Error al eliminar planilla')
      }
    } catch (error) {
      console.error('Error eliminando planilla:', error)
      alert('Error al eliminar planilla')
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      // Verificar si hay tipo de operación seleccionado
      const savedType = sessionStorage.getItem('operationType')
      if (!savedType) {
        // Si no hay tipo seleccionado, redirigir a selección
        router.push('/select-operation')
        return
      }
      // Establecer tipo de operacion
      setOperationType(savedType as 'RENDICION' | 'CAJA_CHICA' | 'PLANILLA_MOVILIDAD' | 'GASTO_REPARABLE')
      // ❌ NO llamar loadInvoices() aquí porque operationType todavía no se actualizó
      // ✅ El useEffect de la línea 115 se encargará de cargar cuando operationType cambie
      // Solo cargar usuarios si tiene permisos de admin/staff
      const canViewUsers = ['SUPER_ADMIN', 'ORG_ADMIN', 'STAFF', 'VERIFICADOR'].includes(session?.user?.role || '')
      if (canViewUsers) {
        loadUsers()
      }
    }
  }, [status, router])

  // 🆕 Recargar facturas y rendiciones/cajas chicas cuando cambie el filtro de usuario o tipo de operacion
  useEffect(() => {
    if (status === 'authenticated' && operationType) {
      console.log('🔍 operationType cambio a:', operationType)
      if (operationType === 'PLANILLA_MOVILIDAD') {
        console.log('✅ Llamando a loadPlanillas...')
        loadPlanillas() // 🆕 Cargar planillas si estamos en modo planilla
      } else if (operationType === 'GASTO_REPARABLE') {
        console.log('✅ Modo Gasto Reparable...')
        // TODO: Implementar loadGastosReparables() cuando exista la pagina
        loadPlanillas() // Por ahora mostrar planillas hasta tener pagina dedicada
      } else {
        loadInvoices()
        loadRendiciones() // Recargar rendiciones/cajas chicas al cambiar tipo
      }
    }
  }, [status, userFilter, operationType, estadoCierre, loadPlanillas])

  // Auto-refresh SUPER AGRESIVO: actualización cada 1 segundo
  useEffect(() => {
    const hasProcessingInvoices = invoices.some(
      (inv) => inv.status === 'PROCESSING' || inv.status === 'PENDING'
    )

    // Activar polling si hay facturas procesando O si se acaba de subir algo
    if (!hasProcessingInvoices && !pollingActive) return

    console.log('🔄 Polling activo - actualizando cada 1 segundo')

    const interval = setInterval(() => {
      console.log('🔄 Actualizando facturas...')
      loadInvoices()
    }, 1000) // ¡SUPER AGRESIVO! Cada 1 segundo

    return () => clearInterval(interval)
  }, [invoices, pollingActive])

  // Función para cargar contador de planillas pendientes
  const loadPendingPlanillasCount = useCallback(async () => {
    try {
      const response = await fetch('/api/planillas-movilidad/pendientes')
      const data = await response.json()
      if (data.success) {
        const newCount = data.pendientes || 0
        const oldCount = pendingPlanillasCount

        // Si hay nuevas planillas, mostrar notificación
        if (newCount > oldCount && oldCount !== 0) {
          const diff = newCount - oldCount
          if ('Notification' in window && Notification.permission === 'granted') {
            // Usar notificación simple para compatibilidad con iOS
            const notification = new Notification('Nueva Planilla de Movilidad', {
              body: `Tienes ${diff} ${diff === 1 ? 'planilla nueva' : 'planillas nuevas'} pendiente${diff === 1 ? '' : 's'} de aprobación`,
              icon: '/favicon.ico',
              requireInteraction: true,
            })

            notification.onclick = () => {
              console.log('📱 Notificación clickeada - Nueva planilla')
              window.focus()
              notification.close()
              router.push('/aprobacion-planillas')
            }
          }
        }

        setPendingPlanillasCount(newCount)
      }
    } catch (error) {
      console.error('Error loading pending planillas count:', error)
    }
  }, [pendingPlanillasCount, router])

  // Función para cargar planillas del usuario normal
  const loadUserPlanillas = useCallback(async () => {
    try {
      const response = await fetch('/api/planillas-movilidad/mis-planillas')
      const data = await response.json()
      if (data.success) {
        const newCount = data.contadores
        const oldCount = userPlanillasCount

        // Crear un "fingerprint" del estado actual
        const newState = `${newCount.aprobadas}-${newCount.rechazadas}`
        const oldState = lastUserPlanillasState

        // Detectar cambios (una planilla fue aprobada o rechazada)
        if (oldState && newState !== oldState) {
          // Calcular diferencias
          const aprobadas = newCount.aprobadas - oldCount.aprobadas
          const rechazadas = newCount.rechazadas - oldCount.rechazadas

          // Mostrar notificación según el cambio
          if (aprobadas > 0) {
            if ('Notification' in window && Notification.permission === 'granted') {
              // Usar notificación simple para compatibilidad con iOS
              const notification = new Notification('✅ Planilla Aprobada', {
                body: `Tu ${aprobadas === 1 ? 'planilla ha sido aprobada' : `${aprobadas} planillas han sido aprobadas`} por el aprobador`,
                icon: '/favicon.ico',
                requireInteraction: true,
              })

              notification.onclick = () => {
                console.log('📱 Notificación clickeada - Aprobada')
                window.focus()
                notification.close()
                // Forzar recarga para mostrar cambios
                window.location.reload()
              }
            }
          }

          if (rechazadas > 0) {
            if ('Notification' in window && Notification.permission === 'granted') {
              // Usar notificación simple para compatibilidad con iOS
              const notification = new Notification('❌ Planilla Rechazada', {
                body: `Tu ${rechazadas === 1 ? 'planilla ha sido rechazada' : `${rechazadas} planillas han sido rechazadas`}. Revisa los comentarios.`,
                icon: '/favicon.ico',
                requireInteraction: true,
              })

              notification.onclick = () => {
                console.log('📱 Notificación clickeada - Rechazada')
                window.focus()
                notification.close()
                // Forzar recarga para mostrar cambios
                window.location.reload()
              }
            }
          }
        }

        setUserPlanillasCount(newCount)
        setUserPlanillas(data.planillas || [])
        setLastUserPlanillasState(newState)
      }
    } catch (error) {
      console.error('Error loading user planillas:', error)
    }
  }, [userPlanillasCount, lastUserPlanillasState])

  // Page Visibility API - Detectar cuando la pestaña está visible/oculta
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden)
      if (!document.hidden) {
        console.log('📱 Pestaña visible - Reactivando polling')
      } else {
        console.log('💤 Pestaña oculta - Pausando polling')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Cargar contador de planillas pendientes para APROBADOR
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'APROBADOR' && isPageVisible) {
      loadPendingPlanillasCount()
      // Actualizar cada 30 segundos solo si la pestaña está visible
      const interval = setInterval(() => {
        if (!document.hidden) {
          loadPendingPlanillasCount()
        }
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [status, session?.user?.role, isPageVisible, loadPendingPlanillasCount])

  // Cargar planillas del usuario normal
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'APROBADOR' && isPageVisible) {
      loadUserPlanillas()
      // Actualizar cada 30 segundos solo si la pestaña está visible
      const interval = setInterval(() => {
        if (!document.hidden) {
          loadUserPlanillas()
        }
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [status, session?.user?.role, isPageVisible, loadUserPlanillas])

  // Inicializar campos de edición cuando se selecciona una factura
  useEffect(() => {
    if (selectedInvoice) {
      setEditingObservacion(selectedInvoice.observacion || '')
      setEditingConcepto(selectedInvoice.conceptoGasto || selectedInvoice.resumenItems || '')
      setImageRotation(0) // Siempre empezar sin rotación
    }
  }, [selectedInvoice])

  // Solicitar permiso de notificaciones para todos los usuarios
  useEffect(() => {
    if (status === 'authenticated' && notificationsSupported) {
      // Solicitar permiso después de 2 segundos para no ser intrusivo
      const timer = setTimeout(() => {
        requestPermission().then((granted) => {
          if (granted) {
            console.log('✅ Notificaciones push habilitadas')
          } else {
            console.log('⚠️ Notificaciones push denegadas')
          }
        })
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [status, notificationsSupported, requestPermission])

  // Escuchar mensajes del service worker para navegación
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const messageHandler = (event: MessageEvent) => {
        console.log('Message from service worker:', event.data)
        if (event.data && event.data.type === 'NAVIGATE') {
          console.log('Navigating to:', event.data.url)
          router.push(event.data.url)
        }
      }

      navigator.serviceWorker.addEventListener('message', messageHandler)

      return () => {
        navigator.serviceWorker.removeEventListener('message', messageHandler)
      }
    }
  }, [router])

  const loadInvoices = async () => {
    try {
      // 🆕 Incluir filtro de usuario y tipo de operación en la URL
      const params = new URLSearchParams()
      if (userFilter && userFilter !== 'all') {
        params.append('userId', userFilter)
      }
      if (operationType) {
        params.append('tipoOperacion', operationType)
      }
      const url = `/api/invoices${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      const data = await response.json()
      setInvoices(data.invoices || [])
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users')
      if (!response.ok) {
        // Si no tiene permisos, simplemente no cargar usuarios
        if (response.status === 401 || response.status === 403) {
          return
        }
      }
      const data = await response.json()
      if (data.users) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadRendiciones = async () => {
    try {
      setLoadingRendiciones(true)

      // Si es planilla de movilidad, no cargar rendiciones/cajas chicas
      if (operationType === 'PLANILLA_MOVILIDAD') {
        setRendiciones([])
        setLoadingRendiciones(false)
        return
      }

      // Consultar el endpoint correcto según el tipo de operación
      const endpoint = operationType === 'CAJA_CHICA' ? '/api/cajas-chicas' : '/api/rendiciones'

      // Construir query params según estadoCierre
      const params = new URLSearchParams()
      if (estadoCierre === 'abiertas') {
        params.append('soloAbiertas', 'true')
      } else if (estadoCierre === 'cerradas') {
        params.append('soloAbiertas', 'false')
      } else if (estadoCierre === 'todas') {
        params.append('soloAbiertas', 'null')
      }

      const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint
      const response = await fetch(url)
      const data = await response.json()

      if (operationType === 'CAJA_CHICA') {
        // Para cajas chicas, usar directamente (ya tienen NroRend)
        if (data.success && data.cajasChicas) {
          setRendiciones(data.cajasChicas)
          console.log(`💰 ${data.cajasChicas.length} cajas chicas ${estadoCierre} cargadas`)
        }
      } else {
        // Para rendiciones, usar directamente
        if (data.success && data.rendiciones) {
          setRendiciones(data.rendiciones)
          console.log(`📋 ${data.rendiciones.length} rendiciones ${estadoCierre} cargadas`)
        }
      }
    } catch (error) {
      console.error('Error loading rendiciones/cajas chicas:', error)
    } finally {
      setLoadingRendiciones(false)
    }
  }

  // Cargar rendiciones disponibles para asignación de planillas
  const loadAvailableRendiciones = async () => {
    try {
      setLoadingAvailableList(true)

      // Construir query params según estadoCierre
      const params = new URLSearchParams()
      if (estadoCierre === 'abiertas') {
        params.append('soloAbiertas', 'true')
      } else if (estadoCierre === 'cerradas') {
        params.append('soloAbiertas', 'false')
      } else if (estadoCierre === 'todas') {
        params.append('soloAbiertas', 'null')
      }

      const url = params.toString() ? `/api/rendiciones?${params.toString()}` : '/api/rendiciones'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success && data.rendiciones) {
        setAvailableRendiciones(data.rendiciones)
        console.log(`📋 ${data.rendiciones.length} rendiciones ${estadoCierre} disponibles para asignar`)
      }
    } catch (error) {
      console.error('Error loading available rendiciones:', error)
    } finally {
      setLoadingAvailableList(false)
    }
  }

  // Cargar cajas chicas disponibles para asignación de planillas
  const loadAvailableCajasChicas = async () => {
    try {
      setLoadingAvailableList(true)

      // Construir query params según estadoCierre
      const params = new URLSearchParams()
      if (estadoCierre === 'abiertas') {
        params.append('soloAbiertas', 'true')
      } else if (estadoCierre === 'cerradas') {
        params.append('soloAbiertas', 'false')
      } else if (estadoCierre === 'todas') {
        params.append('soloAbiertas', 'null')
      }

      const url = params.toString() ? `/api/cajas-chicas?${params.toString()}` : '/api/cajas-chicas'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success && data.cajasChicas) {
        setAvailableCajasChicas(data.cajasChicas)
        console.log(`💰 ${data.cajasChicas.length} cajas chicas ${estadoCierre} disponibles para asignar`)
      }
    } catch (error) {
      console.error('Error loading available cajas chicas:', error)
    } finally {
      setLoadingAvailableList(false)
    }
  }

  const handleCapture = async (file: File, nroRendicionValue?: string) => {
    // Crear preview instantáneo
    const previewUrl = URL.createObjectURL(file)
    setUploadPreview(previewUrl)
    setUploadingFile(file)
    setUploading(true)

    console.log('📤 Subiendo factura...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (nroRendicionValue) {
        formData.append('nroRendicion', nroRendicionValue)
        // Enviar codLocal para cajas chicas
        const codLocal = getCodLocalFromNroRendicion(nroRendicionValue)
        if (codLocal) {
          formData.append('codLocal', codLocal)
        }
      }
      if (operationType) {
        formData.append('tipoOperacion', operationType)
      }

      const response = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        console.log('✅ Upload completado, cargando facturas inmediatamente...')

        // Cargar inmediatamente
        await loadInvoices()

        // Activar polling SUPER agresivo por 45 segundos
        console.log('🚀 Activando polling cada 1 segundo por 45 segundos')
        setPollingActive(true)

        // Recargar cada segundo manualmente durante los primeros 10 segundos
        const quickReloads = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]
        quickReloads.forEach(delay => {
          setTimeout(() => {
            console.log(`⚡ Quick reload en ${delay}ms`)
            loadInvoices()
          }, delay)
        })

        setTimeout(() => {
          console.log('⏸️ Desactivando polling')
          setPollingActive(false)
        }, 45000) // 45 segundos de polling garantizado
      } else {
        alert(`Error al subir la ${getDocumentTypeName(false, false)}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert(`Error al subir la ${getDocumentTypeName(false, false)}`)
    } finally {
      setUploading(false)
      // Limpiar preview después de un segundo
      setTimeout(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setUploadPreview(null)
        setUploadingFile(null)
      }, 1000)
    }
  }

  // Función para manejar múltiples capturas
  const handleMultiCapture = async (files: File[]) => {
    setShowCamera(false)

    // Verificar N° de Rendición
    if (!nroRendicion.trim()) {
      const confirmed = confirm('⚠️ No has ingresado un N° de Rendición.\n\n¿Deseas continuar sin número de rendición?')
      if (!confirmed) return
    }

    // Inicializar progreso
    const initialProgress = files.map((file) => ({
      fileName: file.name,
      status: 'pending' as const,
    }))
    setMultiUploadProgress(initialProgress)
    setShowMultiUploadProgress(true)

    // Subir archivos secuencialmente
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Marcar como "uploading"
      setMultiUploadProgress((prev) =>
        prev.map((item, index) =>
          index === i ? { ...item, status: 'uploading' } : item
        )
      )

      try {
        const formData = new FormData()
        formData.append('file', file)
        if (nroRendicion.trim()) {
          formData.append('nroRendicion', nroRendicion.trim())
          // Enviar codLocal para cajas chicas
          const codLocal = getCodLocalFromNroRendicion(nroRendicion.trim())
          if (codLocal) {
            formData.append('codLocal', codLocal)
          }
        }
        if (operationType) {
          formData.append('tipoOperacion', operationType)
        }

        const response = await fetch('/api/invoices/upload', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          // Marcar como exitosa
          setMultiUploadProgress((prev) =>
            prev.map((item, index) =>
              index === i ? { ...item, status: 'success' } : item
            )
          )
        } else {
          // Marcar como error
          setMultiUploadProgress((prev) =>
            prev.map((item, index) =>
              index === i ? { ...item, status: 'error', error: 'Error al subir' } : item
            )
          )
        }
      } catch (error) {
        // Marcar como error
        setMultiUploadProgress((prev) =>
          prev.map((item, index) =>
            index === i ? { ...item, status: 'error', error: 'Error de red' } : item
          )
        )
      }

      // Pequeña pausa entre uploads
      if (i < files.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    // Recargar facturas cuando todas terminen
    await loadInvoices()

    // Activar polling después de subir todas
    setPollingActive(true)
    setTimeout(() => {
      setPollingActive(false)
    }, 30000)
  }

  const handleLogout = async () => {
    console.log('🚪 Logout iniciado')
    try {
      await signOut({ callbackUrl: '/login', redirect: true })
    } catch (error) {
      console.error('Error en logout:', error)
      // Intento alternativo
      window.location.href = '/api/auth/signout'
    }
  }

  const handleLogoutComplete = () => {
    signOut()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Verificar si hay N° de Rendición
    if (!nroRendicion.trim()) {
      const confirmed = confirm('⚠️ No has ingresado un N° de Rendición.\n\n¿Deseas continuar sin número de rendición?')
      if (!confirmed) {
        event.target.value = ''
        return
      }
    }

    // Subir todos los archivos seleccionados
    const totalFiles = files.length
    console.log(`📤 Subiendo ${totalFiles} archivo(s)...`)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`📤 Subiendo archivo ${i + 1}/${totalFiles}: ${file.name}`)
      await handleCapture(file, nroRendicion.trim() || undefined)

      // Pequeña pausa entre uploads para no saturar
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Reset input para permitir subir el mismo archivo nuevamente
    event.target.value = ''
  }

  const handleXMLFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Verificar si hay N° de Rendición
    if (!nroRendicion.trim()) {
      const confirmed = confirm('⚠️ No has ingresado un N° de Rendición.\n\n¿Deseas continuar sin número de rendición?')
      if (!confirmed) {
        event.target.value = ''
        return
      }
    }

    // Subir todos los archivos XML seleccionados
    const totalFiles = files.length
    console.log(`📤 Subiendo ${totalFiles} archivo(s) XML...`)

    setUploading(true)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`📤 Subiendo XML ${i + 1}/${totalFiles}: ${file.name}`)

      try {
        const formData = new FormData()
        formData.append('file', file)
        if (nroRendicion.trim()) {
          formData.append('nroRendicion', nroRendicion.trim())
          // Enviar codLocal para cajas chicas
          const codLocal = getCodLocalFromNroRendicion(nroRendicion.trim())
          if (codLocal) {
            formData.append('codLocal', codLocal)
          }
        }
        if (operationType) {
          formData.append('tipoOperacion', operationType)
        }

        const response = await fetch('/api/invoices/upload-xml', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const data = await response.json()
          console.log('✅ XML procesado correctamente:', data)
        } else {
          const error = await response.json()
          console.error('❌ Error procesando XML:', error)
          alert(`Error procesando ${file.name}: ${error.error || 'Error desconocido'}`)
        }
      } catch (error) {
        console.error('❌ Error subiendo XML:', error)
        alert(`Error subiendo ${file.name}`)
      }

      // Pequeña pausa entre uploads para no saturar
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Recargar facturas después de procesar todos los XMLs
    await loadInvoices()
    setUploading(false)

    // Activar polling
    setPollingActive(true)
    setTimeout(() => {
      setPollingActive(false)
    }, 10000)

    // Reset input para permitir subir el mismo archivo nuevamente
    event.target.value = ''
  }

  // Función para guardar cambios en la factura (observación, concepto, rotación)
  const handleSaveInvoice = async () => {
    if (!selectedInvoice) return

    setSavingInvoice(true)
    try {
      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observacion: editingObservacion,
          conceptoGasto: editingConcepto,
          imageRotation,
        }),
      })

      if (response.ok) {
        alert('✅ Cambios guardados correctamente')
        await loadInvoices()
      } else {
        const error = await response.json()
        alert(`❌ Error: ${error.error || 'No se pudo guardar'}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setSavingInvoice(false)
    }
  }

  // Función para asignar factura a rendición o caja chica
  const handleAssignInvoiceTo = async () => {
    if (!selectedInvoice || !assignToType || !assignToNumber) {
      alert('Por favor complete todos los campos')
      return
    }

    setSavingInvoice(true)
    try {
      const response = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoOperacion: assignToType,
          nroRendicion: assignToNumber,
        }),
      })

      if (response.ok) {
        alert(`✅ Factura asignada a ${assignToType === 'RENDICION' ? 'Rendición' : 'Caja Chica'} ${assignToNumber}`)
        setShowAssignToModal(false)
        setAssignToType('')
        setAssignToNumber('')
        await loadInvoices()
      } else {
        const error = await response.json()
        alert(`❌ Error: ${error.error || 'No se pudo asignar'}`)
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setSavingInvoice(false)
    }
  }

  // Función para rotar imagen
  const handleRotateImage = (direction: 'left' | 'right') => {
    setImageRotation(prev => {
      const newRotation = direction === 'right' ? (prev + 90) % 360 : (prev - 90 + 360) % 360
      return newRotation
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm(`¿Estás seguro de eliminar esta ${getDocumentTypeName(false, false)}?`)) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/invoices?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadInvoices()
        setSelectedInvoice(null)
      } else {
        alert(`Error al eliminar la ${getDocumentTypeName(false, false)}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert(`Error al eliminar la ${getDocumentTypeName(false, false)}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} ${getDocumentTypeName(true, false)}?`)) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/invoices?ids=${selectedIds.join(',')}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSelectedIds([])
        setSelectionMode(false)
        await loadInvoices()
      } else {
        alert(`Error al eliminar las ${getDocumentTypeName(true, false)}`)
      }
    } catch (error) {
      console.error('Bulk delete error:', error)
      alert(`Error al eliminar las ${getDocumentTypeName(true, false)}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleAssignNumber = async () => {
    if (!invoiceToAssign || !newNumber) return

    setAssigningNumber(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceToAssign.id}/assign-number`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nroRendicion: newNumber }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ Número asignado exitosamente\n\n${data.message}`)
        setShowAssignNumberModal(false)
        setInvoiceToAssign(null)
        setNewNumber('')
        await loadInvoices()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Assign number error:', error)
      alert('Error al asignar número')
    } finally {
      setAssigningNumber(false)
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const exportToCSV = () => {
    // Preparar datos para CSV
    const csvRows: string[] = []

    // Header
    csvRows.push([
      'ID',
      'Fecha',
      'Estado',
      'RUC Emisor',
      'Razón Social Emisor',
      'Serie-Número',
      'Tipo Documento',
      'Cantidad Items',
      'Item #',
      'Cantidad',
      'Descripción Producto',
      'Código Producto',
      'Precio Unitario',
      'Total Item',
      `Subtotal ${getDocumentTypeName()}`,
      'IGV',
      `Total ${getDocumentTypeName()}`,
      'Moneda',
      'SUNAT Verificado',
      'Estado SUNAT'
    ].join(','))

    // Datos
    filteredInvoices.forEach(invoice => {
      const items = invoice.ocrData?.rawData?.items || []

      if (items.length === 0) {
        // Si no hay items, agregar una fila con datos generales
        csvRows.push([
          invoice.id,
          new Date(invoice.createdAt).toLocaleDateString('es-PE'),
          invoice.status,
          invoice.rucEmisor || '',
          `"${(invoice.razonSocialEmisor || invoice.vendorName || '').replace(/"/g, '""')}"`,
          invoice.serieNumero || invoice.invoiceNumber || '',
          invoice.documentType || '',
          '0',
          '',
          '',
          '',
          '',
          '',
          '',
          invoice.subtotal || '',
          invoice.igvMonto || '',
          invoice.totalAmount || '',
          invoice.currency || 'PEN',
          invoice.sunatVerified === true ? 'SI' : invoice.sunatVerified === false ? 'NO' : 'PENDIENTE',
          invoice.sunatEstadoCp === '1' ? 'VÁLIDO' : invoice.sunatEstadoCp === '0' ? 'NO EXISTE' : invoice.sunatEstadoCp === '2' ? 'ANULADO' : ''
        ].join(','))
      } else {
        // Una fila por cada item
        items.forEach((item: any, idx: number) => {
          csvRows.push([
            invoice.id,
            new Date(invoice.createdAt).toLocaleDateString('es-PE'),
            invoice.status,
            invoice.rucEmisor || '',
            `"${(invoice.razonSocialEmisor || invoice.vendorName || '').replace(/"/g, '""')}"`,
            invoice.serieNumero || invoice.invoiceNumber || '',
            invoice.documentType || '',
            items.length.toString(),
            (idx + 1).toString(),
            item.cantidad || '',
            `"${(item.descripcion || '').replace(/"/g, '""')}"`,
            item.codigoProducto || '',
            item.precioVentaUnitario || item.valorUnitario || '',
            item.totalItem || item.valorVenta || '',
            invoice.subtotal || '',
            invoice.igvMonto || '',
            invoice.totalAmount || '',
            invoice.currency || 'PEN',
            invoice.sunatVerified === true ? 'SI' : invoice.sunatVerified === false ? 'NO' : 'PENDIENTE',
            invoice.sunatEstadoCp === '1' ? 'VÁLIDO' : invoice.sunatEstadoCp === '0' ? 'NO EXISTE' : invoice.sunatEstadoCp === '2' ? 'ANULADO' : ''
          ].join(','))
        })
      }
    })

    // Crear archivo CSV y descargarlo
    const csvContent = csvRows.join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `facturas_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4">
            <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600 font-medium">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Función para determinar si una rendición/caja está cerrada
  // TODO: El criterio exacto se definirá después (puede ser por campo 'cerrada', fecha, estado, etc.)
  const isRendicionCerrada = (inv: Invoice): boolean => {
    // Por ahora retorna false (todas abiertas) hasta que se defina el criterio
    // Posibles criterios futuros:
    // - inv.cerrada === true
    // - inv.estadoCierre === 'CERRADA'
    // - Fecha de cierre pasada
    // - Estado específico del SQL Server
    return false
  }

  const filteredInvoices = invoices
    .filter(inv => {
      if (filter === 'completed') return inv.status === 'COMPLETED'
      if (filter === 'processing') return inv.status === 'PROCESSING' || inv.status === 'PENDING'
      if (filter === 'failed') return inv.status === 'FAILED'
      return true
    })
    .filter(inv => {
      // Filtrar por estado de cierre (abiertas/cerradas)
      if (estadoCierre === 'todas') return true
      if (estadoCierre === 'cerradas') return isRendicionCerrada(inv)
      if (estadoCierre === 'abiertas') return !isRendicionCerrada(inv)
      return true
    })
    // NOTA: Ya no filtramos por tipoOperacion aquí porque la API ya lo hace
    .filter(inv => {
      // Filtrar por caja chica/rendición seleccionada
      if (nroRendicion) {
        // Si hay una caja/rendición seleccionada, solo mostrar documentos vinculados
        // Comparar como strings para evitar problemas de tipo (number vs string)
        // Si la factura no tiene nroRendicion asignado, no la mostramos cuando hay filtro
        if (!inv.nroRendicion) return false
        return String(inv.nroRendicion) === String(nroRendicion)
      }
      // Si no hay selección, mostrar todos
      return true
    })
    .filter(inv => {
      if (!searchQuery) return true
      const search = searchQuery.toLowerCase()

      // Buscar en descripción de productos/ítems
      const items = inv.ocrData?.rawData?.items || []
      const hasMatchInItems = items.some((item: any) =>
        item.descripcion?.toLowerCase().includes(search) ||
        item.codigoProducto?.toLowerCase().includes(search)
      )

      return (
        inv.vendorName?.toLowerCase().includes(search) ||
        inv.invoiceNumber?.toLowerCase().includes(search) ||
        inv.rucEmisor?.includes(search) ||
        inv.razonSocialEmisor?.toLowerCase().includes(search) ||
        inv.serieNumero?.toLowerCase().includes(search) ||
        hasMatchInItems
      )
    })

  // La API ya filtra por tipoOperacion
  const completedCount = invoices.filter(i => i.status === 'COMPLETED').length
  const processingCount = invoices.filter(i => i.status === 'PROCESSING' || i.status === 'PENDING').length

  // Contador de documentos por usuario (por ID para el dropdown)
  // La API ya filtra por tipoOperacion, así que contamos todos los invoices retornados
  const userDocumentCountsById = invoices.reduce((acc, invoice) => {
    const inv = invoice as any
    const odometer = inv.userId || 'unknown'
    acc[odometer] = (acc[odometer] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Contador de documentos por rendición/caja chica
  // La API ya filtra por tipoOperacion, así que solo contamos por nroRendicion
  const rendicionDocumentCounts = invoices.reduce((acc, invoice) => {
    if (invoice.nroRendicion) {
      const key = String(invoice.nroRendicion)
      acc[key] = (acc[key] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  // Mapa para verificar si una caja/rendición está abierta o cerrada
  const rendicionStatusMap = rendiciones.reduce((acc, rend) => {
    acc[String(rend.NroRend)] = rend.CodEstado
    return acc
  }, {} as Record<string, string>)

  // Helper para obtener el estado de una caja/rendición
  const getRendicionStatus = (nroRendicion: string | undefined | null): { isOpen: boolean; label: string; color: string } => {
    if (!nroRendicion) return { isOpen: true, label: '', color: '' }
    const codEstado = rendicionStatusMap[String(nroRendicion)]
    if (codEstado === '00') return { isOpen: true, label: '🟢', color: 'bg-green-100 text-green-800 border-green-300' }
    if (codEstado === '01') return { isOpen: false, label: '🔴', color: 'bg-red-100 text-red-800 border-red-300' }
    // Si no está en el mapa, asumimos que está cerrada o no disponible
    return { isOpen: false, label: '⚪', color: 'bg-gray-100 text-gray-600 border-gray-300' }
  }

  // Diseño limpio y profesional - sin animaciones infantiles
  const getThemeColors = () => {
    // Siempre usa el mismo tema limpio, independiente de la hora
    return {
      bg: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50',
      header: 'bg-white/95',
      headerBorder: 'border-slate-200/60',
      accent: 'from-indigo-600 to-purple-600',
      text: 'text-gray-900',
      textSecondary: 'text-gray-700',
      textMuted: 'text-gray-500',
      card: 'bg-white',
      cardBorder: 'border-slate-200',
      button: 'bg-white hover:bg-slate-50',
      buttonText: 'text-gray-700'
    }
  }

  const theme = getThemeColors()

  return (
    <div className={`min-h-screen relative ${theme.bg}`}>
      {/* Header - Responsive con menú hamburguesa en móvil */}
      <FadeIn duration={1} delay={0}>
      <header className={`${theme.header} backdrop-blur-lg border-b ${theme.headerBorder} sticky top-0 z-40 shadow-sm relative`}>
        <div className="max-w-[1920px] mx-auto px-3 md:px-4 lg:px-6 py-2 md:py-4">
          <div className="flex items-center justify-between">
            {/* Logo y Hamburguesa (Móvil) / Logo normal (Desktop) */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Botón Hamburguesa - Solo Móvil */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden min-w-[44px] min-h-[44px] p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Menú"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              {/* Logo */}
              <div className={`w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br ${theme.accent} rounded-lg md:rounded-xl flex items-center justify-center shadow-lg`}>
                <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-sm md:text-lg font-bold bg-gradient-to-r ${theme.accent} bg-clip-text text-transparent`}>
                  Azaleia Invoice
                </h1>
                <p className={`text-xs ${theme.textMuted} hidden md:block`}>{session.user.organizationName}</p>
              </div>
            </div>

            {/* Usuario - Solo mostrar inicial en móvil */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {session.user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden md:block text-sm font-semibold text-gray-700">
                {session.user.name || session.user.email}
              </span>
            </div>

            {/* Botones - Solo Desktop */}
            <div className="hidden md:flex items-center gap-2">
              {operationType && (
                <button
                  onClick={() => router.push('/select-operation')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    operationType === 'RENDICION'
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : operationType === 'CAJA_CHICA'
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : operationType === 'GASTO_REPARABLE'
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  {operationType === 'RENDICION' ? '📋 Rendicion' : operationType === 'CAJA_CHICA' ? '💰 Caja Chica' : operationType === 'GASTO_REPARABLE' ? '📝 Gasto Rep.' : '🚗 Planilla'}
                </button>
              )}
              {session.user.role === 'APROBADOR' && (
                <button
                  onClick={() => router.push('/aprobacion-planillas')}
                  className={`relative p-2 ${theme.buttonText} hover:text-blue-600 ${theme.button} rounded-lg transition-colors`}
                  title={`Aprobación de Planillas (${pendingPlanillasCount} pendientes)`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {pendingPlanillasCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center animate-pulse">
                      {pendingPlanillasCount}
                    </span>
                  )}
                </button>
              )}
              {session.user.role !== 'APROBADOR' && (
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/planillas-movilidad/mis-planillas')
                      const data = await response.json()
                      if (data.success) {
                        setUserPlanillas(data.planillas || [])
                        setUserPlanillasCount(data.contadores)
                        setShowUserPlanillasModal(true)
                      }
                    } catch (error) {
                      console.error('❌ Error cargando planillas:', error)
                    }
                  }}
                  className={`relative p-2 ${theme.buttonText} ${theme.button} rounded-lg hover:bg-blue-50 transition-colors`}
                  title="Mis Planillas"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {(userPlanillasCount.aprobadas + userPlanillasCount.rechazadas) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                      {userPlanillasCount.aprobadas + userPlanillasCount.rechazadas}
                    </span>
                  )}
                </button>
              )}
              {(session.user.role === 'ORG_ADMIN' || session.user.role === 'SUPER_ADMIN') && (
                <button
                  onClick={() => router.push('/admin')}
                  className={`p-2 ${theme.buttonText} hover:text-indigo-600 ${theme.button} rounded-lg transition-colors`}
                  title="Configuración"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  if (confirm('¿Cerrar sesión?')) {
                    handleLogout()
                  }
                }}
                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Menú Lateral Móvil */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Panel Lateral */}
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-50 md:hidden overflow-y-auto">
            <div className="p-6">
              {/* Header del menú */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    {session.user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{session.user.name}</p>
                    <p className="text-xs text-gray-500">{session.user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Opciones del menú */}
              <div className="space-y-2">
                {/* Cambiar operacion */}
                {operationType && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      router.push('/select-operation')
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors text-left"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      operationType === 'RENDICION' ? 'bg-indigo-100' :
                      operationType === 'CAJA_CHICA' ? 'bg-emerald-100' :
                      operationType === 'GASTO_REPARABLE' ? 'bg-rose-100' : 'bg-amber-100'
                    }`}>
                      <span className="text-xl">
                        {operationType === 'RENDICION' ? '📋' : operationType === 'CAJA_CHICA' ? '💰' : operationType === 'GASTO_REPARABLE' ? '📝' : '🚗'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Cambiar Operacion</p>
                      <p className="text-xs text-gray-500">
                        {operationType === 'RENDICION' ? 'Rendicion' : operationType === 'CAJA_CHICA' ? 'Caja Chica' : operationType === 'GASTO_REPARABLE' ? 'Gasto Reparable' : 'Planilla Movilidad'}
                      </p>
                    </div>
                  </button>
                )}

                {/* Mis Planillas */}
                {session.user.role !== 'APROBADOR' && (
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/planillas-movilidad/mis-planillas')
                        const data = await response.json()
                        if (data.success) {
                          setUserPlanillas(data.planillas || [])
                          setUserPlanillasCount(data.contadores)
                          setMobileMenuOpen(false)
                          setShowUserPlanillasModal(true)
                        }
                      } catch (error) {
                        console.error('Error:', error)
                      }
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors text-left relative"
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Mis Planillas</p>
                      <p className="text-xs text-gray-500">
                        {userPlanillasCount.pendientes} pendientes, {userPlanillasCount.aprobadas} aprobadas
                      </p>
                    </div>
                    {(userPlanillasCount.aprobadas + userPlanillasCount.rechazadas) > 0 && (
                      <span className="bg-blue-500 text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center">
                        {userPlanillasCount.aprobadas + userPlanillasCount.rechazadas}
                      </span>
                    )}
                  </button>
                )}

                {/* Aprobación de Planillas */}
                {session.user.role === 'APROBADOR' && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      router.push('/aprobacion-planillas')
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors text-left relative"
                  >
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Aprobación</p>
                      <p className="text-xs text-gray-500">Planillas pendientes</p>
                    </div>
                    {pendingPlanillasCount > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-2 flex items-center justify-center animate-pulse">
                        {pendingPlanillasCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Configuración */}
                {(session.user.role === 'ORG_ADMIN' || session.user.role === 'SUPER_ADMIN') && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false)
                      router.push('/admin')
                    }}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 rounded-xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Configuración</p>
                      <p className="text-xs text-gray-500">Ajustes del sistema</p>
                    </div>
                  </button>
                )}

                {/* Cerrar Sesión */}
                <button
                  onClick={() => {
                    if (confirm('¿Cerrar sesión?')) {
                      setMobileMenuOpen(false)
                      handleLogout()
                    }
                  }}
                  className="w-full flex items-center gap-3 p-4 hover:bg-red-50 rounded-xl transition-colors text-left mt-4"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-600">Cerrar Sesión</p>
                    <p className="text-xs text-red-400">Salir del sistema</p>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
      </FadeIn>

      {/* Main content */}
      <main className="max-w-[1920px] mx-auto px-3 md:px-4 lg:px-6 py-3 md:py-6 pb-24 md:pb-6">
        {/* N° Rendición - Compacto para móviles - Ocultar para PLANILLA_MOVILIDAD */}
        {operationType !== 'PLANILLA_MOVILIDAD' && operationType !== 'GASTO_REPARABLE' && (
        <SlideUp delay={0.3}>
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl md:rounded-2xl p-3 md:p-4 mb-4 md:mb-6 shadow-lg">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 md:w-7 md:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="nroRendicionGlobal" className="block text-xs md:text-sm font-bold text-gray-900 mb-1">
                {operationType === 'RENDICION' ? '📋 N° de Rendición' : operationType === 'CAJA_CHICA' ? '💰 N° de Caja Chica' : '🚗 Planilla Movilidad'} {loadingRendiciones && <span className="text-gray-500 text-xs">(Cargando...)</span>}
              </label>
              <select
                id="nroRendicionGlobal"
                value={nroRendicion}
                onChange={(e) => setNroRendicion(e.target.value)}
                className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-yellow-400 rounded-lg md:rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm md:text-base text-gray-900 font-semibold bg-white"
                disabled={loadingRendiciones}
              >
                <option value="">📋 Ver todos los documentos ({invoices.length})</option>
                {rendiciones.map((rend) => {
                  const docCount = rendicionDocumentCounts[String(rend.NroRend)] || 0
                  const estadoLabel = rend.CodEstado === '00' ? '🟢 Abierta' : '🔴 Cerrada'
                  return (
                    <option key={rend.NroRend} value={rend.NroRend}>
                      {operationType === 'RENDICION'
                        ? `${estadoLabel} - Rendición N° ${rend.NroRend}${rend.CodUserAsg ? ` (${rend.CodUserAsg})` : ''} - ${docCount} docs`
                        : `${estadoLabel} - ${rend.CodLocal || '-'} - ${rend.NroRend} - ${rend.DesEmpresa || 'Sin empresa'} (${docCount} docs)`
                      }
                    </option>
                  )
                })}
              </select>
              <p className="text-xs text-gray-600 mt-1 hidden md:block">
                {rendiciones.length === 0 && !loadingRendiciones ? (
                  <span className="text-orange-600">⚠️ No tienes {operationType === 'RENDICION' ? 'rendiciones' : 'cajas chicas'} pendientes (Estado 00) en SQL Server</span>
                ) : nroRendicion ? (
                  <span>🔍 Mostrando solo documentos de {operationType === 'RENDICION' ? 'Rendición' : 'Caja Chica'} N° {nroRendicion}</span>
                ) : (
                  <span>✅ Selecciona una {operationType === 'RENDICION' ? 'rendición' : 'caja chica'} para filtrar documentos</span>
                )}
              </p>
            </div>
          </div>
        </div>
        </SlideUp>
        )}

        {/* Stats - Solo texto compacto */}
        <ScaleIn delay={0.5}>
        <div className="flex items-center gap-4 mb-3 px-1 text-sm">
          <span className="flex items-center gap-1.5 text-green-700 font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {completedCount}
          </span>
          <span className="flex items-center gap-1.5 text-orange-600 font-semibold">
            <svg className="w-4 h-4 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {processingCount}
          </span>
        </div>
        </ScaleIn>

        {/* Filters - Ultra compacto */}
        <SlideUp delay={0.7}>
        <div className="space-y-2 mb-3">
          {/* Fila 1: Búsqueda + Usuario */}
          <div className="flex gap-2">
            {/* Search */}
            <div className="flex-1 relative">
              <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900 bg-white"
              />
            </div>

            {/* User Filter - Solo para admins - CON CONTADOR DE DOCS */}
            {!['USER_L1', 'USER_L2'].includes(session?.user?.role || '') && users.length > 0 && (
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-gray-900 bg-white font-semibold"
              >
                <option value="all">👤 Todos ({invoices.length} docs)</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    👤 {user.name?.split(' ')[0] || user.email.split('@')[0]} ({userDocumentCountsById[user.id] || 0} docs)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Fila 2: Filtros de estado */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'Todas', icon: '📋' },
              { id: 'completed', label: 'OK', icon: '✅' },
              { id: 'processing', label: 'Proc', icon: '⏳' },
              { id: 'failed', label: 'Error', icon: '❌' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  filter === f.id
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
            <button
              onClick={() => {
                setSelectionMode(!selectionMode)
                setSelectedIds([])
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectionMode
                  ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {selectionMode ? '❌' : '📌'}
            </button>
          </div>

          {/* Fila 3: Filtro Abiertas/Cerradas - Solo para Rendiciones y Cajas Chicas */}
          {(operationType === 'RENDICION' || operationType === 'CAJA_CHICA') && (
            <div className="flex gap-1.5 pt-1">
              {[
                { id: 'abiertas', label: 'Abiertas', icon: '🔓', color: 'from-green-600 to-emerald-600' },
                { id: 'cerradas', label: 'Cerradas', icon: '🔒', color: 'from-gray-600 to-slate-600' },
                { id: 'todas', label: 'Todas', icon: '📂', color: 'from-indigo-600 to-purple-600' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setEstadoCierre(f.id as 'todas' | 'abiertas' | 'cerradas')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    estadoCierre === f.id
                      ? `bg-gradient-to-r ${f.color} text-white shadow-lg`
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        </SlideUp>

        {/* Bulk Actions - Compacto */}
        {selectionMode && selectedIds.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <span className="text-xs font-semibold text-red-700">
              {selectedIds.length} seleccionada{selectedIds.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg text-xs font-semibold hover:from-red-700 hover:to-pink-700 disabled:opacity-50 transition-all"
            >
              {deleting ? 'Eliminando...' : `🗑️ Eliminar`}
            </button>
          </div>
        )}

        {/* Invoices list */}
        <div>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-sm md:text-lg font-bold text-gray-900 flex items-center gap-1.5 min-w-0">
              <svg className="w-4 h-4 md:w-5 md:h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate hidden sm:inline">
                {filter === 'all' ? `Todas las ${getDocumentTypeName(true)}` : filter === 'completed' ? `${getDocumentTypeName(true)} Completadas` : filter === 'processing' ? `${getDocumentTypeName(true)} en Procesamiento` : `${getDocumentTypeName(true)} con Error`}
              </span>
              <span className="sm:hidden truncate">{getDocumentTypeName(true)}</span>
              <span className="text-xs md:text-sm text-gray-500 flex-shrink-0">({operationType === 'PLANILLA_MOVILIDAD' ? planillas.length : filteredInvoices.length})</span>
            </h2>

            {/* View Mode Toggle & Export */}
            <div className="flex gap-1 md:gap-2 items-center flex-shrink-0">
              {/* Export Button */}
              {viewMode === 'table' && filteredInvoices.length > 0 && (
                <button
                  onClick={exportToCSV}
                  className="hidden md:flex px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg items-center gap-2"
                  title="Exportar a CSV/Excel"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar CSV
                </button>
              )}

              {/* View Toggle - Compacto en móvil */}
              <div className="flex gap-1 bg-white rounded-lg md:rounded-xl border border-gray-200 md:border-2 p-0.5 md:p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-2 md:px-4 py-1.5 md:py-2 rounded-md md:rounded-lg text-xs md:text-base font-semibold transition-all flex items-center gap-1 md:gap-2 ${
                    viewMode === 'cards'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="hidden sm:inline">Tarjetas</span>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-2 md:px-4 py-1.5 md:py-2 rounded-md md:rounded-lg text-xs md:text-base font-semibold transition-all flex items-center gap-1 md:gap-2 ${
                    viewMode === 'table'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Tabla</span>
                </button>
              </div>

              {/* Column Selector - Solo visible en vista de tarjetas y en pantallas grandes */}
              {viewMode === 'cards' && (
                <div className="hidden lg:flex gap-1 bg-white rounded-xl border-2 border-gray-200 p-1">
                  {[4, 5, 6].map((cols) => (
                    <button
                      key={cols}
                      onClick={() => setColumnCount(cols as 4 | 5 | 6)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        columnCount === cols
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      title={`${cols} columnas`}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(operationType === 'PLANILLA_MOVILIDAD' ? planillas.length === 0 : filteredInvoices.length === 0) ? (
            <div className={`${theme.card} backdrop-blur-sm rounded-3xl p-12 text-center border ${theme.cardBorder} shadow-sm`}>
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className={`${theme.textSecondary} font-semibold mb-2`}>
                {nroRendicion
                  ? `No hay documentos en ${operationType === 'RENDICION' ? 'Rendición' : 'Caja Chica'} N° ${nroRendicion}`
                  : `No hay ${getDocumentTypeName(true, false)} que mostrar`
                }
              </p>
              <p className={`text-sm ${theme.textMuted}`}>
                {nroRendicion
                  ? 'Esta caja/rendición no tiene documentos asignados aún'
                  : searchQuery
                    ? 'Intenta con otra búsqueda'
                    : `Crea tu primera ${getDocumentTypeName(false, false)} para empezar`
                }
              </p>
            </div>
          ) : viewMode === 'table' ? (
            operationType === 'PLANILLA_MOVILIDAD' ? (
              /* TABLE VIEW - PLANILLAS DE MOVILIDAD */
              <div className={`${theme.card} backdrop-blur-sm rounded-2xl overflow-hidden border ${theme.cardBorder} shadow-sm`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Estado</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">N° Planilla</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Razón Social</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">RUC</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Periodo</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Fecha Emisión</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Nombres y Apellidos</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Cargo</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">DNI</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Centro Costo</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Tipo Operación</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">N° Destino</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Total Viaje</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Total Día</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider">Total General</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Creado por</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider">Fecha Creación</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {planillas.map((planilla, idx) => (
                        <tr
                          key={planilla.id}
                          className="hover:bg-blue-50 transition-colors"
                          style={{ animationDelay: `${idx * 0.02}s` }}
                        >
                          <td className="px-3 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                              planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                                ? 'bg-yellow-100 text-yellow-800'
                                : planilla.estadoAprobacion === 'APROBADA'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {planilla.estadoAprobacion === 'PENDIENTE_APROBACION' ? 'PENDIENTE' : planilla.estadoAprobacion}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">{planilla.nroPlanilla || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">{planilla.razonSocial || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap font-mono">{planilla.ruc || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">{planilla.periodo || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">
                            {planilla.fechaEmision ? new Date(planilla.fechaEmision).toLocaleDateString('es-PE') : 'N/A'}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-900 font-medium whitespace-nowrap">{planilla.nombresApellidos}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">{planilla.cargo}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap font-mono">{planilla.dni}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">{planilla.centroCosto || '-'}</td>
                          <td className="px-3 py-3 text-xs whitespace-nowrap">
                            {planilla.tipoOperacion ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                planilla.tipoOperacion === 'RENDICION'
                                  ? 'bg-blue-100 text-blue-800'
                                  : planilla.tipoOperacion === 'CAJA_CHICA'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {planilla.tipoOperacion === 'RENDICION' ? '📋 Rendición' : planilla.tipoOperacion === 'CAJA_CHICA' ? '💰 Caja Chica' : planilla.tipoOperacion}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs whitespace-nowrap">
                            {(planilla.tipoOperacion === 'RENDICION' && planilla.nroRendicion) || (planilla.tipoOperacion === 'CAJA_CHICA' && planilla.nroCajaChica) ? (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                                planilla.tipoOperacion === 'CAJA_CHICA'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}>
                                {planilla.tipoOperacion === 'CAJA_CHICA' ? '💰' : '📋'} {planilla.tipoOperacion === 'RENDICION' ? planilla.nroRendicion : planilla.nroCajaChica}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                                ⚠️ Sin asignar
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-gray-900 font-medium whitespace-nowrap">
                            S/ {planilla.totalViaje?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-gray-900 font-medium whitespace-nowrap">
                            S/ {planilla.totalDia?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-gray-900 font-bold text-blue-600 whitespace-nowrap">
                            S/ {planilla.totalGeneral?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">{planilla.user?.name || planilla.user?.email || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-900 whitespace-nowrap">
                            {new Date(planilla.createdAt).toLocaleDateString('es-PE')}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/planillas-movilidad/${planilla.id}`)
                                    const data = await response.json()
                                    if (data.success) {
                                      setSelectedPlanilla(data.planilla)
                                      setShowPlanillaDetailModal(true)
                                    }
                                  } catch (error) {
                                    console.error('Error cargando planilla:', error)
                                  }
                                }}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors"
                                title="Ver detalle"
                              >
                                👁️
                              </button>
                              {planilla.estadoAprobacion === 'PENDIENTE_APROBACION' && (session?.user?.role === 'APROBADOR' || session?.user?.role === 'SUPER_ADMIN') && (
                                <>
                                  <button
                                    onClick={async () => {
                                      if (confirm('¿Está seguro de aprobar esta planilla?')) {
                                        try {
                                          const response = await fetch(`/api/planillas-movilidad/${planilla.id}/aprobar`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ accion: 'APROBAR', comentarios: null })
                                          })
                                          const data = await response.json()
                                          if (data.success) {
                                            alert('Planilla aprobada correctamente')
                                            loadPlanillas()
                                          } else {
                                            alert('Error: ' + data.error)
                                          }
                                        } catch (error) {
                                          console.error('Error aprobando planilla:', error)
                                          alert('Error al aprobar planilla')
                                        }
                                      }
                                    }}
                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors"
                                    title="Aprobar"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const comentario = prompt('Ingrese comentarios (requerido para rechazar):')
                                      if (comentario && comentario.trim()) {
                                        if (confirm('¿Está seguro de rechazar esta planilla?')) {
                                          try {
                                            const response = await fetch(`/api/planillas-movilidad/${planilla.id}/aprobar`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ accion: 'RECHAZAR', comentarios: comentario })
                                            })
                                            const data = await response.json()
                                            if (data.success) {
                                              alert('Planilla rechazada correctamente')
                                              loadPlanillas()
                                            } else {
                                              alert('Error: ' + data.error)
                                            }
                                          } catch (error) {
                                            console.error('Error rechazando planilla:', error)
                                            alert('Error al rechazar planilla')
                                          }
                                        }
                                      } else if (comentario !== null) {
                                        alert('Debe ingresar comentarios para rechazar')
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                                    title="Rechazar"
                                  >
                                    ✗
                                  </button>
                                </>
                              )}
                              {planilla.estadoAprobacion === 'APROBADA' && (
                                <button
                                  onClick={() => window.open(`/planillas-movilidad/${planilla.id}/print`, '_blank')}
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors"
                                  title="Imprimir"
                                >
                                  🖨️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* TABLE VIEW - FACTURAS/RENDICIONES/CAJAS CHICAS */
              <div className={`${theme.card} backdrop-blur-sm rounded-2xl overflow-hidden border ${theme.cardBorder} shadow-sm`}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                      <tr>
                        {selectionMode && (
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                            <input
                              type="checkbox"
                              checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(filteredInvoices.map(inv => inv.id))
                                } else {
                                  setSelectedIds([])
                                }
                              }}
                              className="w-4 h-4 text-indigo-600 border-white rounded focus:ring-white"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Estado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Emisor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">RUC Emisor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Serie-Número</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Tipo Doc</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">N° Caja/Rend</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Descripción / Ítems</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Subtotal</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">IGV</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">SUNAT</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Creado por</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Comentarios</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredInvoices.map((invoice, idx) => (
                      <tr
                        key={invoice.id}
                        className={`hover:bg-indigo-50 transition-colors animate-fade-in ${
                          selectedIds.includes(invoice.id) ? 'bg-indigo-100' : ''
                        }`}
                        style={{ animationDelay: `${idx * 0.02}s` }}
                      >
                        {selectionMode && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(invoice.id)}
                              onChange={() => toggleSelection(invoice.id)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                invoice.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-800'
                                  : invoice.status === 'PROCESSING'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {invoice.status === 'COMPLETED'
                                ? '✓ OK'
                                : invoice.status === 'PROCESSING'
                                ? '⏳ Proc'
                                : '✗ Error'}
                            </span>
                            {invoice.isDuplicate && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                🔴 DUP
                              </span>
                            )}
                            {(invoice.tipoOperacion === 'RENDICION' || invoice.tipoOperacion === 'CAJA_CHICA') && !invoice.nroRendicion && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setInvoiceToAssign(invoice)
                                  setShowAssignNumberModal(true)
                                }}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors cursor-pointer"
                                title="Click para asignar número"
                              >
                                ⚠️ Sin # →
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {new Date(invoice.createdAt).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium max-w-xs truncate">
                          {invoice.vendorName || invoice.razonSocialEmisor || 'Procesando...'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                          {invoice.rucEmisor || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono font-semibold">
                          {invoice.invoiceNumber || invoice.serieNumero || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {invoice.documentType || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          {invoice.nroRendicion ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getRendicionStatus(invoice.nroRendicion).color || 'bg-blue-100 text-blue-800'}`}>
                              {getRendicionStatus(invoice.nroRendicion).label} {invoice.tipoOperacion === 'CAJA_CHICA' ? '💰' : '📋'} {invoice.nroRendicion}
                              {!getRendicionStatus(invoice.nroRendicion).isOpen && <span className="ml-1 text-[10px]">(Cerrada)</span>}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                          {(() => {
                            // Extraer items del ocrData
                            const items = invoice.ocrData?.rawData?.items || []

                            if (items.length === 0) {
                              return <span className="text-gray-400 italic">Sin descripción</span>
                            }

                            // Mostrar los primeros 2 items
                            const itemsToShow = items.slice(0, 2)
                            const remainingCount = items.length - itemsToShow.length

                            return (
                              <div className="group relative">
                                <div className="space-y-1">
                                  {itemsToShow.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <span className="text-indigo-600 font-semibold text-xs">
                                        {item.cantidad}x
                                      </span>
                                      <span className="truncate text-xs">
                                        {item.descripcion || 'Sin descripción'}
                                      </span>
                                    </div>
                                  ))}
                                  {remainingCount > 0 && (
                                    <div className="text-xs text-indigo-600 font-semibold">
                                      ... y {remainingCount} más
                                    </div>
                                  )}
                                </div>

                                {/* Tooltip con todos los items al hacer hover */}
                                {items.length > 0 && (
                                  <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 bg-gray-900 text-white p-4 rounded-lg shadow-2xl min-w-[300px] max-w-[500px]">
                                    <div className="font-bold text-xs mb-3 text-indigo-300 uppercase flex items-center justify-between">
                                      <span>Todos los ítems ({items.length})</span>
                                      <span className="text-gray-400 font-normal normal-case text-xs">
                                        🔥 = Precio alto
                                      </span>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                      {(() => {
                                        // Calcular precio promedio para identificar items caros
                                        const totalItems = items.reduce((sum: number, item: any) =>
                                          sum + (item.totalItem || item.valorVenta || 0), 0
                                        )
                                        const avgPrice = totalItems / items.length
                                        const highPriceThreshold = avgPrice * 1.5 // 50% más que el promedio

                                        return items.map((item: any, idx: number) => {
                                          const itemTotal = item.totalItem || item.valorVenta || 0
                                          const isExpensive = itemTotal > highPriceThreshold && itemTotal > 100
                                          const precioUnitario = item.precioVentaUnitario || item.valorUnitario || (itemTotal / (item.cantidad || 1))

                                          return (
                                            <div
                                              key={idx}
                                              className={`border-b border-gray-700 pb-2 ${
                                                isExpensive ? 'bg-gradient-to-r from-orange-900/30 to-red-900/30 p-2 rounded-lg border-l-4 border-orange-500' : ''
                                              }`}
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1">
                                                  <div className="flex items-center gap-2 mb-1">
                                                    <span className={`${
                                                      isExpensive ? 'bg-gradient-to-r from-orange-600 to-red-600' : 'bg-indigo-600'
                                                    } text-white px-2 py-0.5 rounded text-xs font-bold`}>
                                                      {item.cantidad}x
                                                    </span>
                                                    <span className="text-sm font-semibold flex items-center gap-1">
                                                      {item.descripcion || 'Sin descripción'}
                                                      {isExpensive && <span title="Precio alto">🔥</span>}
                                                    </span>
                                                  </div>
                                                  {item.codigoProducto && (
                                                    <div className="text-xs text-gray-400 ml-8">
                                                      📦 Código: {item.codigoProducto}
                                                    </div>
                                                  )}
                                                  {item.unidadMedida && (
                                                    <div className="text-xs text-gray-400 ml-8">
                                                      📏 Unidad: {item.unidadMedida}
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="text-right">
                                                  {precioUnitario > 0 && (
                                                    <div className={`text-xs font-semibold mb-1 ${
                                                      isExpensive ? 'text-orange-400' : 'text-blue-400'
                                                    }`}>
                                                      💰 Unit: {invoice.currency || 'S/'} {precioUnitario.toFixed(2)}
                                                    </div>
                                                  )}
                                                  <div className={`text-sm font-bold ${
                                                    isExpensive ? 'text-orange-400 text-base' : 'text-green-400'
                                                  }`}>
                                                    {invoice.currency || 'S/'} {itemTotal.toFixed(2)}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )
                                        })
                                      })()}
                                    </div>
                                    {/* Footer con total */}
                                    <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                                      <span className="text-xs text-gray-400 font-semibold uppercase">Total {getDocumentTypeName()}:</span>
                                      <span className="text-lg font-bold text-green-400">
                                        {invoice.currency || 'S/'} {invoice.totalAmount?.toFixed(2) || '0.00'}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                          {invoice.subtotal ? `${invoice.currency || 'S/'} ${invoice.subtotal.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                          {invoice.igvMonto ? `${invoice.currency || 'S/'} ${invoice.igvMonto.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right font-mono">
                          {invoice.totalAmount ? `${invoice.currency || 'S/'} ${invoice.totalAmount.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {invoice.sunatVerified === true ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                              ✓ Válido
                            </span>
                          ) : invoice.sunatVerified === false && invoice.sunatEstadoCp === '0' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              ✗ No Existe
                            </span>
                          ) : invoice.sunatVerified === false && invoice.sunatEstadoCp === '2' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                              ⊘ Anulado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                              ⏳ Pend
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {invoice.user?.name || invoice.user?.email || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                          {invoice.observacion || invoice.glosaEditada ? (
                            <div className="group relative">
                              <span className="truncate block max-w-[150px]" title={invoice.observacion || invoice.glosaEditada || ''}>
                                {invoice.observacion || invoice.glosaEditada}
                              </span>
                              {/* Tooltip con comentario completo al hacer hover */}
                              <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 bg-gray-900 text-white p-3 rounded-lg shadow-2xl min-w-[200px] max-w-[350px]">
                                <div className="font-bold text-xs mb-2 text-indigo-300 uppercase">Comentarios</div>
                                <p className="text-sm whitespace-pre-wrap">{invoice.observacion || invoice.glosaEditada}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Sin comentarios</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedInvoice(invoice)}
                              className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                              title="Ver detalles"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setSelectedInvoice(invoice)}
                              className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(invoice.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )
          ) : operationType === 'PLANILLA_MOVILIDAD' ? (
            /* CARDS VIEW - PLANILLAS DE MOVILIDAD */
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 ${
              columnCount === 4 ? 'lg:grid-cols-4' :
              columnCount === 5 ? 'lg:grid-cols-4 xl:grid-cols-5' :
              'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
            }`}>
              {planillas.map((planilla, idx) => (
                <SlideUp key={planilla.id} delay={0.9 + idx * 0.08}>
                <AnimatedCard
                  className={`${theme.card} backdrop-blur-sm rounded-2xl overflow-hidden border ${theme.cardBorder} shadow-sm relative`}
                  onClick={async () => {
                    // Cargar detalles completos de la planilla
                    try {
                      const response = await fetch(`/api/planillas-movilidad/${planilla.id}`)
                      const data = await response.json()
                      if (data.success) {
                        setSelectedPlanilla(data.planilla)
                        setShowPlanillaDetailModal(true)
                      }
                    } catch (error) {
                      console.error('Error cargando planilla:', error)
                    }
                  }}
                >
                  <div>
                    {/* Imagen o icono de planilla */}
                    <div className="relative h-48 bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center">
                      {planilla.imageUrl ? (
                        <img
                          src={planilla.imageUrl}
                          alt="Planilla"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-indigo-400">
                          <svg className="w-20 h-20 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm font-semibold">Planilla de Movilidad</p>
                        </div>
                      )}

                      {/* Badge de estado de aprobación */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                        <span
                          className={`text-xs font-bold px-3 py-2 rounded-full backdrop-blur-sm shadow-lg flex items-center gap-1.5 ${
                            planilla.estadoAprobacion === 'APROBADA'
                              ? 'bg-green-500/90 text-white'
                              : planilla.estadoAprobacion === 'RECHAZADA'
                              ? 'bg-red-500/90 text-white'
                              : 'bg-yellow-500/90 text-white animate-pulse'
                          }`}
                        >
                          {planilla.estadoAprobacion === 'APROBADA' ? (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Aprobado
                            </>
                          ) : planilla.estadoAprobacion === 'RECHAZADA' ? (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              Rechazado
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              En espera de aprobación
                            </>
                          )}
                        </span>

                        {/* 🆕 Badge de tipo de operación */}
                        {planilla.estadoAprobacion === 'APROBADA' && (
                          <span
                            className={`text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm shadow-lg flex items-center gap-1.5 ${
                              planilla.tipoOperacion
                                ? planilla.tipoOperacion === 'RENDICION'
                                  ? 'bg-indigo-500/90 text-white'
                                  : 'bg-emerald-500/90 text-white'
                                : 'bg-orange-500/90 text-white'
                            }`}
                          >
                            {planilla.tipoOperacion ? (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {planilla.tipoOperacion === 'RENDICION' ? 'Rendición' : 'Caja Chica'}
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Sin asignar
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Información de la planilla */}
                    <div className="p-4">
                      <h3 className={`font-bold ${theme.text} text-base mb-1 truncate`}>
                        {planilla.nombresApellidos}
                      </h3>
                      <p className={`text-xs ${theme.textMuted} mb-1`}>
                        {planilla.cargo || 'Sin cargo'}
                      </p>
                      <p className={`text-xs ${theme.textMuted} mb-3`}>
                        DNI: {planilla.dni}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${theme.textMuted}`}>
                          {new Date(planilla.createdAt).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <p className="font-bold text-indigo-600 text-lg">
                          S/ {planilla.totalGeneral.toFixed(2)}
                        </p>
                      </div>
                      {planilla.aprobadoPor && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className={`text-xs ${theme.textMuted}`}>
                            Aprobado por: <span className="font-semibold">{planilla.aprobadoPor.name}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedCard>
                </SlideUp>
              ))}
            </div>
          ) : (
            /* CARDS VIEW - FACTURAS/RENDICIONES/CAJAS CHICAS */
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 ${
              columnCount === 4 ? 'lg:grid-cols-4' :
              columnCount === 5 ? 'lg:grid-cols-4 xl:grid-cols-5' :
              'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
            }`}>
              {filteredInvoices.map((invoice, idx) => (
                <SlideUp key={invoice.id} delay={0.9 + idx * 0.08}>
                <AnimatedCard
                  className={`${theme.card} backdrop-blur-sm rounded-2xl overflow-hidden border ${theme.cardBorder} shadow-sm relative`}
                  onClick={() => !selectionMode && setSelectedInvoice(invoice)}
                >
                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div className="absolute top-3 left-3 z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(invoice.id)}
                        onChange={() => toggleSelection(invoice.id)}
                        className="w-6 h-6 text-indigo-600 border-2 border-white rounded-lg focus:ring-indigo-500 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}

                    <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <img
                        src={invoice.thumbnailUrl || invoice.imageUrl}
                        alt="Invoice"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          // Si falla el thumbnail, intentar con la imagen original
                          if (invoice.thumbnailUrl && img.src.includes('-thumb.jpg')) {
                            img.src = invoice.imageUrl
                            return
                          }
                          img.style.display = 'none'
                          const parent = img.parentElement
                          if (parent && !parent.querySelector('.error-placeholder')) {
                            const placeholder = document.createElement('div')
                            placeholder.className = 'error-placeholder flex flex-col items-center justify-center text-gray-400'
                            placeholder.innerHTML = `
                              <svg class="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                              </svg>
                              <p class="text-sm">Imagen no disponible</p>
                            `
                            parent.appendChild(placeholder)
                          }
                        }}
                      />
                      <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                        <span
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm ${
                            invoice.status === 'COMPLETED'
                              ? 'bg-green-500/90 text-white'
                              : invoice.status === 'PROCESSING'
                              ? 'bg-yellow-500/90 text-white animate-pulse'
                              : 'bg-red-500/90 text-white'
                          }`}
                        >
                          {invoice.status === 'COMPLETED'
                            ? '✓ Completado'
                            : invoice.status === 'PROCESSING'
                            ? '⏳ Procesando'
                            : '✗ Error'}
                        </span>
                        {/* Badge de verificación SUNAT */}
                        {invoice.sunatVerified === true && (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-600/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            SUNAT
                          </span>
                        )}
                        {invoice.sunatVerified === false && invoice.sunatEstadoCp === '0' && (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-700/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg animate-pulse">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            NO EXISTE
                          </span>
                        )}
                        {invoice.sunatVerified === false && invoice.sunatEstadoCp === '2' && (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-600/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                            </svg>
                            ANULADO
                          </span>
                        )}
                        {invoice.sunatVerified === false && invoice.sunatEstadoCp !== '0' && invoice.sunatEstadoCp !== '2' && (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-600/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            No válido
                          </span>
                        )}
                        {/* Badge de DUPLICADO (alerta roja) */}
                        {invoice.isDuplicate && (
                          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-600/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg animate-pulse">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            DUPLICADO
                          </span>
                        )}
                        {/* Badge de Rendición/Caja Chica asignada con estado */}
                        {invoice.nroRendicion && (
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1 shadow-lg ${
                            getRendicionStatus(invoice.nroRendicion).isOpen
                              ? 'bg-green-600/90 text-white'
                              : 'bg-red-600/90 text-white'
                          }`}>
                            {getRendicionStatus(invoice.nroRendicion).label} {invoice.tipoOperacion === 'CAJA_CHICA' ? '💰' : '📋'} {invoice.nroRendicion}
                            {!getRendicionStatus(invoice.nroRendicion).isOpen && <span className="text-[10px] opacity-80">(Cerrada)</span>}
                          </span>
                        )}
                        {/* Badge de Sin Número (alerta naranja) */}
                        {(invoice.tipoOperacion === 'RENDICION' || invoice.tipoOperacion === 'CAJA_CHICA') && !invoice.nroRendicion && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setInvoiceToAssign(invoice)
                              setShowAssignNumberModal(true)
                            }}
                            className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-600/90 hover:bg-orange-700/90 text-white backdrop-blur-sm flex items-center gap-1 shadow-lg transition-colors cursor-pointer"
                            title="Click para asignar número"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            SIN # →
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className={`font-bold ${theme.text} text-sm mb-1 truncate`}>
                        {invoice.vendorName || invoice.razonSocialEmisor || 'Procesando...'}
                      </h3>
                      <p className={`text-xs ${theme.textMuted} mb-1 truncate`}>
                        {invoice.invoiceNumber || invoice.serieNumero || 'N/A'}
                      </p>
                      {invoice.rucEmisor && (
                        <p className={`text-xs ${theme.textMuted} mb-1 truncate`}>
                          RUC: {invoice.rucEmisor}
                        </p>
                      )}
                      {invoice.user?.name && (
                        <p className={`text-xs ${theme.textMuted} mb-3 truncate flex items-center gap-1`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Subido por: {invoice.user.name}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${theme.textMuted}`}>
                          {new Date(invoice.createdAt).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                        {invoice.totalAmount && (
                          <p className="font-bold text-indigo-600">
                            {invoice.currency || 'S/'} {invoice.totalAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                </AnimatedCard>
                </SlideUp>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Buttons - Solo en vista de tarjetas */}
      {viewMode === 'cards' && (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-30 md:bottom-8">
          <div className="max-w-[1920px] mx-auto flex gap-2 md:gap-3">
            <button
              onClick={() => {
                if (operationType === 'PLANILLA_MOVILIDAD') {
                  setShowMovilidadForm(true)
                } else if (operationType === 'GASTO_REPARABLE') {
                  setShowGastoReparableForm(true)
                } else {
                  setShowCamera(true)
                }
              }}
              disabled={uploading}
              className={`flex-1 ${operationType === 'PLANILLA_MOVILIDAD' ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700' : operationType === 'GASTO_REPARABLE' ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'} text-white py-3 md:py-4 rounded-xl md:rounded-2xl text-sm md:text-base font-semibold disabled:opacity-50 shadow-2xl flex items-center justify-center gap-1 md:gap-2 transform hover:scale-[1.02] active:scale-[0.98] transition-all`}
            >
              {operationType === 'PLANILLA_MOVILIDAD' ? (
                <>
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                  <span className="hidden sm:inline">Nueva Planilla</span>
                </>
              ) : operationType === 'GASTO_REPARABLE' ? (
                <>
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Nuevo Gasto</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="hidden sm:inline">{uploading ? 'Procesando...' : 'Foto'}</span>
                </>
              )}
            </button>

            <label className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl text-sm md:text-base font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 shadow-2xl flex items-center justify-center gap-1 md:gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] transition-all">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Imagen</span>
            </label>

            {/* TEMPORALMENTE DESHABILITADO - Botón XML */}
            {/* <label className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl text-sm md:text-base font-semibold hover:from-orange-700 hover:to-red-700 disabled:opacity-50 shadow-2xl flex items-center justify-center gap-1 md:gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] transition-all">
              <input
                type="file"
                accept=".xml"
                multiple
                onChange={handleXMLFileSelect}
                disabled={uploading}
                className="hidden"
              />
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">XML</span>
            </label> */}
          </div>
        </div>
      )}

      {/* Camera modal - Condicional móvil/desktop */}
      {showCamera && (
        isMobile ? (
          <MobileCameraCapture
            onCapture={handleMultiCapture}
            onCancel={() => setShowCamera(false)}
          />
        ) : (
          <CameraCapture
            onCapture={handleMultiCapture}
            onCancel={() => setShowCamera(false)}
          />
        )
      )}

      {/* Multi Upload Progress */}
      {showMultiUploadProgress && (
        <MultiUploadProgress
          files={multiUploadProgress}
          currentIndex={multiUploadProgress.findIndex((f) => f.status === 'uploading')}
          onClose={() => setShowMultiUploadProgress(false)}
        />
      )}

      {/* Logout Animation */}
      {showLogoutAnimation && (
        <LogoutAnimation onComplete={handleLogoutComplete} />
      )}

      {/* Movilidad Form */}
      {showMovilidadForm && operationType === 'PLANILLA_MOVILIDAD' && (
        <MovilidadForm
          onCancel={() => setShowMovilidadForm(false)}
          onSuccess={() => {
            setShowMovilidadForm(false)
            loadPlanillas() // Actualizar lista de planillas inmediatamente
          }}
        />
      )}

      {/* Gasto Reparable Form */}
      {showGastoReparableForm && operationType === 'GASTO_REPARABLE' && (
        <GastoReparableForm
          onCancel={() => setShowGastoReparableForm(false)}
          onSuccess={() => {
            setShowGastoReparableForm(false)
            loadInvoices() // Actualizar lista
          }}
        />
      )}

      {/* User Planillas Modal */}
      {showUserPlanillasModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUserPlanillasModal(false)
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-3xl">
              <h3 className="font-bold text-xl">📋 Mis Planillas de Movilidad</h3>
              <p className="text-white/80 text-sm mt-1">Estado de tus planillas</p>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-3">
                {!userPlanillas || userPlanillas.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 font-medium">No tienes planillas registradas</p>
                    <p className="text-gray-400 text-sm mt-2">Crea tu primera planilla de movilidad</p>
                  </div>
                ) : (
                  userPlanillas.map((planilla) => (
                    <div
                      key={planilla.id}
                      className={`rounded-xl p-4 border-2 ${
                        planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                          ? 'bg-yellow-50 border-yellow-200'
                          : planilla.estadoAprobacion === 'APROBADA'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                            ? 'bg-yellow-500'
                            : planilla.estadoAprobacion === 'APROBADA'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {planilla.estadoAprobacion === 'PENDIENTE_APROBACION' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : planilla.estadoAprobacion === 'APROBADA' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm ${
                            planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                              ? 'text-yellow-900'
                              : planilla.estadoAprobacion === 'APROBADA'
                              ? 'text-green-900'
                              : 'text-red-900'
                          }`}>
                            {planilla.nombresApellidos}
                          </p>
                          <p className={`text-xs ${
                            planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                              ? 'text-yellow-700'
                              : planilla.estadoAprobacion === 'APROBADA'
                              ? 'text-green-700'
                              : 'text-red-700'
                          }`}>
                            {new Date(planilla.createdAt).toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${
                            planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                              ? 'text-yellow-900'
                              : planilla.estadoAprobacion === 'APROBADA'
                              ? 'text-green-900'
                              : 'text-red-900'
                          }`}>
                            S/ {planilla.totalGeneral.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className={`text-xs px-3 py-1.5 rounded-lg font-medium inline-block ${
                        planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                          ? 'bg-yellow-100 text-yellow-800'
                          : planilla.estadoAprobacion === 'APROBADA'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {planilla.estadoAprobacion === 'PENDIENTE_APROBACION'
                          ? '⏳ Pendiente de aprobación'
                          : planilla.estadoAprobacion === 'APROBADA'
                          ? `✅ Aprobada${planilla.aprobadoPor?.name ? ` por ${planilla.aprobadoPor.name}` : ''}`
                          : '❌ Rechazada'}
                      </div>

                      {planilla.comentariosAprobacion && (
                        <div className={`mt-3 p-2 rounded-lg text-xs ${
                          planilla.estadoAprobacion === 'APROBADA'
                            ? 'bg-green-100/50 text-green-800'
                            : 'bg-red-100/50 text-red-800'
                        }`}>
                          <p className="font-semibold mb-1">Comentarios:</p>
                          <p>{planilla.comentariosAprobacion}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowUserPlanillasModal(false)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Number Modal */}
      {showAssignNumberModal && invoiceToAssign && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAssignNumberModal(false)
              setInvoiceToAssign(null)
              setNewNumber('')
            }
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-t-3xl">
              <h3 className="font-bold text-xl">📋 Asignar Número</h3>
              <p className="text-white/80 text-sm mt-1">
                {invoiceToAssign.tipoOperacion === 'RENDICION' ? 'Rendición' : 'Caja Chica'}
              </p>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{getDocumentTypeName()}:</p>
                <p className="font-bold text-gray-900">{invoiceToAssign.vendorName || 'N/A'}</p>
                <p className="text-sm text-gray-600 mt-2">Serie/Número:</p>
                <p className="font-mono text-gray-900">{invoiceToAssign.serieNumero || invoiceToAssign.invoiceNumber || 'N/A'}</p>
                <p className="text-sm text-gray-600 mt-2">Monto:</p>
                <p className="font-bold text-lg text-gray-900">S/ {invoiceToAssign.totalAmount?.toFixed(2) || '0.00'}</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Número de {invoiceToAssign.tipoOperacion === 'RENDICION' ? 'Rendición' : 'Caja Chica'}
                </label>
                <select
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 bg-white"
                  autoFocus
                >
                  <option value="">Seleccionar...</option>
                  {invoiceToAssign.tipoOperacion === 'RENDICION'
                    ? rendiciones.map((rend) => (
                        <option key={rend.NroRend} value={rend.NroRend}>
                          {rend.CodEstado === '00' ? '🟢 Abierta' : '🔴 Cerrada'} - Rendición #{rend.NroRend}{rend.CodUserAsg ? ` (${rend.CodUserAsg})` : ''}
                        </option>
                      ))
                    : rendiciones.map((caja) => (
                        <option key={caja.NroRend} value={caja.NroRend}>
                          {caja.CodEstado === '00' ? '🟢 Abierta' : '🔴 Cerrada'} - {caja.CodLocal || '-'} - {caja.NroRend} - {caja.DesEmpresa || 'Sin empresa'}
                        </option>
                      ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Este número se asignará a la {getDocumentTypeName(false, false)} y se enviará a SQL Server
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAssignNumberModal(false)
                    setInvoiceToAssign(null)
                    setNewNumber('')
                  }}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssignNumber}
                  disabled={!newNumber || assigningNumber}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-semibold hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                >
                  {assigningNumber ? 'Asignando...' : '✓ Asignar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalles de Planilla */}
      {showPlanillaDetailModal && selectedPlanilla && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
          onClick={() => {
            setShowPlanillaDetailModal(false)
            setSelectedPlanilla(null)
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl animate-scale-in my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h3 className="font-bold text-xl">📋 Planilla de Movilidad</h3>
                <p className="text-sm text-white/80">Detalle completo</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.open(`/planillas-movilidad/${selectedPlanilla.id}/print`, '_blank')}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  title="Ver para imprimir"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir
                </button>
                {/* Botón eliminar - Solo SUPER_ADMIN y STAFF */}
                {['SUPER_ADMIN', 'STAFF'].includes(session?.user?.role || '') && (
                  <button
                    onClick={() => handleEliminarPlanilla(selectedPlanilla.id, selectedPlanilla.nroPlanilla)}
                    className="px-4 py-2 bg-red-500/80 hover:bg-red-600 rounded-lg font-semibold transition-colors flex items-center gap-2"
                    title="Eliminar planilla"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowPlanillaDetailModal(false)
                    setSelectedPlanilla(null)
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="p-6">
              {/* Estado de aprobación */}
              <div className={`mb-6 p-4 rounded-xl border-2 ${
                selectedPlanilla.estadoAprobacion === 'APROBADA'
                  ? 'bg-green-50 border-green-500'
                  : selectedPlanilla.estadoAprobacion === 'RECHAZADA'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-yellow-50 border-yellow-500'
              }`}>
                <div className="flex items-center gap-3">
                  {selectedPlanilla.estadoAprobacion === 'APROBADA' ? (
                    <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : selectedPlanilla.estadoAprobacion === 'RECHAZADA' ? (
                    <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-yellow-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  )}
                  <div>
                    <h4 className={`font-bold text-lg ${
                      selectedPlanilla.estadoAprobacion === 'APROBADA'
                        ? 'text-green-900'
                        : selectedPlanilla.estadoAprobacion === 'RECHAZADA'
                        ? 'text-red-900'
                        : 'text-yellow-900'
                    }`}>
                      {selectedPlanilla.estadoAprobacion === 'APROBADA'
                        ? 'Planilla Aprobada'
                        : selectedPlanilla.estadoAprobacion === 'RECHAZADA'
                        ? 'Planilla Rechazada'
                        : 'En Espera de Aprobación'}
                    </h4>
                    {selectedPlanilla.aprobadoPor && (
                      <p className={`text-sm ${
                        selectedPlanilla.estadoAprobacion === 'APROBADA' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        Por: {selectedPlanilla.aprobadoPor.name}
                      </p>
                    )}
                  </div>
                </div>
                {selectedPlanilla.comentariosAprobacion && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-sm font-semibold text-gray-700">Comentarios:</p>
                    <p className="text-sm text-gray-800 mt-1">{selectedPlanilla.comentariosAprobacion}</p>
                  </div>
                )}
              </div>

              {/* 🆕 Botón de editar - Admins pueden editar pendientes/rechazadas, usuarios solo rechazadas propias */}
              {(() => {
                const adminRoles = ['SUPER_ADMIN', 'VERIFICADOR', 'ORG_ADMIN', 'STAFF']
                const isAdmin = adminRoles.includes(session?.user?.role || '')
                const isCreator = selectedPlanilla.userId === session?.user?.id
                const canEdit = isAdmin
                  ? ['RECHAZADA', 'PENDIENTE_APROBACION'].includes(selectedPlanilla.estadoAprobacion)
                  : selectedPlanilla.estadoAprobacion === 'RECHAZADA' && isCreator
                return canEdit ? (
                  <div className="mb-6">
                    <button
                      onClick={() => {
                        window.location.href = `/planillas-movilidad/${selectedPlanilla.id}/editar`
                      }}
                      className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-4 rounded-xl font-semibold transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      ✏️ Editar Planilla
                    </button>
                    <p className="text-xs text-center text-gray-600 mt-2">
                      {isAdmin ? 'Editar esta planilla' : 'Corrige los campos marcados con error y vuelve a enviar para aprobación'}
                    </p>
                  </div>
                ) : null
              })()}

              {/* 🆕 Sección para asignar destino (solo si está aprobada y no asignada) */}
              {selectedPlanilla.estadoAprobacion === 'APROBADA' && !selectedPlanilla.aplicadaEn && (
                <div className="mb-6 bg-indigo-50 p-6 rounded-xl border-2 border-indigo-300">
                  <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Asignar a Rendición o Caja Chica
                  </h4>

                  <p className="text-sm text-gray-700 mb-4">
                    Esta planilla está aprobada. Ahora puede asignarla a una rendición o caja chica.
                  </p>

                  {/* Selector de tipo de operación */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tipo de operación:
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignDestinationType"
                          value="RENDICION"
                          checked={assignDestinationType === 'RENDICION'}
                          onChange={(e) => {
                            setAssignDestinationType(e.target.value as 'RENDICION')
                            setAssignRendicionNumber('')
                            loadAvailableRendiciones()
                          }}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium text-gray-700">Rendición</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="assignDestinationType"
                          value="CAJA_CHICA"
                          checked={assignDestinationType === 'CAJA_CHICA'}
                          onChange={(e) => {
                            setAssignDestinationType(e.target.value as 'CAJA_CHICA')
                            setAssignCajaChicaNumber('')
                            setAssignCodLocal('')
                            loadAvailableCajasChicas()
                          }}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="text-sm font-medium text-gray-700">Caja Chica</span>
                      </label>
                    </div>
                  </div>

                  {/* Select para rendición */}
                  {assignDestinationType === 'RENDICION' && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Seleccionar Rendición:
                      </label>
                      {loadingAvailableList ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                          Cargando rendiciones...
                        </div>
                      ) : (
                        <select
                          value={assignRendicionNumber}
                          onChange={(e) => setAssignRendicionNumber(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Seleccione una rendición --</option>
                          {availableRendiciones.map((rend) => (
                            <option key={rend.NroRend} value={rend.NroRend}>
                              {rend.CodEstado === '00' ? '🟢 Abierta' : '🔴 Cerrada'} - Rendición N° {rend.NroRend} - Usuario: {rend.CodUserAsg || '-'}
                            </option>
                          ))}
                        </select>
                      )}
                      {availableRendiciones.length === 0 && !loadingAvailableList && (
                        <p className="text-xs text-orange-600 mt-1">No hay rendiciones abiertas disponibles</p>
                      )}
                    </div>
                  )}

                  {/* Select para caja chica */}
                  {assignDestinationType === 'CAJA_CHICA' && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Seleccionar Caja Chica:
                      </label>
                      {loadingAvailableList ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <div className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                          Cargando cajas chicas...
                        </div>
                      ) : (
                        <select
                          value={assignCajaChicaNumber}
                          onChange={(e) => {
                            const nroRend = e.target.value
                            setAssignCajaChicaNumber(nroRend)
                            // Obtener el CodLocal de la caja seleccionada
                            const cajaSeleccionada = availableCajasChicas.find(c => String(c.NroRend) === String(nroRend))
                            setAssignCodLocal(cajaSeleccionada?.CodLocal || '')
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">-- Seleccione una caja chica --</option>
                          {availableCajasChicas.map((caja) => (
                            <option key={caja.NroRend} value={caja.NroRend}>
                              {caja.CodEstado === '00' ? '🟢 Abierta' : '🔴 Cerrada'} - {caja.CodLocal || '-'} - {caja.NroRend} - {caja.DesEmpresa || 'Sin empresa'}
                            </option>
                          ))}
                        </select>
                      )}
                      {availableCajasChicas.length === 0 && !loadingAvailableList && (
                        <p className="text-xs text-orange-600 mt-1">No hay cajas chicas abiertas disponibles</p>
                      )}
                    </div>
                  )}

                  {/* Botón de asignar */}
                  <button
                    onClick={handleAsignarDestino}
                    disabled={assigningDestino || !assignDestinationType}
                    className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                      assigningDestino || !assignDestinationType
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {assigningDestino ? (
                      <>
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                        Asignando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Asignar Planilla
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* 🆕 Mostrar información si ya está asignada */}
              {selectedPlanilla.aplicadaEn && (
                <div className="mb-6 bg-blue-50 p-6 rounded-xl border-2 border-blue-300">
                  <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Planilla Asignada
                  </h4>
                  <p className="text-sm text-blue-800">
                    Esta planilla ha sido asignada a:{' '}
                    <span className="font-bold">
                      {selectedPlanilla.tipoOperacion === 'RENDICION'
                        ? `Rendición #${selectedPlanilla.nroRendicion}`
                        : `Caja Chica #${selectedPlanilla.nroCajaChica}`}
                    </span>
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Fecha de asignación: {new Date(selectedPlanilla.aplicadaEn).toLocaleString('es-PE')}
                  </p>
                </div>
              )}

              {/* Datos del trabajador */}
              <div className="mb-6 bg-gray-50 p-4 rounded-xl">
                <h4 className="font-bold text-gray-900 mb-3">DATOS DEL TRABAJADOR</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Nombres y Apellidos:</p>
                    <p className="text-sm text-gray-900 font-bold">{selectedPlanilla.nombresApellidos}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">DNI:</p>
                    <p className="text-sm text-gray-900">{selectedPlanilla.dni}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Cargo:</p>
                    <p className="text-sm text-gray-900">{selectedPlanilla.cargo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 font-semibold">Centro de Costo:</p>
                    <p className="text-sm text-gray-900">{selectedPlanilla.centroCosto || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Gastos */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3">DETALLE DE GASTOS</h4>
                <div className="space-y-3">
                  {selectedPlanilla.gastos && selectedPlanilla.gastos.length > 0 ? (
                    selectedPlanilla.gastos.map((gasto: any, idx: number) => (
                      <div key={gasto.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                            Gasto #{idx + 1}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(gasto.fechaGasto).toLocaleDateString('es-PE')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-600">Motivo:</p>
                            <p className="text-gray-900">{gasto.motivo || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Monto:</p>
                            <p className="text-gray-900 font-bold">S/ {gasto.montoViaje.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Origen:</p>
                            <p className="text-gray-900">{gasto.origen || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Destino:</p>
                            <p className="text-gray-900">{gasto.destino || '-'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No hay gastos registrados</p>
                  )}
                </div>
              </div>

              {/* Totales */}
              <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-300">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">TOTAL GENERAL:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    S/ {selectedPlanilla.totalGeneral.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Preview Modal - Muestra la imagen INSTANTÁNEAMENTE */}
      {uploadPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl animate-scale-in overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xl">📸 Procesando {getDocumentTypeName()}</h3>
                  <p className="text-sm text-white/80">Extrayendo datos con IA...</p>
                </div>
                <div className="animate-spin h-8 w-8 border-4 border-white/30 border-t-white rounded-full"></div>
              </div>
            </div>
            <div className="p-6">
              <div className="relative">
                <img
                  src={uploadPreview}
                  alt="Preview"
                  className="w-full h-auto rounded-xl shadow-lg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent rounded-xl flex items-end justify-center p-4">
                  <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full">
                    <p className="text-sm font-semibold text-gray-800 animate-pulse">
                      ⚡ Analizando con Gemini AI...
                    </p>
                  </div>
                </div>
              </div>
              {uploadingFile && (
                <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-xs text-gray-600">
                    📄 <strong>{uploadingFile.name}</strong>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {(uploadingFile.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Invoice Detail Modal con TODOS los campos OCR */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl animate-scale-in my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h3 className="font-bold text-xl">Detalle Completo de {getDocumentTypeName()}</h3>
                <p className="text-sm text-white/80">Datos extraídos por IA</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(selectedInvoice.id)}
                  disabled={deleting}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  title="Eliminar factura"
                >
                  {deleting ? (
                    <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Alerta de DUPLICADO - Prominente */}
              {selectedInvoice.isDuplicate && (
                <div className="mb-6 bg-gradient-to-r from-red-500 to-pink-500 text-white p-6 rounded-2xl shadow-xl border-4 border-red-300 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-xl mb-2">⚠️ COMPROBANTE DUPLICADO</h4>
                      <p className="text-white/90 mb-3">
                        Este comprobante ya fue registrado anteriormente en el sistema.
                      </p>
                      {selectedInvoice.duplicateOfId && (
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                          <p className="text-sm font-semibold">
                            Método de detección: {selectedInvoice.duplicateDetectionMethod === 'qr' ? '📱 Código QR' : '🔍 RUC + Serie + Número'}
                          </p>
                          <p className="text-sm mt-1">
                            ID del original: <span className="font-mono">{selectedInvoice.duplicateOfId}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sección de Edición - Arriba de la imagen */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm">
                    ✏️
                  </span>
                  Editar Información
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Concepto del Gasto
                      </label>
                      <input
                        type="text"
                        value={editingConcepto}
                        onChange={(e) => setEditingConcepto(e.target.value)}
                        placeholder="Ej: Materiales de oficina, Transporte, etc."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-900 bg-white placeholder-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Observación / Comentarios
                      </label>
                      <input
                        type="text"
                        value={editingObservacion}
                        onChange={(e) => setEditingObservacion(e.target.value)}
                        placeholder="Agregar observaciones..."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all text-gray-900 bg-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveInvoice}
                      disabled={savingInvoice}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {savingInvoice ? (
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Guardar Cambios
                    </button>
                    <button
                      onClick={() => setShowAssignToModal(true)}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Asignar a Rendición/Caja
                    </button>
                  </div>
                </div>
              </div>

              {/* Imagen con zoom y controles de rotación */}
              <div className="mb-6 relative group">
                {/* Botones de rotación */}
                <div className="absolute top-3 left-3 z-10 flex gap-2">
                  <button
                    onClick={() => handleRotateImage('left')}
                    className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg transition-colors"
                    title="Girar izquierda"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRotateImage('right')}
                    className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-lg transition-colors"
                    title="Girar derecha"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                    </svg>
                  </button>
                </div>
                <img
                  src={selectedInvoice.imageUrl}
                  alt="Invoice"
                  className="w-full rounded-2xl shadow-lg cursor-zoom-in transition-transform duration-300"
                  style={{ transform: `rotate(${imageRotation}deg)` }}
                  onClick={(e) => {
                    e.currentTarget.classList.toggle('scale-150')
                    e.currentTarget.classList.toggle('cursor-zoom-out')
                    e.currentTarget.classList.toggle('cursor-zoom-in')
                  }}
                />
                <div className="absolute top-3 right-3 bg-black/70 text-white px-3 py-1 rounded-lg text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  Click para zoom
                </div>
              </div>

              {/* Datos del Emisor */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">
                    📤
                  </span>
                  Datos del Emisor
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl">
                    <p className="text-xs text-gray-600 mb-1">Razón Social</p>
                    <p className="font-bold text-gray-900">{selectedInvoice.razonSocialEmisor || selectedInvoice.vendorName || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-600 mb-1">RUC</p>
                    <p className="font-bold text-gray-900 font-mono">{selectedInvoice.rucEmisor || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl md:col-span-2">
                    <p className="text-xs text-gray-600 mb-1">Domicilio Fiscal</p>
                    <p className="font-semibold text-gray-900">{selectedInvoice.domicilioFiscalEmisor || 'N/A'}</p>
                  </div>
                </div>

                {/* Botón para consultar información del RUC en SUNAT */}
                {selectedInvoice.rucEmisor && (
                  <div className="mt-4">
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/invoices/${selectedInvoice.id}/ruc`)

                          if (!response.ok) {
                            const error = await response.json()
                            alert(`❌ Error: ${error.error || 'No se pudo obtener datos del RUC'}`)
                            return
                          }

                          const result = await response.json()

                          if (!result.success || !result.data) {
                            alert('❌ Error: Respuesta inválida')
                            return
                          }

                          const data = result.data

                          // Mostrar información completa del RUC consultada en SUNAT
                          const mensaje = `🏢 INFORMACIÓN OFICIAL DEL RUC (SUNAT)\n\n` +
                            `RUC: ${data.ruc}\n` +
                            `Razón Social: ${data.razonSocial}\n\n` +
                            `📍 DOMICILIO FISCAL:\n${data.direccion}\n` +
                            `${data.distrito ? `Distrito: ${data.distrito}\n` : ''}` +
                            `${data.provincia ? `Provincia: ${data.provincia}\n` : ''}` +
                            `${data.departamento ? `Departamento: ${data.departamento}\n` : ''}` +
                            `\n✅ ESTADO:\n${data.estado} - ${data.estadoInterpretado.mensaje}\n` +
                            `\n📋 CONDICIÓN:\n${data.condicionDomicilio}\n` +
                            `\n🏭 TIPO DE EMPRESA:\n${data.tipoEmpresa}\n` +
                            `\n💼 ACTIVIDAD ECONÓMICA:\n${data.actividadEconomica}\n` +
                            `Código CIIU: ${data.codigoCIIU}`

                          alert(mensaje)
                        } catch (error: any) {
                          console.error('Error:', error)
                          alert(`❌ Error al obtener datos del RUC\n\n${error?.message || 'Error de conexión'}`)
                        }
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Consultar Información del RUC en SUNAT
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Consulta los datos oficiales del RUC directamente desde SUNAT
                    </p>
                  </div>
                )}
              </div>

              {/* Datos del Receptor */}
              {(selectedInvoice.rucReceptor || selectedInvoice.dniReceptor || selectedInvoice.razonSocialReceptor) && (
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white text-sm">
                      📥
                    </span>
                    Datos del Receptor
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedInvoice.razonSocialReceptor && (
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                        <p className="text-xs text-gray-600 mb-1">Razón Social / Nombre</p>
                        <p className="font-bold text-gray-900">{selectedInvoice.razonSocialReceptor}</p>
                      </div>
                    )}
                    {selectedInvoice.rucReceptor && (
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-600 mb-1">RUC</p>
                        <p className="font-bold text-gray-900 font-mono">{selectedInvoice.rucReceptor}</p>
                      </div>
                    )}
                    {selectedInvoice.dniReceptor && (
                      <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs text-gray-600 mb-1">DNI</p>
                        <p className="font-bold text-gray-900 font-mono">{selectedInvoice.dniReceptor}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Datos del Comprobante */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center text-white text-sm">
                    📄
                  </span>
                  Datos del Comprobante
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl">
                    <p className="text-xs text-gray-600 mb-1">Serie y Número</p>
                    <p className="font-bold text-gray-900 font-mono text-lg">{selectedInvoice.serieNumero || selectedInvoice.invoiceNumber || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-600 mb-1">Fecha de Emisión</p>
                    <p className="font-bold text-gray-900">
                      {selectedInvoice.invoiceDate
                        ? new Date(selectedInvoice.invoiceDate).toLocaleDateString('es-PE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : new Date(selectedInvoice.createdAt).toLocaleDateString('es-PE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                    </p>
                  </div>
                </div>

                {/* Botón para descargar XML de validación SUNAT */}
                {selectedInvoice.rucEmisor && selectedInvoice.documentTypeCode && selectedInvoice.serieNumero && selectedInvoice.totalAmount && (
                  <div className="mt-4">
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/invoices/${selectedInvoice.id}/xml`)
                          if (!response.ok) {
                            const error = await response.json()
                            alert(`Error: ${error.error}`)
                            return
                          }
                          const blob = await response.blob()
                          const url = window.URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${selectedInvoice.serieNumero?.replace('/', '-')}_validacion_sunat.xml`
                          document.body.appendChild(a)
                          a.click()
                          window.URL.revokeObjectURL(url)
                          document.body.removeChild(a)
                        } catch (error) {
                          console.error('Error downloading XML:', error)
                          alert('Error al descargar el XML')
                        }
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Descargar XML de Validación SUNAT
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      ℹ️ Este XML contiene los datos de validación. Para el XML original firmado, solicítelo al emisor.
                    </p>
                  </div>
                )}

                {/* Botón para re-validar con SUNAT */}
                {selectedInvoice.rucEmisor && selectedInvoice.documentTypeCode && selectedInvoice.serieNumero && selectedInvoice.totalAmount && (
                  <div className="mt-4">
                    <button
                      onClick={async () => {
                        if (!confirm('¿Desea re-validar este comprobante con SUNAT?')) return

                        try {
                          const response = await fetch(`/api/invoices/${selectedInvoice.id}/revalidate`, {
                            method: 'POST',
                          })
                          if (!response.ok) {
                            const error = await response.json()
                            alert(`Error: ${error.error}`)
                            return
                          }
                          const result = await response.json()
                          const data = result.data

                          // Mostrar resultado
                          alert(`✅ RE-VALIDACIÓN COMPLETADA\n\n` +
                            `Estado: ${data.interpretacion.mensaje}\n` +
                            `Estado CP: ${data.estadoCp}\n` +
                            `Estado RUC: ${data.estadoRuc || 'N/A'}\n` +
                            `Intentos: ${data.intentos}\n` +
                            `${data.variacionUsada ? 'Variación: ' + data.variacionUsada + '\n' : ''}` +
                            `${data.observaciones?.length ? 'Observaciones: ' + data.observaciones.join(', ') + '\n' : ''}\n` +
                            `Verificado: ${new Date(data.verificadoEn).toLocaleString('es-PE')}\n\n` +
                            `${data.interpretacion.valido ? '✅ COMPROBANTE VÁLIDO' : '⚠️ ' + data.interpretacion.mensaje}`
                          )

                          // Recargar facturas para actualizar la UI
                          loadInvoices()
                          setSelectedInvoice(null)
                        } catch (error) {
                          console.error('Error revalidating:', error)
                          alert('Error al re-validar con SUNAT')
                        }
                      }}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Re-validar con SUNAT
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      🔄 Vuelve a consultar el estado del comprobante en SUNAT
                    </p>
                  </div>
                )}
              </div>

              {/* Montos y Totales */}
              <div>
                <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-white text-sm">
                    💰
                  </span>
                  Montos y Totales
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedInvoice.subtotal && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-600 mb-1">OP. GRAVADA (Subtotal)</p>
                      <p className="font-bold text-gray-900 text-lg">
                        {selectedInvoice.currency || 'S/'} {selectedInvoice.subtotal.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {(selectedInvoice.igvMonto || selectedInvoice.taxAmount) && (
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-600 mb-1">
                        IGV ({selectedInvoice.igvTasa || 18}%)
                      </p>
                      <p className="font-bold text-gray-900 text-lg">
                        {selectedInvoice.currency || 'S/'} {(selectedInvoice.igvMonto || selectedInvoice.taxAmount || 0).toFixed(2)}
                      </p>
                    </div>
                  )}
                  {selectedInvoice.totalAmount && (
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl md:col-span-2 border-2 border-green-200">
                      <p className="text-sm text-gray-600 mb-1">TOTAL A PAGAR</p>
                      <p className="font-bold text-green-600 text-3xl">
                        {selectedInvoice.currency || 'S/'} {selectedInvoice.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw OCR Data (Collapsible) */}
              {selectedInvoice.ocrData && (
                <details className="mt-6">
                  <summary className="cursor-pointer p-4 bg-gray-100 rounded-xl font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
                    🔍 Ver datos RAW del OCR (JSON completo)
                  </summary>
                  <pre className="mt-4 p-4 bg-gray-900 text-green-400 rounded-xl overflow-x-auto text-xs font-mono">
                    {JSON.stringify(selectedInvoice.ocrData, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para asignar a Rendición o Caja Chica */}
      {showAssignToModal && selectedInvoice && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => setShowAssignToModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <h3 className="font-bold text-xl">Asignar Documento</h3>
              <p className="text-sm text-white/80">Asignar a rendición o caja chica</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Asignación
                </label>
                <select
                  value={assignToType}
                  onChange={(e) => setAssignToType(e.target.value as 'RENDICION' | 'CAJA_CHICA' | '')}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 text-gray-900 bg-white"
                >
                  <option value="">Seleccionar...</option>
                  <option value="RENDICION">Rendición de Gastos</option>
                  <option value="CAJA_CHICA">Caja Chica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número
                </label>
                <input
                  type="text"
                  value={assignToNumber}
                  onChange={(e) => setAssignToNumber(e.target.value)}
                  placeholder={assignToType === 'CAJA_CHICA' ? 'Número de caja chica' : 'Número de rendición'}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 text-gray-900 bg-white placeholder-gray-400"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAssignToModal(false)}
                  className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl hover:bg-gray-300 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAssignInvoiceTo}
                  disabled={savingInvoice || !assignToType || !assignToNumber}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
                >
                  {savingInvoice ? 'Guardando...' : 'Asignar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out both;
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }

        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        img.scale-150 {
          transform: scale(1.5);
          transition: transform 0.3s ease;
          position: relative;
          z-index: 10;
        }
      `}</style>
    </div>
  )
}
