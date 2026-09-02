import { createContext, useContext } from 'react'
import type { MotionMode } from './engine'
import type { Theme } from './parts'

export interface ConsultingUi {
  theme: Theme
  mode: MotionMode
  reducedMotion: boolean
}

export const ConsultingContext = createContext<ConsultingUi>({ theme: 'dark', mode: 'full', reducedMotion: false })

export const useConsultingUi = () => useContext(ConsultingContext)
