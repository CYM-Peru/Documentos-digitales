'use client'

import { useState, useEffect } from 'react'

/**
 * Hook para detectar si el dispositivo es móvil
 * Detecta basándose en:
 * 1. Media query para ancho de pantalla
 * 2. User agent para iOS/Android
 * 3. Capacidad touch
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      // Check 1: Media query para dispositivos pequeños
      const mediaQuery = window.matchMedia('(max-width: 768px)')

      // Check 2: User agent para iOS/Android
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i
      const isUserAgentMobile = mobileRegex.test(userAgent.toLowerCase())

      // Check 3: Capacidad touch
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0

      // Es móvil si cumple media query Y (tiene user agent móvil O tiene touch)
      const mobile = mediaQuery.matches && (isUserAgentMobile || hasTouchScreen)

      setIsMobile(mobile)
    }

    // Check inicial
    checkIsMobile()

    // Escuchar cambios en el tamaño de ventana
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handler = () => checkIsMobile()

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler)
    } else {
      // Older browsers
      mediaQuery.addListener(handler)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handler)
      } else {
        mediaQuery.removeListener(handler)
      }
    }
  }, [])

  return isMobile
}
