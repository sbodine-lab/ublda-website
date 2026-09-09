import { useState } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import { ArrowUpRight } from 'lucide-react'
import { CONSULTING_FORM_URL } from '../lib/forms'
import {
  CLIENT,
  CONTACT_MAILTO,
  HERO_DESCRIPTION,
  LEADERS,
  PARTNERS,
  PARTNER_STATEMENT,
  SERVICES,
  STATEMENT_1,
  STATEMENT_2,
  STEPS,
} from './consulting/content'
import { startConsultingMotion } from './consulting/motion'
import { DotButton, NewTab } from './consulting/parts'
import { ConsultingShell } from './consulting/Shell'
import { HeroBackdrop } from './consulting/HeroBackdrop'
import { useConsultingUi } from './consulting/context'
import './Consulting.css'

const CLIENT_COLORS = ['#faf9f6', '#e5ece5', '#b8cec3', '#ede8dc']

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
        How the team works
      </DotButton>
    </section>
  )
}

function HomeBody() {
  const { mode, reducedMotion } = useConsultingUi()
  const [openService, setOpenService] = useState<string | null>(null)
  const shaderSpeed = reducedMotion ? 0 : 0.12
  const isStatic = mode === 'static'

  return (
    <>
      {/* The shared backdrop carries the hero into the opening statement. */}
      <div className="pc-intro">
      <HeroBackdrop />
      <section className="pc-hero">
        <div className="pc-hero__text">
          <div className="pc-hero__main">
          <h1 className="pc-hero__title">
            We consult for disability-focused organizations and accessibility teams.
          </h1>
          </div>
          <div className="pc-hero__details">
            <p className="pc-hero__description">{HERO_DESCRIPTION}</p>
            <a href={CONSULTING_FORM_URL} target="_blank" rel="noopener noreferrer" className="pc-hero__apply">
              Apply for Fall 2026
              <NewTab />
              <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* 2 · Statement */}
      <StatementBody />
      </div>

      {/* 3 · Services */}
      <section className="pc-services" id="consulting-services">
        <div className="pc-services__inner">
          <div className="pc-services__left">
            <h2 className="pc-services__title">The work you could take on</h2>
            <DotButton to="/consulting/services" className="pc-services__btn">
              View project areas
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
      <section className="pc-client" id="consulting-clients" aria-labelledby="pc-client-name">
        <div className="pc-client__media" aria-hidden="true">
          <MeshGradient
            colors={CLIENT_COLORS}
            distortion={0.25}
            swirl={0.08}
            grainMixer={0}
            grainOverlay={0.025}
            scale={0.85}
            speed={shaderSpeed}
            minPixelRatio={1}
            maxPixelCount={1400000}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <div className="pc-client__lockup">
          <div className="pc-client__copy">
            <p className="pc-client__label">{CLIENT.label}</p>
            <h2 className="pc-client__name" id="pc-client-name">{CLIENT.name}</h2>
            <p className="pc-client__desc">{CLIENT.desc}</p>
            <div className="pc-client__presentation">
              <p className="pc-client__presentation-title">{CLIENT.presentation}</p>
              <p className="pc-client__audience">{CLIENT.audience}</p>
            </div>
            <a href={CLIENT.url} target="_blank" rel="noopener noreferrer" className="pc-client__link pc-line">
              Meet our client
              <NewTab />
              <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </a>
          </div>
          <div className="pc-client__logos">
            {CLIENT.logos.map((l, i) => (
              <figure className={`pc-client__logo pc-client__logo--${i + 1}`} key={l.src}>
                <img src={l.src} alt={l.alt} loading="lazy" decoding="async" />
                <figcaption className="pc-sr">{l.role}</figcaption>
              </figure>
            ))}
          </div>
          <ul className="pc-client__stats" aria-label="Client and national network at a glance">
            {CLIENT.stats.map((stat) => (
              <li className="pc-client__stat" key={stat.value}>
                <span className="pc-client__stat-value">{stat.value}</span>
                <span className="pc-client__stat-label">{stat.label}</span>
              </li>
            ))}
          </ul>
        </div>
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
          Join the Fall 2026
          <br />
          consulting team.
        </h2>
        <div className="pc-cta__btns">
          <DotButton href={CONSULTING_FORM_URL} external className="pc-dotbtn--big">
            Apply for Fall 2026
          </DotButton>
          <DotButton to="/consulting/leadership" className="pc-dotbtn--big">
            Meet the team
          </DotButton>
        </div>
        <p className="pc-cta__note">Questions? Email the project managers.</p>
        <ul className="pc-cta__contacts" aria-label="Project managers">
          {LEADERS.map((l) => (
            <li className="pc-cta__contact" key={l.email}>
              <span className="pc-cta__contact-name">{l.name}</span>
              <span className="pc-cta__contact-role">{l.role}</span>
              <a className="pc-cta__contact-email pc-line" href={`mailto:${l.email}`}>
                {l.email}
              </a>
            </li>
          ))}
        </ul>
        <p className="pc-cta__note">
          For prospective clients: tell us about your business or accessibility question.{' '}
          <a className="pc-line" href={CONTACT_MAILTO}>Discuss a project with us.</a>
        </p>
      </section>
    </>
  )
}

export default function Consulting() {
  return (
    <ConsultingShell title="UBLDA Consulting" motion={startConsultingMotion} disc={<StatementBody ghost />}>
      <HomeBody />
    </ConsultingShell>
  )
}
