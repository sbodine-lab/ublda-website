import { useEffect, useRef, useState } from 'react'
import { Warp } from '@paper-design/shaders-react'
import { useConsultingUi } from './context'
import { RossGlass, RossHalftone, type RossSource } from './BrandShaders'

const COLORS = ['#FAF9F6', '#D9EAE5', '#89BBAF', '#E2DBCC']

export function HeroBackdrop() {
  const params = new URLSearchParams(window.location.search)
  const art = params.get('art') === 'warp' ? 'warp' : params.get('art') === 'halftone' ? 'halftone' : 'glass'
  const source: RossSource = params.get('source') === 'detail' ? 'detail' : params.get('source') === 'illustration' ? 'illustration' : 'photo'
  const dots = Math.min(0.65, Math.max(0.1, Number(params.get('dots')) || 0.24))
  const { reducedMotion } = useConsultingUi()
  const rootRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)
  const paused = reducedMotion || !active

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let inView = true
    const update = () => setActive(inView && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    })
    observer.observe(root)
    document.addEventListener('visibilitychange', update)
    update()
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return (
    <div className={`pc-hero-backdrop ${art !== 'warp' ? 'pc-hero-backdrop--photo' : ''}`} ref={rootRef} aria-hidden="true" data-paused={paused}>
      <div className="pc-hero-backdrop__sticky">
        {art !== 'warp' ? (
          <div className="pc-hero-backdrop__shader" style={{ width: '100%', height: '100%' }}>
            <div className="pc-hero-backdrop__drift">
              {art === 'glass' ? <RossGlass /> : <RossHalftone source={source} gold={params.get('gold') === '1'} size={dots} speed={paused ? 0 : 0.35} />}
            </div>
          </div>
        ) : <Warp
          className="pc-hero-backdrop__shader"
          colors={COLORS}
          shape="edge"
          shapeScale={0.35}
          scale={0.85}
          rotation={-25}
          proportion={0.42}
          softness={0.65}
          distortion={0.22}
          swirl={0.65}
          swirlIterations={6}
          speed={paused ? 0 : 0.18}
          frame={12000}
          minPixelRatio={1}
          maxPixelCount={1200000}
          style={{ width: '100%', height: '100%' }}
        />}
      </div>
    </div>
  )
}
