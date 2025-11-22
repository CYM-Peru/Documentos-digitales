'use client'

import { useEffect, useState } from 'react'

interface WelcomeScreenProps {
  userName: string
  onComplete: () => void
}

export default function WelcomeScreen({ userName, onComplete }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [animationPhase, setAnimationPhase] = useState<'enter' | 'show' | 'exit'>('enter')

  useEffect(() => {
    const enterTimer = setTimeout(() => setAnimationPhase('show'), 400)
    const showTimer = setTimeout(() => setAnimationPhase('exit'), 2400)
    const exitTimer = setTimeout(() => {
      setIsVisible(false)
      onComplete()
    }, 3200)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(showTimer)
      clearTimeout(exitTimer)
    }
  }, [onComplete])

  if (!isVisible) return null

  const getFirstName = (fullName: string) => fullName.split(' ')[0]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Patrón geométrico elegante de fondo */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(30deg, #6366f1 12%, transparent 12.5%, transparent 87%, #6366f1 87.5%, #6366f1),
            linear-gradient(150deg, #6366f1 12%, transparent 12.5%, transparent 87%, #6366f1 87.5%, #6366f1),
            linear-gradient(30deg, #6366f1 12%, transparent 12.5%, transparent 87%, #6366f1 87.5%, #6366f1),
            linear-gradient(150deg, #6366f1 12%, transparent 12.5%, transparent 87%, #6366f1 87.5%, #6366f1)
          `,
          backgroundSize: '80px 140px',
          backgroundPosition: '0 0, 0 0, 40px 70px, 40px 70px'
        }} />
      </div>

      {/* Luces ambientales corporativas */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px]" />

      {/* Líneas decorativas animadas */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent transition-all duration-1000 ${
          animationPhase === 'show' ? 'left-0 w-full' : 'left-1/2 w-0'
        }`} style={{ top: '35%' }} />
        <div className={`absolute h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent transition-all duration-1000 delay-200 ${
          animationPhase === 'show' ? 'right-0 w-full' : 'right-1/2 w-0'
        }`} style={{ bottom: '35%' }} />
      </div>

      {/* Contenido principal */}
      <div className={`relative z-10 text-center transition-all duration-700 ${
        animationPhase === 'enter' ? 'opacity-0 scale-95' :
        animationPhase === 'show' ? 'opacity-100 scale-100' :
        'opacity-0 scale-105'
      }`}>
        {/* Logo corporativo */}
        <div className="inline-flex items-center justify-center w-32 h-32 bg-white rounded-2xl shadow-2xl mb-8 p-5 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl" />
          <img
            src="/azaleia-logo.svg"
            alt="Azaleia Logo"
            className="w-full h-full object-contain relative z-10"
          />
          {/* Anillo de progreso */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="2"
              strokeDasharray="301.6"
              strokeDashoffset="301.6"
              className={animationPhase === 'show' ? 'animate-draw-circle' : ''}
            />
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Saludo ejecutivo */}
        <div className={`space-y-3 transition-all duration-700 delay-300 ${
          animationPhase === 'show' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <h1 className="text-4xl md:text-5xl font-light text-white tracking-tight">
            {getGreeting()}, <span className="font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{getFirstName(userName)}</span>
          </h1>
          <p className="text-lg text-slate-400 font-light">
            Acceso autorizado
          </p>
        </div>

        {/* Barra de progreso minimalista */}
        <div className={`mt-12 transition-all duration-700 delay-500 ${
          animationPhase === 'show' ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="w-48 h-0.5 mx-auto bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-[1800ms] ease-out ${
              animationPhase === 'show' ? 'w-full' : 'w-0'
            }`} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes draw-circle {
          to {
            stroke-dashoffset: 0;
          }
        }

        .animate-draw-circle {
          animation: draw-circle 1.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
