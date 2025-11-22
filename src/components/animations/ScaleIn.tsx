'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, ReactNode } from 'react'

interface ScaleInProps {
  children: ReactNode
  delay?: number
  duration?: number
  initialScale?: number
  className?: string
}

/**
 * Componente que hace scale-in con fade
 * Para cards y elementos destacados
 */
export function ScaleIn({
  children,
  delay = 0,
  duration = 0.6,
  initialScale = 0.8,
  className = ''
}: ScaleInProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: initialScale }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: initialScale }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
