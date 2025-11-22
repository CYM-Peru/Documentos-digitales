'use client'

import { useEffect, useState } from 'react'

export default function SunsetBackground() {
  const [birds, setBirds] = useState<Array<{ id: number; delay: number; duration: number; path: number }>>([])

  useEffect(() => {
    const generateBirds = () => {
      const newBirds = Array.from({ length: 6 }, (_, i) => ({
        id: i,
        delay: Math.random() * 18,
        duration: 14 + Math.random() * 6,
        path: Math.random() * 40 + 30,
      }))
      setBirds(newBirds)
    }

    generateBirds()
    const interval = setInterval(generateBirds, 28000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Gradiente de atardecer épico */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FF6B6B] via-[#FFB347] via-[#FFA07A] via-[#DDA0DD] to-[#9370DB] transition-all duration-1000" />

      {/* Sol descendente con resplandor intenso */}
      <div className="absolute bottom-16 left-1/3 w-56 h-56">
        {/* Rayos dramáticos del atardecer */}
        {[...Array(20)].map((_, i) => (
          <div
            key={`ray-${i}`}
            className="absolute top-1/2 left-1/2 w-1 origin-bottom"
            style={{
              height: `${100 + Math.random() * 80}px`,
              background: `linear-gradient(to top, rgba(255, 140, 0, ${0.3 + Math.random() * 0.2}), transparent)`,
              transform: `rotate(${i * 18}deg) translateX(-50%)`,
              animation: `sunsetRays ${5 + i * 0.3}s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}

        {/* Sol con múltiples capas */}
        <div className="absolute inset-0 bg-gradient-radial from-yellow-200 via-orange-400 to-red-500 rounded-full">
          <div className="absolute inset-2 bg-gradient-radial from-yellow-100 via-orange-300 to-orange-400 rounded-full" />
        </div>

        {/* Resplandor intenso del atardecer */}
        <div className="absolute -inset-8 bg-orange-400/40 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -inset-16 bg-red-400/20 rounded-full blur-[100px]" />
      </div>

      {/* Nubes con bordes dorados iluminados */}
      {[...Array(10)].map((_, i) => {
        const size = 0.8 + Math.random() * 0.6
        const speed = 45 + Math.random() * 25

        return (
          <div
            key={`cloud-${i}`}
            className="absolute"
            style={{
              top: `${8 + i * 9}%`,
              left: `-35%`,
              animation: `slowDrift ${speed}s linear infinite`,
              animationDelay: `${i * -5}s`,
              transform: `scale(${size})`,
            }}
          >
            <div className="relative">
              {/* Nube oscurecida con borde dorado */}
              <div className="absolute w-32 h-16 bg-purple-900/40 rounded-full blur-sm" />
              <div className="absolute w-40 h-18 bg-purple-800/50 rounded-full -translate-x-8 translate-y-1 blur-sm" />
              <div className="absolute w-36 h-16 bg-purple-900/45 rounded-full translate-x-12 translate-y-2 blur-sm" />

              {/* Borde iluminado por el sol */}
              <div className="absolute w-40 h-18 bg-gradient-to-r from-orange-400/60 via-yellow-400/50 to-transparent rounded-full -translate-x-8 translate-y-1 blur-md" />
              <div className="absolute w-32 h-16 bg-orange-300/40 rounded-full translate-x-12 blur-md" />
            </div>
          </div>
        )
      })}

      {/* Siluetas de pájaros regresando al nido */}
      {birds.map((bird) => (
        <div
          key={bird.id}
          className="absolute left-0"
          style={{
            top: `${bird.path}%`,
            animation: `returnHome ${bird.duration}s ease-in-out infinite`,
            animationDelay: `${bird.delay}s`,
          }}
        >
          <svg
            width="32"
            height="22"
            viewBox="0 0 32 22"
            className="text-black/80"
          >
            {/* Silueta de pájaro en el atardecer */}
            <g style={{ animation: 'tiredFlap 0.7s ease-in-out infinite' }}>
              <path
                d="M7,11 Q3,7 1,11 Q3,13 7,11 Z"
                fill="currentColor"
                style={{ animation: 'slowWing 0.7s ease-in-out infinite', transformOrigin: '7px 11px' }}
              />
              <ellipse cx="16" cy="11" rx="4" ry="3" fill="currentColor" />
              <path
                d="M25,11 Q29,7 31,11 Q29,13 25,11 Z"
                fill="currentColor"
                style={{ animation: 'slowWing 0.7s ease-in-out infinite reverse', transformOrigin: '25px 11px' }}
              />
            </g>
          </svg>
        </div>
      ))}

      {/* Partículas doradas flotantes */}
      {[...Array(40)].map((_, i) => (
        <div
          key={`golden-${i}`}
          className="absolute rounded-full"
          style={{
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            background: `rgba(255, ${200 + Math.random() * 55}, 0, ${0.3 + Math.random() * 0.4})`,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animation: `goldenFloat ${4 + Math.random() * 5}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 4}s`,
          }}
        />
      ))}

      {/* Reflejos en el horizonte */}
      <div className="absolute bottom-0 left-0 right-0 h-48">
        <div className="absolute inset-0 bg-gradient-to-t from-orange-600/30 via-pink-500/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/40 to-transparent" />
      </div>

      {/* Capa de bruma cálida */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-orange-300/20 to-transparent backdrop-blur-sm" />

      <style jsx>{`
        @keyframes slowDrift {
          0% {
            transform: translateX(0) translateY(0);
          }
          50% {
            transform: translateX(65vw) translateY(-15px);
          }
          100% {
            transform: translateX(135vw) translateY(0);
          }
        }

        @keyframes returnHome {
          0% {
            transform: translateX(0) translateY(0) rotate(5deg);
          }
          25% {
            transform: translateX(28vw) translateY(-25px) rotate(0deg);
          }
          50% {
            transform: translateX(50vw) translateY(-10px) rotate(-5deg);
          }
          75% {
            transform: translateX(75vw) translateY(-30px) rotate(0deg);
          }
          100% {
            transform: translateX(110vw) translateY(0) rotate(5deg);
          }
        }

        @keyframes slowWing {
          0%, 100% {
            transform: scaleY(1) rotateX(0deg);
          }
          50% {
            transform: scaleY(0.6) rotateX(-25deg);
          }
        }

        @keyframes tiredFlap {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        @keyframes sunsetRays {
          0%, 100% {
            opacity: 0.2;
            transform: rotate(var(--rotation)) translateX(-50%) scaleY(1);
          }
          50% {
            opacity: 0.5;
            transform: rotate(var(--rotation)) translateX(-50%) scaleY(1.3);
          }
        }

        @keyframes goldenFloat {
          0%, 100% {
            opacity: 0;
            transform: translateY(0) scale(0.8);
          }
          25% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
            transform: translateY(-30px) scale(1.2);
          }
          75% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  )
}
