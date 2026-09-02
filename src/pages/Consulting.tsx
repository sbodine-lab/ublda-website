import { useEffect, useState } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import { ArrowUpRight } from 'lucide-react'
import { CONSULTING_FORM_URL } from '../lib/forms'
import {
  CLIENT,
  CONTACT_MAILTO,
  HERO_LEAD,
  HERO_PHRASES,
  LEADERS,
  PARTNERS,
  PARTNER_STATEMENT,
  SERVICES,
  STATEMENT_1,
  STATEMENT_2,
  STEPS,
} from './consulting/content'
import { startConsultingMotion } from './consulting/motion'
import { DotButton, HeroRings, NewTab } from './consulting/parts'
import { ConsultingShell } from './consulting/Shell'
import { useConsultingUi } from './consulting/context'
import './Consulting.css'

const SHADER_DARK = ['#0B1F2F', '#14374E', '#2BBAB0', '#091E2A']
const SHADER_LIGHT = ['#FAF9F6', '#E8F6F4', '#2BBAB0', '#D8D6D0']

/* Type a phrase in (50ms a character), hold it, delete it (30ms), move on. */
function useTypewriter(phrases: string[], enabled: boolean) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!enabled) return
    let index = 0
    let timer = 0
    let cancelled = false
    const typeIn = (s: string, k: number, done: () => void) => {
      if (cancelled) return
      setText(s.slice(0, k))
      if (k < s.length) timer = window.setTimeout(() => typeIn(s, k + 1, done), 50)
      else done()
    }
    const typeOut = (s: string, k: number, done: () => void) => {
      if (cancelled) return
      setText(s.slice(0, k))
      if (k > 0) timer = window.setTimeout(() => typeOut(s, k - 1, done), 30)
      else done()
    }
    const cycle = () => {
      const s = phrases[index]
      typeIn(s, 0, () => {
        timer = window.setTimeout(() => {
          typeOut(s, s.length, () => {
            index = (index + 1) % phrases.length
            cycle()
          })
        }, 2000)
      })
    }
    cycle()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [phrases, enabled])
  return enabled ? text : phrases[0]
}

function Words({ text, className }: { text: string; className: string }) {
  return (
    <p className={`pc-statement__p ${className}`}>
      {text.split(' ').map((w, i) => (
        <span className="pc-w" key={i}>
          {' '}
          {w}
        </span>
      ))}
    </p>
  )
}

function StatementBody({ ghost = false }: { ghost?: boolean }) {
  return (
    <section className={`pc-statement ${ghost ? 'pc-statement--ghost' : ''}`} aria-hidden={ghost || undefined}>
      <Words text={STATEMENT_1} className="pc-statement__p1" />
      <Words text={STATEMENT_2} className="pc-statement__p2" />
      <DotButton to="/consulting/practice" className="pc-statement__btn">
        The practice
      </DotButton>
    </section>
  )
}

