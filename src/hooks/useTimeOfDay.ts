import { useState, useEffect } from 'react'

export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night'

export interface TimeTheme {
  period: TimeOfDay
  label: string
  greeting: string
}

export function useTimeOfDay(): TimeTheme {
  const [timeTheme, setTimeTheme] = useState<TimeTheme>({
    period: 'day',
    label: 'Día',
    greeting: 'Buenos días',
  })

  useEffect(() => {
    const updateTimeOfDay = () => {
      const hour = new Date().getHours()

      let period: TimeOfDay
      let label: string
      let greeting: string

      // Tres períodos profesionales: Día, Atardecer, Noche suave
      if (hour >= 6 && hour < 18) {
        period = 'day'
        label = 'Día'
        greeting = 'Buenos días'
      } else if (hour >= 18 && hour < 21) {
        period = 'sunset'
        label = 'Atardecer'
        greeting = 'Buenas tardes'
      } else {
        // Noche pero con colores suaves, no tan oscuro
        period = 'night'
        label = 'Noche'
        greeting = 'Buenas noches'
      }

      setTimeTheme({ period, label, greeting })
    }

    updateTimeOfDay()
    // Actualizar cada minuto
    const interval = setInterval(updateTimeOfDay, 60000)

    return () => clearInterval(interval)
  }, [])

  return timeTheme
}
