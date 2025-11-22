'use client'

import { useEffect, useState } from 'react'

export default function DawnBackground() {
  const [birds, setBirds] = useState<Array<{ id: number; delay: number; duration: number; path: number }>>([])

  useEffect(() => {
    // Generar pájaros con intervalos aleatorios
    const generateBirds = () => {
      const newBirds = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        delay: Math.random() * 15,
        duration: 15 + Math.random() * 10,
        path: Math.random() * 60 + 20, // Entre 20% y 80% de altura
      }))
      setBirds(newBirds)
    }

    generateBirds()
    const interval = setInterval(generateBirds, 30000) // Regenerar cada 30s

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradiente del cielo - amanecer realista */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFB6C1] via-[#FFD4A3] via-[#FFDAB9] to-[#87CEEB] transition-all duration-1000" />

      {/* Sol naciente */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-64 h-64">
        {/* Rayos del sol */}
        {[...Array(12)].map((_, i) => (
          <div
            key={`ray-${i}`}
            className="absolute top-1/2 left-1/2 w-1 h-32 bg-gradient-to-t from-yellow-300/40 to-transparent origin-bottom"
            style={{
              transform: `rotate(${i * 30}deg) translateX(-50%)`,
              animation: `sunRays 4s ease-in-out infinite ${i * 0.2}s`,
            }}
          />
        ))}

        {/* Sol */}
        <div className="absolute inset-0 bg-gradient-radial from-yellow-200 via-orange-300 to-orange-400 rounded-full shadow-2xl animate-pulse-slow">
          <div className="absolute inset-2 bg-gradient-radial from-yellow-100 to-yellow-200 rounded-full" />
        </div>

        {/* Brillo del sol */}
        <div className="absolute inset-0 bg-yellow-200/30 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      {/* Nubes realistas con movimiento suave */}
      {[...Array(8)].map((_, i) => (
        <div
          key={`cloud-${i}`}
          className="absolute"
          style={{
            top: `${10 + i * 12}%`,
            left: `-20%`,
            animation: `floatClouds ${40 + i * 10}s linear infinite`,
            animationDelay: `${i * -5}s`,
          }}
        >
          {/* Nube 3D con múltiples capas */}
          <div className="relative">
            <div className="absolute w-24 h-12 bg-white/40 rounded-full blur-sm" />
            <div className="absolute w-32 h-14 bg-white/50 rounded-full blur-sm -translate-x-4 translate-y-1" />
            <div className="absolute w-28 h-12 bg-white/45 rounded-full blur-sm translate-x-8 translate-y-2" />
            <div className="absolute w-20 h-10 bg-white/35 rounded-full blur-sm translate-x-16 translate-y-1" />
          </div>
        </div>
      ))}

      {/* Pájaros volando con movimiento realista */}
      {birds.map((bird) => (
        <div
          key={bird.id}
          className="absolute left-0"
          style={{
            top: `${bird.path}%`,
            animation: `flyBird ${bird.duration}s linear infinite`,
            animationDelay: `${bird.delay}s`,
          }}
        >
          {/* Pájaro SVG con aleteo */}
          <svg
            width="32"
            height="24"
            viewBox="0 0 32 24"
            className="text-gray-800/70"
            style={{ animation: 'flapWings 0.5s ease-in-out infinite' }}
          >
            {/* Ala izquierda */}
            <path
              d="M8,12 Q4,8 2,12 Q4,14 8,12 Z"
              fill="currentColor"
              className="origin-right"
              style={{ animation: 'flapLeft 0.5s ease-in-out infinite' }}
            />
            {/* Cuerpo */}
            <ellipse cx="16" cy="12" rx="4" ry="3" fill="currentColor" />
            {/* Ala derecha */}
            <path
              d="M24,12 Q28,8 30,12 Q28,14 24,12 Z"
              fill="currentColor"
              className="origin-left"
              style={{ animation: 'flapRight 0.5s ease-in-out infinite' }}
            />
          </svg>
        </div>
      ))}

      {/* Partículas de luz matutina */}
      {[...Array(30)].map((_, i) => (
        <div
          key={`particle-${i}`}
          className="absolute w-1 h-1 bg-yellow-200/40 rounded-full"
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}

      {/* Niebla matutina en la parte inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/30 to-transparent backdrop-blur-sm" />

      <style jsx>{`
        @keyframes floatClouds {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(120vw);
          }
        }

        @keyframes flyBird {
          0% {
            transform: translateX(0) translateY(0);
          }
          25% {
            transform: translateX(30vw) translateY(-20px);
          }
          50% {
            transform: translateX(50vw) translateY(0);
          }
          75% {
            transform: translateX(80vw) translateY(-15px);
          }
          100% {
            transform: translateX(110vw) translateY(0);
          }
        }

        @keyframes flapLeft {
          0%, 100% {
            transform: rotateY(0deg);
          }
          50% {
            transform: rotateY(-30deg);
          }
        }

        @keyframes flapRight {
          0%, 100% {
            transform: rotateY(0deg);
          }
          50% {
            transform: rotateY(30deg);
          }
        }

        @keyframes sunRays {
          0%, 100% {
            opacity: 0.3;
            transform: rotate(var(--rotation)) translateX(-50%) scaleY(1);
          }
          50% {
            opacity: 0.6;
            transform: rotate(var(--rotation)) translateX(-50%) scaleY(1.2);
          }
        }

        @keyframes twinkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1.5);
          }
        }
      `}</style>
    </div>
  )
}
