'use client'

import { useTimeOfDay } from '@/hooks/useTimeOfDay'
import DawnBackground from './backgrounds/DawnBackground'
import DayBackground from './backgrounds/DayBackground'
import SunsetBackground from './backgrounds/SunsetBackground'
import NightBackground from './backgrounds/NightBackground'

export default function TimeBasedBackground() {
  const { period } = useTimeOfDay()

  return (
    <div className="absolute inset-0 transition-opacity duration-1000">
      {period === 'dawn' && <DawnBackground />}
      {period === 'day' && <DayBackground />}
      {period === 'sunset' && <SunsetBackground />}
      {period === 'night' && <NightBackground />}
    </div>
  )
}
