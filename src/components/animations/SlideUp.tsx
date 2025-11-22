'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, ReactNode } from 'react'

interface SlideUpProps {
  children: ReactNode
  delay?: number
  duration?: number
  distance?: number
  className?: string
}

/**
 * Componente que sube desde abajo con fade-in
 * Similar a translate3d() usado en TyT Center
 */
export function SlideUp({
  children,
  delay = 0,
  duration = 0.8,
  distance = 80,
  className = ''
}: SlideUpProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.1 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: distance }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1] // Easing suave
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
