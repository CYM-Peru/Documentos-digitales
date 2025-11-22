'use client'

import { useEffect, useState } from 'react'

export default function NightBackground() {
  const [shootingStars, setShootingStars] = useState<Array<{ id: number; delay: number }>>([])

  useEffect(() => {
    const generateShootingStars = () => {
      const stars = Array.from({ length: 3 }, (_, i) => ({
        id: Date.now() + i,
        delay: Math.random() * 15,
      }))
      setShootingStars(stars)
    }

    generateShootingStars()
    const interval = setInterval(generateShootingStars, 20000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Cielo nocturno profundo con gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B1026] via-[#1a1a3e] to-[#2D1B4E] transition-all duration-1000" />

      {/* Luna realista con cráteres */}
      <div className="absolute top-16 right-1/4 w-40 h-40">
        {/* Resplandor lunar */}
        <div className="absolute -inset-8 bg-blue-100/10 rounded-full blur-3xl" />
        <div className="absolute -inset-4 bg-blue-200/20 rounded-full blur-2xl animate-pulse-slow" />

        {/* Luna con textura */}
        <div className="absolute inset-0 bg-gradient-radial from-gray-100 via-gray-200 to-gray-300 rounded-full overflow-hidden">
          {/* Cráteres */}
          <div className="absolute top-1/4 right-1/3 w-8 h-8 bg-gray-400/40 rounded-full blur-sm" />
          <div className="absolute top-1/2 left-1/4 w-6 h-6 bg-gray-400/30 rounded-full blur-sm" />
          <div className="absolute bottom-1/3 right-1/4 w-10 h-10 bg-gray-400/35 rounded-full blur-sm" />
          <div className="absolute top-1/3 left-1/2 w-5 h-5 bg-gray-400/25 rounded-full blur-sm" />

          {/* Sombra lunar */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-500/30 rounded-full" />
        </div>
      </div>

      {/* Campo de estrellas con diferentes tamaños y brillos */}
      {[...Array(150)].map((_, i) => {
        const size = Math.random() * 2.5
        const brightness = 0.3 + Math.random() * 0.7

        return (
          <div
            key={`star-${i}`}
            className="absolute rounded-full bg-white"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              top: `${Math.random() * 85}%`,
              left: `${Math.random() * 100}%`,
              opacity: brightness,
              animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
              boxShadow: `0 0 ${size * 2}px rgba(255, 255, 255, ${brightness})`,
            }}
          />
        )
      })}

      {/* Constelaciones conectadas */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
        {/* Constelación 1 - Patrón de Orión simplificado */}
        <g>
          <circle cx="20%" cy="25%" r="2" fill="white" />
          <circle cx="25%" cy="22%" r="2" fill="white" />
          <circle cx="30%" cy="28%" r="2" fill="white" />
          <circle cx="22%" cy="32%" r="2" fill="white" />
          <circle cx="28%" cy="35%" r="2" fill="white" />

          <line x1="20%" y1="25%" x2="25%" y2="22%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="25%" y1="22%" x2="30%" y2="28%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="30%" y1="28%" x2="28%" y2="35%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="22%" y1="32%" x2="28%" y2="35%" stroke="white" strokeWidth="0.5" opacity="0.3" />
        </g>

        {/* Constelación 2 - Osa Mayor estilizada */}
        <g>
          <circle cx="65%" cy="15%" r="2" fill="white" />
          <circle cx="70%" cy="18%" r="2" fill="white" />
          <circle cx="75%" cy="17%" r="2" fill="white" />
          <circle cx="78%" cy="22%" r="2" fill="white" />
          <circle cx="75%" cy="26%" r="2" fill="white" />
          <circle cx="70%" cy="25%" r="2" fill="white" />
          <circle cx="68%" cy="21%" r="2" fill="white" />

          <line x1="65%" y1="15%" x2="70%" y2="18%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="70%" y1="18%" x2="75%" y2="17%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="75%" y1="17%" x2="78%" y2="22%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="78%" y1="22%" x2="75%" y2="26%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="75%" y1="26%" x2="70%" y2="25%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="70%" y1="25%" x2="68%" y2="21%" stroke="white" strokeWidth="0.5" opacity="0.3" />
          <line x1="68%" y1="21%" x2="70%" y2="18%" stroke="white" strokeWidth="0.5" opacity="0.3" />
        </g>
      </svg>

      {/* Estrellas fugaces / meteoros */}
      {shootingStars.map((star) => (
        <div
          key={star.id}
          className="absolute"
          style={{
            top: `${Math.random() * 50}%`,
            right: `-10%`,
            animation: `shootingStar 2s ease-out`,
            animationDelay: `${star.delay}s`,
          }}
        >
          <div className="relative w-1 h-1">
            {/* Núcleo de la estrella fugaz */}
            <div className="absolute w-2 h-2 bg-white rounded-full" style={{ boxShadow: '0 0 8px 2px white' }} />
            {/* Estela */}
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-l from-white via-blue-200 to-transparent"
              style={{ width: '100px', transform: 'translateY(-50%)' }}
            />
          </div>
        </div>
      ))}

      {/* Vía Láctea */}
      <div className="absolute top-0 right-0 w-full h-full overflow-hidden opacity-30">
        <div
          className="absolute top-0 right-0 w-[200%] h-[150%]"
          style={{
            background: `
              radial-gradient(ellipse at 30% 50%,
                rgba(200, 200, 255, 0.15) 0%,
                rgba(150, 150, 255, 0.08) 25%,
                rgba(100, 100, 200, 0.03) 50%,
                transparent 70%)
            `,
            transform: 'rotate(-25deg)',
          }}
        />
      </div>

      {/* Nebulosas distantes */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-purple-600/5 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] animate-float-delayed" />

      {/* Partículas flotantes etéreas */}
      {[...Array(25)].map((_, i) => (
        <div
          key={`particle-${i}`}
          className="absolute w-1 h-1 bg-blue-200/30 rounded-full"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `etherealFloat ${5 + Math.random() * 8}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 6}s`,
          }}
        />
      ))}

      {/* Bruma nocturna en el horizonte */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-indigo-950/60 via-purple-950/30 to-transparent backdrop-blur-sm" />

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        @keyframes shootingStar {
          0% {
            transform: translateX(0) translateY(0) rotate(-45deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(-150vw) translateY(150vh) rotate(-45deg);
            opacity: 0;
          }
        }

        @keyframes etherealFloat {
          0%, 100% {
            opacity: 0;
            transform: translateY(0) translateX(0) scale(0.5);
          }
          25% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
            transform: translateY(-40px) translateX(20px) scale(1);
          }
          75% {
            opacity: 0.3;
          }
        }

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

        @keyframes float-delayed {
          0%, 100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(20px, -20px);
          }
        }
      `}</style>
    </div>
  )
}
