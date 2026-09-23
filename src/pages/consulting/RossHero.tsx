import { useEffect, useRef } from 'react'

/** The original photo remains the fallback and the reduced-motion presentation. */
export function RossHero() {
  const image = useRef<HTMLImageElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const photo = image.current
    const surface = canvas.current
    if (!photo || !surface) return
    const host = surface.parentElement!
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const mobile = matchMedia('(max-width: 767px)')
    let renderer: ReturnType<(typeof import('./rossSceneRenderer'))['createRossSceneRenderer']> | undefined
    let disposed = false
    let loading = false
    let failed = false
    let visible = false
    let frame = 0
    let previous = 0
    let painted = 0
    let seconds = 0
    const allowed = () => !reduced.matches && !document.documentElement.classList.contains('st-paused')
    const active = () => !disposed && !failed && visible && !document.hidden && allowed()
    const paint = () => {
      renderer?.paint(seconds)
      surface.dataset.time = seconds.toFixed(3)
      surface.dataset.ready = 'true'
    }
    const tick = (now: number) => {
      frame = 0
      if (!renderer || !active()) return
      seconds += previous ? Math.min((now - previous) / 1000, .1) : 0
      previous = now
      if (now - painted >= 1000 / 30 - 1) {
        paint()
        painted = now
      }
      frame = requestAnimationFrame(tick)
    }
    const resize = () => {
      if (!renderer || disposed || failed) return
      renderer.resize(host.clientWidth, host.clientHeight, mobile.matches)
      paint()
    }
    const start = async () => {
      if (renderer || loading || failed || !active()) return
      loading = true
      try {
        const [module] = await Promise.all([import('./rossSceneRenderer'), photo.decode()])
        if (disposed || !active()) return
        renderer = module.createRossSceneRenderer(surface, photo)
        resize()
      } catch {
        failed = true
        surface.dataset.ready = 'false'
      } finally {
        loading = false
        sync()
      }
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previous = 0
      surface.dataset.active = String(active() && !!renderer)
      // A user pause holds the current frame; reduced motion uses the photo.
      surface.style.visibility = reduced.matches ? 'hidden' : ''
      if (!active()) return
      if (!renderer) void start()
      else frame = requestAnimationFrame(tick)
    }
    const updateTexture = () => {
      void photo.decode().then(() => {
        if (disposed || failed) return
        renderer?.upload()
        resize()
      }).catch(() => { /* Keep the current decoded texture. */ })
    }
    const lost = (event: Event) => {
      event.preventDefault()
      failed = true
      surface.dataset.ready = 'false'
      sync()
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    observer.observe(host)
    const sizing = new ResizeObserver(resize)
    sizing.observe(host)
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('studio-motion', sync)
    reduced.addEventListener('change', sync)
    mobile.addEventListener('change', resize)
    photo.addEventListener('load', updateTexture)
    surface.addEventListener('webglcontextlost', lost)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      sizing.disconnect()
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('studio-motion', sync)
      reduced.removeEventListener('change', sync)
      mobile.removeEventListener('change', resize)
      photo.removeEventListener('load', updateTexture)
      surface.removeEventListener('webglcontextlost', lost)
      renderer?.dispose()
    }
  }, [])
  return (
    <div className="st-ross-hero" aria-hidden="true">
      <img
        ref={image}
        className="st-hero-photo"
        alt=""
        src="/consulting/ross-overhead-1672.webp"
        srcSet="/consulting/ross-overhead-1080.webp 1080w, /consulting/ross-overhead-1672.webp 1672w"
        sizes="100vw"
        width={1672}
        height={941}
        fetchPriority="high"
        decoding="async"
      />
      <canvas ref={canvas} className="st-ross-scene" />
    </div>
  )
}
