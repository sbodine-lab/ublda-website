import { useEffect, useState } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import { QR_CONSULTING, QR_INSTAGRAM, QR_JOIN, type QrSvg } from './tableQr'
import './Table.css'

/* Cream, the site's teal-soft accent, sage, a warm gold-soft, and a muted teal.
   Low speed and distortion: the background should read as paper, not a screensaver. */
const SHADER_COLORS = ['#FAF9F6', '#E8F6F4', '#D9EAE5', '#F3EAD3', '#9CCBC1']

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

  useEffect(() => {
    document.title = 'UBLDA · Sign up and follow'
  }, [])

  return (
    <div className="tb">
      <div className="tb-bg" aria-hidden="true">
        <MeshGradient
          colors={SHADER_COLORS}
          distortion={0.55}
          swirl={0.25}
          grainMixer={0.05}
          grainOverlay={0.02}
          speed={paused ? 0 : 0.14}
          frame={9000}
          minPixelRatio={1}
          maxPixelCount={1200000}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <main className="tb-sheet" id="main-content">
        <header className="tb-head">
          <div className="tb-brand">
            <img src="/logo-1000.png" alt="" width={44} height={44} />
            <span className="tb-brand__name">UBLDA</span>
            <span className="tb-brand__sub">Undergraduate Business Leaders for Diverse Abilities · Michigan Ross</span>
          </div>
          <p className="tb-eyebrow">BBA Meet the Clubs · Fall 2026</p>
        </header>

        <div className="tb-lede">
          <h1 className="tb-title">Disability inclusion belongs in business.</h1>
          <p className="tb-sub">Scan with your phone camera. Show us the screen, take a treat.</p>
        </div>

        <div className="tb-grid">
          <section className="tb-card tb-card--primary" aria-labelledby="tb-apply">
            <p className="tb-card__eyebrow">UBLDA Consulting · Fall 2026</p>
            <h2 id="tb-apply" className="tb-card__title">Apply for the consulting team</h2>
            <div className="tb-qrwrap">
              <Qr qr={QR_CONSULTING} label="QR code that opens ublda.org/consulting, where the application button is" />
            </div>
            <p className="tb-card__body">Real clients. Three short answers. No consulting experience needed.</p>
            <p className="tb-card__meta">
              <span className="tb-card__deadline">Applications close Sept 20</span>
              <span>ublda.org/consulting</span>
            </p>
          </section>

          <section className="tb-card" aria-labelledby="tb-join">
            <p className="tb-card__eyebrow">Membership</p>
            <h2 id="tb-join" className="tb-card__title">Join UBLDA</h2>
            <div className="tb-qrwrap">
              <Qr qr={QR_JOIN} label="QR code that opens the UBLDA membership sign-up form" />
            </div>
            <p className="tb-card__body">Free and open to every U-M student. Three fields, about fifteen seconds.</p>
            <p className="tb-card__meta">
              <span className="tb-treat">Sour Patch Kids</span>
              <span>ublda.org/join</span>
            </p>
          </section>

          <section className="tb-card" aria-labelledby="tb-follow">
            <p className="tb-card__eyebrow">Follow</p>
            <h2 id="tb-follow" className="tb-card__title">@michiganublda</h2>
            <div className="tb-qrwrap">
              <Qr qr={QR_INSTAGRAM} label="QR code that opens the UBLDA Instagram profile" />
            </div>
            <p className="tb-card__body">Events, deadlines, and client work. Also on LinkedIn as UBLDA.</p>
            <p className="tb-card__meta">
              <span className="tb-treat">Poppi</span>
              <span>instagram.com/michiganublda</span>
            </p>
          </section>
        </div>

        <footer className="tb-foot">
          <span>ublda.org</span>
          <a href={QR_JOIN.href}>No phone? Sign up on this laptop</a>
        </footer>
      </main>
    </div>
  )
}
