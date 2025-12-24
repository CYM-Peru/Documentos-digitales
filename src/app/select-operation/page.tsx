'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'

export default function SelectOperationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const cardsContainerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleLogout = async () => {
    setLoggingOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // GSAP Animations - Entrada profesional con stagger
  useEffect(() => {
    if (status !== 'loading' && cardRefs.current.length > 0) {
      const cards = cardRefs.current.filter(card => card !== null)

      // Limpiar estados previos
      gsap.set(cards, {
        opacity: 0,
        y: 60,
        rotateX: -15,
        scale: 0.9
      })

      // Animación de entrada escalonada profesional
      gsap.to(cards, {
        opacity: 1,
        y: 0,
        rotateX: 0,
        scale: 1,
        duration: 0.8,
        stagger: {
          each: 0.1,
          ease: "power3.out"
        },
        ease: "power3.out",
        delay: 0.2
      })
    }
  }, [status])

  // Efecto magnético + 3D Tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    const card = cardRefs.current[index]
    if (!card) return

    const rect = card.getBoundingClientRect()
    const cardCenterX = rect.left + rect.width / 2
    const cardCenterY = rect.top + rect.height / 2

    const mouseX = e.clientX
    const mouseY = e.clientY

    // Calcular distancia del mouse al centro de la tarjeta
    const deltaX = mouseX - cardCenterX
    const deltaY = mouseY - cardCenterY

    // Efecto magnético - la tarjeta se mueve hacia el cursor
    const magneticStrength = 0.15
    const magneticX = deltaX * magneticStrength
    const magneticY = deltaY * magneticStrength

    // Efecto 3D Tilt - inclinación basada en posición del mouse
    const tiltStrength = 8
    const rotateY = (deltaX / rect.width) * tiltStrength
    const rotateX = -(deltaY / rect.height) * tiltStrength

    // Animación suave con GSAP
    gsap.to(card, {
      x: magneticX,
      y: magneticY,
      rotateY: rotateY,
      rotateX: rotateX,
      duration: 0.6,
      ease: "power2.out"
    })

    // Efecto glow siguiendo el mouse
    const glowX = ((mouseX - rect.left) / rect.width) * 100
    const glowY = ((mouseY - rect.top) / rect.height) * 100

    card.style.setProperty('--mouse-x', `${glowX}%`)
    card.style.setProperty('--mouse-y', `${glowY}%`)
  }

  const handleMouseLeave = (index: number) => {
    const card = cardRefs.current[index]
    if (!card) return

    // Volver al estado original
    gsap.to(card, {
      x: 0,
      y: 0,
      rotateY: 0,
      rotateX: 0,
      duration: 0.8,
      ease: "elastic.out(1, 0.5)"
    })
  }

  const handleSelectOperation = (type: 'RENDICION' | 'CAJA_CHICA' | 'PLANILLA_MOVILIDAD' | 'GASTO_REPARABLE') => {
    // Guardar selección en sessionStorage
    sessionStorage.setItem('operationType', type)

    // Redirigir según el tipo de operación
    if (type === 'GASTO_REPARABLE') {
      router.push('/gastos-reparables')
    } else {
      router.push('/')
    }
  }

  // Determinar qué opciones mostrar según el rol del usuario
  const userRole = session?.user?.role || 'USER_L1'

  // USER_L1: Solo Planilla de Movilidad y Gastos Reparables
  // USER_L2 y USER_L3: Rendiciones, Cajas chicas, Planillas, Gastos Reparables
  // VERIFICADOR, APROBADOR, STAFF, SUPER_ADMIN, ORG_ADMIN: Todo
  const canSeeRendiciones = !['USER_L1'].includes(userRole)
  const canSeeCajasChicas = !['USER_L1'].includes(userRole)
  const canSeePlanillas = true // Todos pueden ver planillas
  const canSeeGastosReparables = true // USER_L1 y todos los demás pueden ver gastos reparables
  // Asociar Planillas ya no se necesita - la asignación es automática al aprobar
  const canSeeAsociarPlanillas = false
  const canSeeAprobacion = ['APROBADOR', 'SUPER_ADMIN'].includes(userRole)

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 font-semibold">Cargando...</p>
        </div>
      </div>
    )
  }

  // Construir array de opciones dinámicamente con índices fijos
  const options = []
  let nextRefIndex = 0

  // ÍNDICES FIJOS - Asignamos un índice único a cada tarjeta
  const rendicionIndex = 0
  const cajaChicaIndex = 1
  const planillaIndex = 2
  const reparableIndex = 3
  const aprobacionIndex = 4

  if (canSeeRendiciones) {
    const currentIndex = nextRefIndex++
    options.push(
      <button
        key="rendicion"
        ref={el => { cardRefs.current[rendicionIndex] = el }}
        onClick={() => handleSelectOperation('RENDICION')}
        onMouseMove={(e) => handleMouseMove(e, rendicionIndex)}
        onMouseLeave={() => handleMouseLeave(rendicionIndex)}
        className="card-3d group relative bg-white rounded-2xl p-8 lg:p-10 shadow-lg border-2 border-transparent will-change-transform"
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="mb-6">
          <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
            <svg className="w-8 h-8 lg:w-10 lg:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">Rendición</h2>
          <p className="text-base text-gray-600 mb-3">
            Registra tus gastos y viáticos con comprobantes
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Facturas y boletas
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Viáticos y hospedaje
            </li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <span className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-base group-hover:gap-3 transition-all">
            Seleccionar
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </div>

        <div className="card-glow-indigo"></div>
      </button>
    )
  }

  if (canSeeCajasChicas) {
    const currentIndex = nextRefIndex++
    options.push(
      <button
        key="caja-chica"
        ref={el => { cardRefs.current[cajaChicaIndex] = el }}
        onClick={() => handleSelectOperation('CAJA_CHICA')}
        onMouseMove={(e) => handleMouseMove(e, cajaChicaIndex)}
        onMouseLeave={() => handleMouseLeave(cajaChicaIndex)}
        className="card-3d group relative bg-white rounded-2xl p-8 lg:p-10 shadow-lg border-2 border-transparent will-change-transform"
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="mb-6">
          <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
            <svg className="w-8 h-8 lg:w-10 lg:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">Caja Chica</h2>
          <p className="text-base text-gray-600 mb-3">
            Gastos menores y pagos rápidos del día a día
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Compras urgentes
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Gastos menores
            </li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <span className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-base group-hover:gap-3 transition-all">
            Seleccionar
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </div>

        <div className="card-glow-emerald"></div>
      </button>
    )
  }

  if (canSeePlanillas) {
    const currentIndex = nextRefIndex++
    options.push(
      <button
        key="planilla"
        ref={el => { cardRefs.current[planillaIndex] = el }}
        onClick={() => handleSelectOperation('PLANILLA_MOVILIDAD')}
        onMouseMove={(e) => handleMouseMove(e, planillaIndex)}
        onMouseLeave={() => handleMouseLeave(planillaIndex)}
        className="card-3d group relative bg-white rounded-2xl p-8 lg:p-10 shadow-lg border-2 border-transparent will-change-transform"
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="mb-6">
          <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
            <svg className="w-8 h-8 lg:w-10 lg:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">Movilidad</h2>
          <p className="text-base text-gray-600 mb-3">
            Registra tus gastos de transporte y traslados
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Taxi y transporte
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Traslados laborales
            </li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-base group-hover:gap-3 transition-all">
            Seleccionar
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </div>

        <div className="card-glow-amber"></div>
      </button>
    )
  }

  if (canSeeGastosReparables) {
    const currentIndex = nextRefIndex++
    options.push(
      <button
        key="reparable"
        ref={el => { cardRefs.current[reparableIndex] = el }}
        onClick={() => handleSelectOperation('GASTO_REPARABLE')}
        onMouseMove={(e) => handleMouseMove(e, reparableIndex)}
        onMouseLeave={() => handleMouseLeave(reparableIndex)}
        className="card-3d group relative bg-white rounded-2xl p-8 lg:p-10 shadow-lg border-2 border-transparent will-change-transform"
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="mb-6">
          <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
            <svg className="w-8 h-8 lg:w-10 lg:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">Reparable</h2>
          <p className="text-base text-gray-600 mb-3">
            Gastos sin comprobante que requieren reposición
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Sin documento
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Requiere reposición
            </li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <span className="inline-flex items-center gap-2 text-rose-600 font-semibold text-base group-hover:gap-3 transition-all">
            Seleccionar
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </div>

        <div className="card-glow-rose"></div>
      </button>
    )
  }

  if (canSeeAprobacion) {
    const currentIndex = nextRefIndex++
    options.push(
      <button
        key="aprobacion"
        ref={el => { cardRefs.current[aprobacionIndex] = el }}
        onClick={() => router.push('/aprobacion-planillas')}
        onMouseMove={(e) => handleMouseMove(e, aprobacionIndex)}
        onMouseLeave={() => handleMouseLeave(aprobacionIndex)}
        className="card-3d group relative bg-white rounded-2xl p-8 lg:p-10 shadow-lg border-2 border-transparent will-change-transform"
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d'
        }}
      >
        <div className="mb-6">
          <div className="w-16 h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
            <svg className="w-8 h-8 lg:w-10 lg:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">Aprobar</h2>
          <p className="text-base text-gray-600 mb-3">
            Revisa y aprueba planillas pendientes
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Revisión de planillas
            </li>
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Aprobación masiva
            </li>
          </ul>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <span className="inline-flex items-center gap-2 text-green-600 font-semibold text-base group-hover:gap-3 transition-all">
            Ir a Aprobar
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </div>

        <div className="card-glow-green"></div>
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 relative">
      {/* Barra superior con botones */}
      <div className="absolute top-4 right-4 flex items-center gap-3 animate-fade-in">
        {/* Botón Configuraciones - Solo SUPER_ADMIN */}
        {session?.user?.role === 'SUPER_ADMIN' && (
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl font-medium transition-all shadow-md border border-gray-200 hover:border-indigo-300 hover:shadow-lg"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Configuraciones</span>
          </button>
        )}

        {/* Botón Salir - Para todos */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loggingOut ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span className="hidden sm:inline">Saliendo...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Salir</span>
            </>
          )}
        </button>
      </div>

      <div className="max-w-6xl w-full px-4">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl mb-6 shadow-2xl">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            Bienvenido, {session?.user?.name?.split(' ')[0] || 'Usuario'}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Selecciona el tipo de operación que deseas realizar
          </p>
        </div>

        {/* Opciones - Todas en una fila en pantallas grandes */}
        <div
          ref={cardsContainerRef}
          className={`grid gap-4 md:gap-6 ${
            // Ajustar columnas según cantidad de opciones visibles
            options.length <= 2
              ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
              : options.length <= 4
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
          }`}
        >
          {options}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <p className="text-sm text-gray-500">
            Puedes cambiar el tipo de operación en cualquier momento desde el menú principal
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }

        /* Tarjetas 3D con efecto glow */
        .card-3d {
          position: relative;
          overflow: hidden;
          transition: box-shadow 0.3s ease;
        }

        .card-3d::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
            600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(255, 255, 255, 0.15),
            transparent 40%
          );
          opacity: 0;
          transition: opacity 0.3s ease;
          pointer-events: none;
          z-index: 1;
        }

        .card-3d:hover::before {
          opacity: 1;
        }

        .card-3d:hover {
          box-shadow:
            0 20px 40px rgba(0, 0, 0, 0.1),
            0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }

        /* Efectos de glow específicos por color */
        .card-glow-indigo,
        .card-glow-emerald,
        .card-glow-amber,
        .card-glow-rose,
        .card-glow-green {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 1rem;
          opacity: 0;
          transition: opacity 0.4s ease;
          pointer-events: none;
          z-index: 0;
        }

        .card-glow-indigo {
          background: radial-gradient(
            circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(99, 102, 241, 0.15),
            transparent 50%
          );
        }

        .card-glow-emerald {
          background: radial-gradient(
            circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(16, 185, 129, 0.15),
            transparent 50%
          );
        }

        .card-glow-amber {
          background: radial-gradient(
            circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(245, 158, 11, 0.15),
            transparent 50%
          );
        }

        .card-glow-rose {
          background: radial-gradient(
            circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(244, 63, 94, 0.15),
            transparent 50%
          );
        }

        .card-glow-green {
          background: radial-gradient(
            circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
            rgba(34, 197, 94, 0.15),
            transparent 50%
          );
        }

        .card-3d:hover .card-glow-indigo,
        .card-3d:hover .card-glow-emerald,
        .card-3d:hover .card-glow-amber,
        .card-3d:hover .card-glow-rose,
        .card-3d:hover .card-glow-green {
          opacity: 1;
        }

        /* Mejoras de performance */
        .will-change-transform {
          will-change: transform;
        }

        /* Asegurar que el contenido esté por encima del glow */
        .card-3d > div {
          position: relative;
          z-index: 2;
        }
      `}</style>
    </div>
  )
}
