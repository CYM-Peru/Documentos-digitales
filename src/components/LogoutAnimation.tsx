'use client'

import { useEffect, useState } from 'react'

interface LogoutAnimationProps {
  onComplete: () => void
}

export default function LogoutAnimation({ onComplete }: LogoutAnimationProps) {
  const [animationPhase, setAnimationPhase] = useState<'enter' | 'show' | 'exit'>('enter')

  useEffect(() => {
    const enterTimer = setTimeout(() => setAnimationPhase('show'), 300)
    const showTimer = setTimeout(() => setAnimationPhase('exit'), 1700)
    const exitTimer = setTimeout(() => onComplete(), 2000)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(showTimer)
      clearTimeout(exitTimer)
    }
  }, [onComplete])

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-300 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 ${
      animationPhase === 'enter' ? 'opacity-0' :
      animationPhase === 'show' ? 'opacity-100' :
      'opacity-0'
    }`}>
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

      {/* Luces ambientales */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[150px] animate-pulse-slow" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[150px] animate-pulse-slow" style={{ animationDelay: '0.5s' }} />

      {/* Contenido */}
      <div className={`relative z-10 text-center transition-all duration-500 ${
        animationPhase === 'enter' ? 'opacity-0 scale-95' :
        animationPhase === 'show' ? 'opacity-100 scale-100' :
        'opacity-0 scale-95'
      }`}>
        {/* Icono de logout */}
        <div className="inline-flex items-center justify-center w-24 h-24 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl mb-6 border border-white/20 relative overflow-hidden">
          {/* Ripple effect */}
          <div className={`absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-2xl transition-all duration-1000 ${
            animationPhase === 'show' ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
          }`} />

          <svg className="w-12 h-12 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>

        {/* Texto */}
        <div className={`space-y-2 transition-all duration-500 delay-200 ${
          animationPhase === 'show' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}>
          <h2 className="text-3xl font-light text-white tracking-tight">
            Cerrando sesión
          </h2>
          <p className="text-slate-400 font-light">
            Hasta pronto
          </p>
        </div>

        {/* Barra de progreso */}
        <div className={`mt-8 transition-all duration-500 delay-300 ${
          animationPhase === 'show' ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="w-48 h-0.5 mx-auto bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-[1400ms] ease-linear ${
              animationPhase === 'show' ? 'w-full' : 'w-0'
            }`} />
          </div>
        </div>

        {/* Puntos de carga minimalistas */}
        <div className="flex justify-center gap-2 mt-6">
          <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
          <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
