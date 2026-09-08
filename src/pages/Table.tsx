import { useCallback, useEffect, useState } from 'react'
import { HalftoneCmyk } from '@paper-design/shaders-react'
import { QR_CONSULTING, QR_INSTAGRAM, QR_JOIN, type QrSvg } from './tableQr'
import './Table.css'


/** Pause the shader for reduced-motion users and whenever the tab is hidden. */
function useShaderPaused() {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPaused(mq.matches || document.hidden)
    update()
    mq.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      mq.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return paused
}

/** Browser full-screen needs a user gesture, so it is a button, hidden once active. */
function useFullscreen() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    const update = () => setActive(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])
  const enter = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])
  return { active, enter, supported: typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement }
}

function Qr({ qr, label }: { qr: QrSvg; label: string }) {
  return (
    <svg className="tb-qr" viewBox={qr.viewBox} role="img" aria-label={label} shapeRendering="crispEdges">
      <path d={qr.d} />
    </svg>
  )
}

/** Self-serve screen for the laptop at recruiting tables. Standalone: no nav, no footer. */
export default function Table() {
  const paused = useShaderPaused()
  const fullscreen = useFullscreen()

  useEffect(() => {
    document.title = 'UBLDA · Scan'
  }, [])

  return (
    <div className="tb">
      {/* Same Ross-exterior halftone as the consulting hero, with the shader's
          grain animating and a slow drift so the backdrop visibly moves. */}
      <div className={`tb-bg ${paused ? 'tb-bg--still' : ''}`} aria-hidden="true">
        <div className="tb-bg__drift">
          <HalftoneCmyk
            image="/ross-modern-exterior.jpg"
            colorBack="#FAF9F6"
            colorC="#2BBAB0"
            colorM="#0F2B3C"
            colorY="#D4A034"
            colorK="#0F2B3C"
            size={0.3}
            type="ink"
            softness={0.5}
            contrast={1.05}
            gridNoise={0.08}
            floodC={0}
            gainC={0.12}
            gainM={-0.25}
            gainY={-0.4}
            gainK={-0.12}
            grainMixer={0.08}
            grainOverlay={0.03}
            grainSize={0.25}
            speed={paused ? 0 : 0.6}
            frame={4000}
            fit="cover"
            minPixelRatio={1}
            maxPixelCount={1400000}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      <main className="tb-sheet" id="main-content">
        <header className="tb-head">
          <div className="tb-brand">
            <img src="/logo-1000.png" alt="" width={44} height={44} />
            <h1 className="tb-brand__name">UBLDA</h1>
          </div>
          {fullscreen.supported && !fullscreen.active && (
            <button type="button" className="tb-fullscreen" onClick={fullscreen.enter}>
              Full screen
            </button>
          )}
        </header>

        <div className="tb-grid">
          <section className="tb-card tb-card--primary" aria-labelledby="tb-apply">
            <h2 id="tb-apply" className="tb-card__title">Apply to UBLDA Consulting</h2>
            <div className="tb-qrwrap">
              <Qr qr={QR_CONSULTING} label="QR code that opens ublda.org/consulting" />
            </div>
            <p className="tb-card__note">Closes Sept 20</p>
          </section>

          <section className="tb-card" aria-labelledby="tb-join">
            <h2 id="tb-join" className="tb-card__title">Join UBLDA</h2>
            <div className="tb-qrwrap">
              <Qr qr={QR_JOIN} label="QR code that opens the UBLDA membership sign-up form" />
            </div>
            <p className="tb-card__note tb-treat">Sour Patch Kids</p>
          </section>

          <section className="tb-card" aria-labelledby="tb-follow">
            <h2 id="tb-follow" className="tb-card__title">Follow @michiganublda</h2>
            <div className="tb-qrwrap">
              <Qr qr={QR_INSTAGRAM} label="QR code that opens the UBLDA Instagram profile" />
            </div>
            <p className="tb-card__note tb-treat">Poppi</p>
          </section>
        </div>
      </main>
    </div>
  )
}
