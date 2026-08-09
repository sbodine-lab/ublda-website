import './ConsultingPrivate.css'

const partnerMarks = [
  { name: 'ELEVATE', mark: 'elevate' },
  { name: 'NORTHPOINT', mark: 'northpoint' },
  { name: 'FrameWorks', mark: 'frameworks' },
  { name: 'CIVITAS', mark: 'civitas' },
  { name: 'HARBOR', mark: 'harbor' },
]

function PartnerMark({ mark }: { mark: string }) {
  if (mark === 'elevate') {
    return (
      <svg className="cg-partner__icon" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M6 8h15M10 14h12M4 20h13" />
      </svg>
    )
  }

  if (mark === 'northpoint') {
    return (
      <svg className="cg-partner__icon cg-partner__icon--north" viewBox="0 0 28 28" aria-hidden="true">
        <path d="M14 4 24 23 14 17 4 23Z" />
        <path d="M14 4v13" />
      </svg>
    )
  }

  if (mark === 'frameworks') {
    return (
      <svg className="cg-partner__icon cg-partner__icon--frameworks" viewBox="0 0 28 28" aria-hidden="true">
        <path d="m14 4 9 5v10l-9 5-9-5V9Z" />
        <path d="M14 4v10l9 5M14 14 5 9M14 14v10" />
      </svg>
    )
  }

  if (mark === 'civitas') {
    return (
      <svg className="cg-partner__icon cg-partner__icon--civitas" viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="14" cy="5" r="1.5" />
        <circle cx="14" cy="23" r="1.5" />
        <circle cx="5" cy="14" r="1.5" />
        <circle cx="23" cy="14" r="1.5" />
        <circle cx="8" cy="8" r="1.5" />
        <circle cx="20" cy="20" r="1.5" />
        <circle cx="20" cy="8" r="1.5" />
        <circle cx="8" cy="20" r="1.5" />
      </svg>
    )
  }

  return (
    <svg className="cg-partner__icon cg-partner__icon--harbor" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M7 5v18M21 5v18M7 14h14M4 8l6-3M18 23l6-3" />
    </svg>
  )
}

export default function ConsultingPrivate() {
  return (
    <main id="main-content" className="consulting-private" aria-label="UBLDA Consulting private prototype">
      <div className="cg-stage">
        <header className="cg-header">
          <a className="cg-logo" href="/" aria-label="UBLDA Consulting">
            <span className="cg-logo__main">UBLDA</span>
            <span className="cg-logo__sub">Consulting</span>
          </a>

          <nav className="cg-nav" aria-label="Consulting prototype navigation">
            <a href="#services">
              Services
              <svg viewBox="0 0 12 8" aria-hidden="true">
                <path d="m1 1.5 5 5 5-5" />
              </svg>
            </a>
            <a href="#approach">Approach</a>
            <a href="#insights">Insights</a>
            <a href="#about">About</a>
          </nav>
        </header>

        <section className="cg-hero" aria-labelledby="consulting-title">
          <div className="cg-hero__copy">
            <h1 id="consulting-title">
              <span>Designing</span>
              <span className="cg-title__accent">inclusion</span>
              <span>
                into growth<span className="cg-title__dot" aria-hidden="true" />
              </span>
            </h1>
            <span className="cg-rule" aria-hidden="true" />
            <p className="cg-intro">
              We help organizations turn accessibility<br />
              and disability-informed insight into better<br />
              products, stronger experiences, and results<br />
              that compound.
            </p>
            <div className="cg-actions">
              <a className="cg-button" href="#services">
                Explore Services
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M3 9h12M10.5 4.5 15 9l-4.5 4.5" />
                </svg>
              </a>
              <a className="cg-link" href="#approach">
                Our Approach
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M3 9h12M10.5 4.5 15 9l-4.5 4.5" />
                </svg>
              </a>
            </div>
          </div>

          <img
            className="cg-hero__art"
            src="/consulting-assets/hero-art-cutout.png"
            alt=""
            aria-hidden="true"
          />
        </section>

        <section className="cg-trust" aria-label="Trusted by forward-thinking organizations">
          <p className="cg-trust__label">TRUSTED BY FORWARD-THINKING ORGANIZATIONS</p>
          <div className="cg-partners">
            {partnerMarks.map((partner) => (
              <span className="cg-partner" key={partner.name}>
                <PartnerMark mark={partner.mark} />
                <span>{partner.name}</span>
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
