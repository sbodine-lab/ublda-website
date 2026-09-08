import { useEffect, useRef, useState } from 'react'
import { AnimatedMark } from './BrandShaders'
import { useConsultingUi } from './context'

export function HeroMark() {
  const { reducedMotion } = useConsultingUi()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    let visible = true
    const update = () => setActive(visible && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      update()
    })
    observer.observe(root)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return <div className="pc-hero__mark" ref={ref} aria-hidden="true">
    <AnimatedMark effect="heatmap" paused={reducedMotion || !active} background="#FAF9F600" />
    <img src="/logo-mark.svg" alt="" className="pc-hero__mark-colors" />
  </div>
}
