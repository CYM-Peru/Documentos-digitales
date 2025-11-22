'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

/**
 * Card con hover effects mejorados
 * Inspirado en interacciones de TyT Center
 */
export function AnimatedCard({ children, className = '', onClick }: AnimatedCardProps) {
  return (
    <motion.div
      whileHover={{
        scale: 1.03,
        y: -8,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
      }}
      whileTap={{ scale: 0.97 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25
      }}
      className={`cursor-pointer transition-colors ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}
