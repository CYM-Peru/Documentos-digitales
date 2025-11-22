'use client'

import { useEffect, useState } from 'react'

export default function DayBackground() {
  const [birds, setBirds] = useState<Array<{ id: number; delay: number; duration: number; path: number }>>([])

  useEffect(() => {
    const generateBirds = () => {
      const newBirds = Array.from({ length: 7 }, (_, i) => ({
        id: i,
        delay: Math.random() * 20,
        duration: 12 + Math.random() * 8,
        path: Math.random() * 50 + 15,
      }))
      setBirds(newBirds)
    }

    generateBirds()
    const interval = setInterval(generateBirds, 25000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Cielo azul radiante con gradiente realista */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#4A9FF5] via-[#73B9F2] to-[#B3E0F2] transition-all duration-1000" />

      {/* Sol brillante en posición alta */}
      <div className="absolute top-20 right-1/4 w-40 h-40">
        {/* Rayos del sol más sutiles */}
        {[...Array(16)].map((_, i) => (
          <div
            key={`ray-${i}`}
            className="absolute top-1/2 left-1/2 w-0.5 h-24 bg-gradient-to-t from-yellow-200/20 to-transparent origin-bottom"
            style={{
              transform: `rotate(${i * 22.5}deg) translateX(-50%)`,
              animation: `gentleRays 6s ease-in-out infinite ${i * 0.3}s`,
            }}
          />
        ))}

        {/* Sol principal */}
        <div className="absolute inset-0 bg-gradient-radial from-yellow-300 via-yellow-400 to-yellow-500 rounded-full">
          <div className="absolute inset-1 bg-gradient-radial from-yellow-100 to-yellow-200 rounded-full" />
        </div>

        {/* Halo del sol */}
        <div className="absolute -inset-4 bg-yellow-200/20 rounded-full blur-2xl" />
      </div>

      {/* Nubes volumétricas realistas - múltiples capas */}
      {[...Array(12)].map((_, i) => {
        const size = 1 + Math.random() * 0.5
        const speed = 50 + Math.random() * 30

        return (
          <div
            key={`cloud-${i}`}
            className="absolute"
            style={{
              top: `${5 + i * 8}%`,
              left: `-30%`,
              animation: `driftClouds ${speed}s linear infinite`,
              animationDelay: `${i * -4}s`,
              transform: `scale(${size})`,
            }}
          >
            <div className="relative">
              {/* Sombra de la nube */}
              <div className="absolute w-40 h-16 bg-gray-300/10 rounded-full blur-md translate-y-2" />

              {/* Capas de la nube para efecto 3D */}
              <div className="absolute w-28 h-14 bg-white/90 rounded-full" />
              <div className="absolute w-36 h-16 bg-white/95 rounded-full -translate-x-6 translate-y-1" />
              <div className="absolute w-32 h-14 bg-white/90 rounded-full translate-x-10 translate-y-2" />
              <div className="absolute w-24 h-12 bg-white/85 rounded-full translate-x-20 translate-y-1" />

              {/* Bordes iluminados */}
              <div className="absolute w-36 h-16 bg-white rounded-full -translate-x-6 translate-y-1 blur-sm" />
            </div>
          </div>
        )
      })}

      {/* Pájaros volando en formación V ocasional */}
      {birds.map((bird, index) => {
        const isInFormation = index < 3
        const formationOffset = isInFormation ? (index - 1) * 15 : 0

        return (
          <div
            key={bird.id}
            className="absolute left-0"
            style={{
              top: `${bird.path + formationOffset}%`,
              animation: `soarBird ${bird.duration}s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
              animationDelay: `${bird.delay}s`,
            }}
          >
            <svg
              width="28"
              height="20"
              viewBox="0 0 28 20"
              className="text-gray-700/60"
            >
              {/* Pájaro con aleteo realista */}
              <g style={{ animation: 'smoothFlap 0.6s ease-in-out infinite' }}>
                <path
                  d="M6,10 Q2,6 1,10 Q2,12 6,10 Z"
                  fill="currentColor"
                  style={{ animation: 'wingBeat 0.6s ease-in-out infinite', transformOrigin: '6px 10px' }}
                />
                <ellipse cx="14" cy="10" rx="3" ry="2.5" fill="currentColor" />
                <path
                  d="M22,10 Q26,6 27,10 Q26,12 22,10 Z"
                  fill="currentColor"
                  style={{ animation: 'wingBeat 0.6s ease-in-out infinite reverse', transformOrigin: '22px 10px' }}
                />
              </g>
            </svg>
          </div>
        )
      })}

      {/* Partículas de luz solar */}
      {[...Array(20)].map((_, i) => (
        <div
          key={`sunbeam-${i}`}
          className="absolute w-1.5 h-1.5 bg-white/30 rounded-full"
          style={{
            top: `${Math.random() * 60}%`,
            left: `${Math.random() * 100}%`,
            animation: `floatGently ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}

      {/* Efecto atmosférico - bruma distante */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white/20 via-blue-100/10 to-transparent" />

      <style jsx>{`
        @keyframes driftClouds {
          0% {
            transform: translateX(0) translateY(0);
          }
          50% {
            transform: translateX(60vw) translateY(-10px);
          }
          100% {
            transform: translateX(130vw) translateY(0);
          }
        }

        @keyframes soarBird {
          0% {
            transform: translateX(0) translateY(0) rotate(0deg);
          }
          25% {
            transform: translateX(25vw) translateY(-30px) rotate(-5deg);
          }
          50% {
            transform: translateX(55vw) translateY(0) rotate(0deg);
          }
          75% {
            transform: translateX(80vw) translateY(-20px) rotate(5deg);
          }
          100% {
            transform: translateX(110vw) translateY(0) rotate(0deg);
          }
        }

        @keyframes wingBeat {
          0%, 100% {
            transform: scaleY(1) rotateX(0deg);
          }
          50% {
            transform: scaleY(0.7) rotateX(-20deg);
          }
        }

        @keyframes smoothFlap {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }

        @keyframes gentleRays {
          0%, 100% {
            opacity: 0.15;
            transform: rotate(var(--rotation)) translateX(-50%) scaleY(1);
          }
          50% {
            opacity: 0.3;
            transform: rotate(var(--rotation)) translateX(-50%) scaleY(1.1);
          }
        }

        @keyframes floatGently {
          0%, 100% {
            opacity: 0.2;
            transform: translateY(0) scale(1);
          }
          50% {
            opacity: 0.6;
            transform: translateY(-20px) scale(1.3);
          }
        }
      `}</style>
    </div>
  )
}