function HomeBody() {
  const { theme, mode, reducedMotion } = useConsultingUi()
  const [openService, setOpenService] = useState<string | null>(null)
  const typed = useTypewriter(HERO_PHRASES, !reducedMotion)
  const shaderSpeed = reducedMotion ? 0 : 0.2
  const shaderColors = theme === 'dark' ? SHADER_DARK : SHADER_LIGHT
  const isStatic = mode === 'static'

  return (
    <>
      {/* 1 · Hero */}
      <section className="pc-hero">
        <div className="pc-hero__art" aria-hidden="true">
          <HeroRings />
        </div>
        <div className="pc-hero__text">
          <p className="pc-hero__lead">{HERO_LEAD}</p>
          <h1 className="pc-hero__title">
            <span className="sr-only">
              {HERO_LEAD} {HERO_PHRASES.join(' ')} UBLDA Consulting helps organizations find out.
            </span>
            <span className="pc-hero__typed" aria-hidden="true">
              {typed}
              <span className="pc-hero__caret" />
            </span>
          </h1>
          <a href={CONSULTING_FORM_URL} target="_blank" rel="noopener noreferrer" className="pc-hero__apply">
            Apply for Fall 2026
            <span className="pc-hero__apply-meta">closes Sep 22</span>
            <NewTab />
            <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
          </a>
        </div>
        <div className="pc-hero__fade" aria-hidden="true" />
      </section>

      {/* 2 · Statement */}
      <StatementBody />

      {/* 3 · Services */}
      <section className="pc-services" id="consulting-services">
        <div className="pc-services__inner">
          <div className="pc-services__left">
            <h2 className="pc-services__title">What we work on</h2>
            <DotButton to="/consulting/services" className="pc-services__btn">
              All services
            </DotButton>
          </div>
          <div className="pc-services__right">
            {SERVICES.map((s) => {
              const open = openService === s.id
              return (
                <div className={`pc-acc ${open ? 'pc-acc--open' : ''}`} key={s.id}>
                  <div className="pc-acc__row">
                    <span className="pc-acc__cir" aria-hidden="true" />
                    {isStatic ? (
                      <button
                        type="button"
                        className="pc-acc__head pc-acc__head--btn"
                        aria-expanded={open}
                        aria-controls={`pc-acc-${s.id}`}
                        onClick={() => setOpenService(open ? null : s.id)}
                      >
                        <span>{s.title}</span>
                        <span className="pc-acc__plus" aria-hidden="true" />
                      </button>
                    ) : (
                      <h3 className="pc-acc__head">{s.title}</h3>
                    )}
                  </div>
                  <div className="pc-acc__dec" id={`pc-acc-${s.id}`}>
                    <p>{s.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4 · Journey (horizontal) */}
      <section className="pc-journey" id="consulting-recruiting" aria-labelledby="pc-journey-title">
        <h2 id="pc-journey-title" className="sr-only">
          Fall 2026 recruiting, step by step
        </h2>
        <div className="pc-journey__track">
          {STEPS.map((step) => (
            <article className={`pc-card pc-card--${step.tone}`} key={step.num}>
              <div className="pc-card__label">
                <h3>
                  {step.num} &middot; {step.title}
                </h3>
              </div>
              <div className="pc-card__frame">
                <div className="pc-card__art" aria-hidden="true">
                  <span className="pc-card__num">{step.num}</span>
                  <span className="pc-card__ring" />
                  <span className="pc-card__ring pc-card__ring--2" />
                </div>
                <div className="pc-card__body">
                  <p className="pc-card__when">{step.when}</p>
                  <p className="pc-card__desc">{step.desc}</p>
                </div>
              </div>
            </article>
          ))}
          <div className="pc-journey__spacer" aria-hidden="true" />
          <div className="pc-journey__endwrap">
            <a href={CONSULTING_FORM_URL} target="_blank" rel="noopener noreferrer" className="pc-journey__end">
              <span className="pc-journey__end-cir" aria-hidden="true" />
              <span className="pc-journey__end-label">Apply for Fall 2026</span>
            </a>
          </div>
        </div>
      </section>

      {/* 5 · Client */}
      <section className="pc-client" id="consulting-clients">
        <div className="pc-client__stage">
          <div className="pc-client__media" aria-hidden="true">
            <MeshGradient colors={shaderColors} distortion={0.85} swirl={0.55} speed={shaderSpeed} style={{ width: '100%', height: '100%' }} />
          </div>
          <div className="pc-client__lockup">
            <p className="pc-client__label">{CLIENT.label}</p>
            <h2 className="pc-client__name">{CLIENT.name}</h2>
            <p className="pc-client__project">{CLIENT.project}</p>
            <p className="pc-client__desc">{CLIENT.desc}</p>
            <a href={CLIENT.url} target="_blank" rel="noopener noreferrer" className="pc-client__link pc-line">
              arcthrift.com
              <NewTab />
              <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="pc-client__over" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div className="pc-client__over-row" key={row}>
              <span className={`pc-chip pc-chip--${row * 2 + 1}`}>{CLIENT.chips[row * 2]}</span>
              <span className={`pc-chip pc-chip--${row * 2 + 2}`}>{CLIENT.chips[row * 2 + 1]}</span>
            </div>
          ))}
        </div>
        <ul className="pc-client__chips" aria-label="Project at a glance">
          {CLIENT.chips.map((c) => (
            <li className="pc-chip" key={c}>
              {c}
            </li>
          ))}
        </ul>
      </section>

      {/* 6 · Partners */}
      <section className="pc-partners" aria-labelledby="pc-partners-title">
        <div className="pc-partners__wrap">
          <h2 id="pc-partners-title" className="pc-partners__title">
            {PARTNER_STATEMENT}
          </h2>
          <DotButton to="/consulting/partners" className="pc-partners__btn">
            Our partners
          </DotButton>
        </div>
        <div className="pc-marquee" aria-hidden="true">
          {[0, 1, 2].map((set) => (
            <div className="pc-marquee__set" key={set}>
              {PARTNERS.map((p) => (
                <img src={p.src} alt="" key={p.src} loading="lazy" decoding="async" />
              ))}
            </div>
          ))}
        </div>
        <ul className="sr-only">
          {PARTNERS.map((p) => (
            <li key={p.src}>{p.alt}</li>
          ))}
        </ul>
      </section>

      {/* 7 · Call to action */}
      <section className="pc-cta" id="consulting-contact">
        <h2 className="pc-cta__title">
          Have a project in mind?
          <br />
          Or want to be on the team?
        </h2>
        <div className="pc-cta__btns">
          <DotButton href={CONTACT_MAILTO} className="pc-dotbtn--big">
            start a conversation
          </DotButton>
          <DotButton href={CONSULTING_FORM_URL} external className="pc-dotbtn--big">
            apply for fall 2026
          </DotButton>
        </div>
        <p className="pc-cta__note">
          Questions? Email {LEADERS[0].name} or {LEADERS[1].name}.
        </p>
      </section>
    </>
  )
}

export default function Consulting() {
  return (
    <ConsultingShell title="UBLDA Consulting" motion={startConsultingMotion} disc={<StatementBody ghost />} cursor>
      <HomeBody />
    </ConsultingShell>
  )
}
