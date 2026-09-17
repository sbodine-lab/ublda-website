import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Bands, Button, Callout, Intro, Studio } from "./Studio";
import { GenerativeArt } from "./GenerativeArt";
import { AREAS, RESEARCH } from "./research";
import { LEADERS, PARTNERS, PARTNER_STATEMENT, ROSS_ADDRESS, CONTACT_MAILTO } from "./content";
import { CONSULTING_FORM_URL, MEMBERSHIP_FORM_URL } from "../../lib/forms";
import {
  APPLY_DEADLINE_LABEL,
  APPLY_DEADLINE_AT_MS,
  applyWindow,
  APPLY_WINDOW_SHORT,
  INTERVIEW_WINDOW_SHORT,
  OFFERS_SHORT,
  KICKOFF_SHORT,
} from "../../lib/applyForm";

const enterDelay = (ms: number) =>
  ({ "--enter-delay": `${ms}ms` }) as CSSProperties;

const LOGO_ASSETS: Record<string, string> = {
  "/partners-arc-thrift.png": "/consulting/logos/arc-thrift.svg",
  "/partners-nestidd.png": "/consulting/logos/nestidd.svg",
  "/partners-microsoft.png": "/consulting/logos/microsoft.svg",
};

function BrandLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      className={`st-brand-logo${src.includes("blda") ? " st-brand-logo--reverse" : ""}`}
      src={LOGO_ASSETS[src] || src}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}

function ServiceArt({ area }: { area: (typeof AREAS)[number] }) {
  return <GenerativeArt kind={area.id} />;
}
function ServiceCards() {
  return (
    <div className="st-service-cards">
      {AREAS.map((area) => (
        <Link
          to={`/consulting/services/${area.id}`}
          className="st-service-card"
          key={area.id}
        >
          <ServiceArt area={area} />
          <div className="st-card-scrim" />
          <div className="st-service-desc">{area.desc}</div>
          <h3>
            {area.title}
            <ArrowUpRight size={28} />
          </h3>
        </Link>
      ))}
    </div>
  );
}
function Metrics() {
  return (
    <section
      className="st-metrics"
      aria-label="Why disability inclusion matters"
    >
      <div className="st-wrap">
        <div className="st-metric-grid">
          {RESEARCH.map((item) => (
            <Link
              to={`/consulting/insights/${item.id}`}
              key={item.id}
              className="st-metric"
            >
              <span className="st-metric-value">{item.value}</span>
              <div>
                <p className="st-source">{item.source}</p>
                <h2>
                  {item.id === "disability-is-not-a-niche"
                    ? "People worldwide experience significant disability"
                    : item.id === "the-business-case"
                      ? "Revenue among disability-inclusion leaders in the study"
                      : "Employment rate for U.S. disabled people ages 16–64"}
                </h2>
                <small>
                  {item.date} <ArrowUpRight size={15} />
                </small>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
function InsightCards({ filter = "All" }: { filter?: string }) {
  return (
    <div className="st-insight-cards">
      {RESEARCH.filter(
        (item) => filter === "All" || item.category === filter,
      ).map((item) => (
        <Link
          key={item.id}
          to={`/consulting/insights/${item.id}`}
          className="st-insight-card"
        >
          <div
            className={`st-insight-art st-insight-art--${RESEARCH.indexOf(item)}`}
          >
            <span>{item.value}</span>
            <ArrowUpRight size={32} />
          </div>
          <p className="st-eyebrow">{item.source}</p>
          <h3>{item.title}</h3>
        </Link>
      ))}
    </div>
  );
}
function People({ full = false }: { full?: boolean }) {
  return (
    <div className="st-people">
      {LEADERS.map((person, i) => (
        <article key={person.email} className="st-person" data-enter>
          <div
            className={`st-person-art st-person-art--${i}`}
            aria-hidden="true"
          >
            <span>
              {person.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <div />
          </div>
          <h2>{person.name}</h2>
          <p>{person.role.split(",")[0]}</p>
          <a className="st-text-link" href={`mailto:${person.email}`}>
            {person.email}
            <ArrowUpRight size={16} />
          </a>
          {full && (
            <a className="st-text-link" href={person.linkedin}>
              LinkedIn <ArrowUpRight size={16} />
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
function ClientLogos() {
  return (
    <div className="st-client-logos">
      <BrandLogo
        src="/client-the-arc.svg"
        alt="The Arc — planned national board presentation"
      />
      <BrandLogo
        src="/partners-arc-thrift.png"
        alt="Arc Thrift Stores — Fall 2026 client"
      />
    </div>
  );
}
function Timeline() {
  const stages = [
    [
      "Apply",
      APPLY_WINDOW_SHORT,
      `Three short answers and an optional resume. Deadline: ${APPLY_DEADLINE_LABEL}.`,
    ],
    [
      "Interview",
      INTERVIEW_WINDOW_SHORT,
      "Two 30-minute conversations at Ross: one behavioral and one technical.",
    ],
    ["Decisions", OFFERS_SHORT, ""],
    ["Kickoff", KICKOFF_SHORT, "Begin weekly project work with your team."],
  ];
  return (
    <div className="st-timeline">
      {stages.map(([name, date, text], i) => (
        <article key={name}>
          <span>0{i + 1}</span>
          <div>
            <p className="st-eyebrow">{date}</p>
            <h3>{name}</h3>
            {text && <p>{text}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function StudioHome() {
  return (
    <Studio title="Home" hero>
      <section className="st-hero">
        <Bands />
        <div className="st-wrap st-hero-content">
          <h1>
            <span data-enter>Expand access.</span>
            <span data-enter style={enterDelay(250)}>
              Strengthen your business.
            </span>
          </h1>
          <div className="st-actions" data-enter style={enterDelay(600)}>
            <Button to="/consulting/work">View work</Button>
            <Button to="/consulting/contact" solid>
              Discuss a project
            </Button>
          </div>
        </div>
      </section>
      <section className="st-wrap st-positioning">
        <div className="st-affiliations" data-enter>
          <div>
            <BrandLogo src="/partners-arc-thrift.png" alt="Arc Thrift Stores" />
            <small>Fall 2026 client</small>
          </div>
          <div>
            <BrandLogo src="/client-the-arc.svg" alt="The Arc" />
            <small>Planned national board presentation</small>
          </div>
          <div>
            <BrandLogo
              src="/partners-blda.webp"
              alt="Business Leaders for Diverse Abilities"
            />
            <small>MBA community</small>
          </div>
        </div>
        <div className="st-statement" data-enter>
          <p>
            UBLDA Consulting is the pro bono consulting division of Undergraduate
            Business Leaders for Diverse Abilities. Our student teams bring
            research and analysis to business decisions.
          </p>
          <p>
            We help disability-focused organizations pursue growth and solve
            business challenges. We also help companies across industries
            improve accessibility for their customers and employees.
          </p>
          <p className="st-campus-affiliation">{PARTNER_STATEMENT}</p>
        </div>
      </section>
      <Metrics />
      <section className="st-wrap st-story" data-enter>
        <div className="st-story-art">
          <GenerativeArt kind="perspective" />
        </div>
        <div>
          <h2>
            Research that sharpens decisions.
            <br />
            <span>
              Recommendations built for action.
            </span>
          </h2>
          <p>
            Your business question sets the direction. A team of four to six
            analysts and two project managers investigates the options and
            develops recommendations over the semester.
          </p>
          <Button to="/consulting/practice">How we work</Button>
        </div>
      </section>
      <section className="st-wrap st-section" data-enter>
        <h2 className="st-section-heading">
          Business strategy and
          <br />
          accessibility consulting
        </h2>
        <ServiceCards />
      </section>
      <Callout />
      <section
        className="st-wrap st-client-feature"
        aria-labelledby="client-heading"
        data-enter
      >
        <div className="st-client-copy">
          <h2 id="client-heading">Arc Thrift Stores of Colorado</h2>
          <Button to="/consulting/work">Meet our client</Button>
        </div>
        <div className="st-client-details">
          <div className="st-client-detail">
            <BrandLogo src="/partners-arc-thrift.png" alt="Arc Thrift Stores" />
            <div>
              <h3>Fall 2026 client</h3>
              <p>
                Colorado’s nonprofit thrift chain funds the state’s Arc chapters
                and is one of its largest employers of people with intellectual
                and developmental disabilities.
              </p>
            </div>
          </div>
          <div className="st-client-detail">
            <BrandLogo src="/client-the-arc.svg" alt="The Arc" />
            <div>
              <h3>National board presentation</h3>
              <p>
                Our Fall 2026 team plans to present its recommendations to
                The Arc’s national board at the end of the semester.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="st-wrap st-section">
        <div className="st-section-top" data-enter>
          <h2 className="st-section-heading">
            Evidence to inform
            <br />
            better decisions
          </h2>
          <Button to="/consulting/insights">Browse all insights</Button>
        </div>
        <InsightCards />
      </section>
      <section className="st-team-section">
        <div className="st-wrap">
          <div className="st-section-top" data-enter>
            <h2 className="st-section-heading">
              The people
              <br />
              behind the work
            </h2>
            <Button to="/consulting/leadership">Meet the team</Button>
          </div>
          <People />
        </div>
      </section>
    </Studio>
  );
}

export function StudioServices() {
  return (
    <Studio title="Services" dark>
      <Intro title="Services">
        <p>
          Business strategy for disability-focused organizations.
          Accessibility consulting for companies across industries.
        </p>
      </Intro>
      <div className="st-wrap st-service-rows">
        {AREAS.map((area) => (
          <section className="st-service-row" key={area.id} data-enter>
            <div className="st-service-image">
              <ServiceArt area={area} />
            </div>
            <div>
              <h2>{area.title}</h2>
              <p>{area.desc}</p>
              <Button to={`/consulting/services/${area.id}`}>
                Explore the service
              </Button>
            </div>
          </section>
        ))}
      </div>
      <section className="st-wrap st-scope-note">
        <p>
          We agree on a business question and a scope our student team can
          deliver. Our work provides research and recommendations. Legal advice
          and compliance certification fall outside our services.
        </p>
      </section>
      <Callout />
    </Studio>
  );
}
export function StudioServiceDetail() {
  const { service } = useParams();
  const area = AREAS.find((a) => a.id === service);
  if (!area) return <Navigate to="/consulting/services" replace />;
  return (
    <Studio key={area.id} title={area.title} dark>
      <Intro title={area.title}>
        <p>{area.desc}</p>
      </Intro>
      <div className="st-wrap st-detail-art">
        <ServiceArt area={area} />
      </div>
      <section className="st-wrap st-detail-body" data-enter>
        <h2>
          Define the challenge.
          <br />Evaluate the options.
        </h2>
        <div>
          <p>{area.detail}</p>
          <h3>Potential project areas</h3>
          <ul>
            {area.examples.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <Button href={CONTACT_MAILTO}>Discuss a project</Button>
        </div>
      </section>
      <Callout />
    </Studio>
  );
}
export function StudioWork() {
  return (
    <Studio title="Our work">
      <Intro
        title={
          <>
            Business strategy.
            <br />
            <em>Disability impact.</em>
          </>
        }
      >
        <ClientLogos />
        <p>
          Our first client is Arc Thrift Stores of Colorado. Our Fall 2026 team
          will develop recommendations for a social enterprise that puts
          disability employment at the heart of its business.
        </p>
      </Intro>
      <section className="st-wrap st-work-row" data-enter>
        <div className="st-work-logo">
          <BrandLogo src="/partners-arc-thrift.png" alt="Arc Thrift Stores" />
        </div>
        <div>
          <p className="st-eyebrow">Fall 2026</p>
          <h2>Arc Thrift Stores of Colorado</h2>
          <p>
            A nonprofit thrift retailer supporting Colorado’s Arc chapters and
            employing people with intellectual and developmental disabilities.
          </p>
          <p>
            Arc Thrift’s CEO sponsors the engagement. Four to six analysts work
            with two project managers. The team plans to present its
            recommendations to The Arc’s national board in December.
          </p>
          <Button href="https://arcthrift.com">Visit Arc Thrift Stores</Button>
        </div>
      </section>
      <section className="st-wrap st-detail-body">
        <h2>
          A business question.
          <br />
          A clear recommendation.
        </h2>
        <div>
          <p>
            The team develops its analysis through weekly working sessions and a
            midpoint review. The final presentation connects the research to
            recommendations the client can evaluate.
          </p>
          <Button to="/consulting/practice">How we work</Button>
        </div>
      </section>
      <Callout />
    </Studio>
  );
}
export function StudioPractice() {
  return (
    <Studio title="Our practice">
      <Intro
        title={
          <>
            Ambitious thinking.
            <br />
            <em>Disciplined work.</em>
          </>
        }
      >
        <p>
          UBLDA Consulting is the student-led consulting division of
          Undergraduate Business Leaders for Diverse Abilities at Michigan Ross.
          We work pro bono.
        </p>
        <p>
          We help disability-focused organizations address business challenges.
          We also help companies across industries improve their accessibility
          strategies and programs.
        </p>
      </Intro>
      <div className="st-wrap st-practice-art">
        <GenerativeArt kind="practice" />
      </div>
      <section className="st-wrap st-detail-body" data-enter>
        <h2>
          Focused teams.
          <br />Critical thinking.
          <br />
          Practical recommendations.
        </h2>
        <div>
          <p>
            Four to six analysts work with two project managers. They research
            the client’s question and test their assumptions before
            recommending a direction.
          </p>
          <p>
            Weekly deliverables keep the project moving. A midpoint review gives
            the team feedback to strengthen its analysis before the final
            presentation.
          </p>
          <p>
            Bring curiosity and the discipline to follow through. You do not need
            prior consulting experience.
          </p>
          <Button to="/consulting/contact#join">Join the team</Button>
        </div>
      </section>
      <section className="st-wrap st-section">
        <h2 className="st-section-heading">The Fall 2026 timeline</h2>
        <Timeline />
      </section>
      <Callout join />
    </Studio>
  );
}
export function StudioLeadership() {
  return (
    <Studio title="Leadership">
      <Intro
        title={
          <>
            Meet our
            <br />
            <em>project managers.</em>
          </>
        }
      >
        <Button to="/team">View the full E-board</Button>
      </Intro>
      <section className="st-wrap st-leadership">
        <People full />
      </section>
      <Callout join />
    </Studio>
  );
}
export function StudioPartners() {
  return (
    <Studio title="Our connections">
      <Intro
        title={
          <>
            A community
            <br />
            <em>around the work.</em>
          </>
        }
      >
        <p>{PARTNER_STATEMENT}</p>
      </Intro>
      <div className="st-wrap st-partner-grid">
        {PARTNERS.map((partner) => (
          <article key={partner.src}>
            <div>
              <BrandLogo src={partner.src} alt="" />
            </div>
            <h2>{partner.alt.split(" — ")[0]}</h2>
            <p>{partner.role}</p>
          </article>
        ))}
      </div>
      <Callout />
    </Studio>
  );
}
export function StudioInsights() {
  const [filter, setFilter] = useState("All");
  return (
    <Studio title="Research & insights">
      <Intro
        title={
          <>
            Disability inclusion.
            <br />
            <em>A business priority.</em>
          </>
        }
      >
        <p>
          Understand the scale of disability and its relevance to business.
          Explore research on market reach and workforce participation.
        </p>
      </Intro>
      <section className="st-wrap st-section">
        <div className="st-filters" aria-label="Filter insights">
          {["All", "Perspective", "Research", "Data"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <InsightCards filter={filter} />
      </section>
      <Callout />
    </Studio>
  );
}
export function StudioInsight() {
  const { insight } = useParams();
  const item = RESEARCH.find((r) => r.id === insight);
  if (!item) return <Navigate to="/consulting/insights" replace />;
  return (
    <Studio key={item.id} title={item.title}>
      <Intro eyebrow={item.date} title={item.title}>
        <p>{item.summary}</p>
      </Intro>
      <article className="st-wrap st-article">
        <div className="st-article-stat">
          {item.value}
          <small>{item.source}</small>
        </div>
        <div>
          <h2>What it means for business</h2>
          <p>{item.takeaway}</p>
          <h2>What the data shows</h2>
          <p>{item.context}</p>
          <a className="st-text-link" href={item.url}>
            Read the original source <ArrowUpRight size={18} />
          </a>
          <p className="st-article-note">
            These findings come from independent research. They are not UBLDA
            project results. Source checked September 16, 2026.
          </p>
          <Button to="/consulting/insights">All insights</Button>
        </div>
      </article>
      <Callout />
    </Studio>
  );
}
function InquiryForm() {
  const [prepared, setPrepared] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = `Name: ${data.get("name")}\nOrganization: ${data.get("organization")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`;
    const href = `${CONTACT_MAILTO}&body=${encodeURIComponent(body)}`;
    setPrepared(href);
    window.location.href = href;
  };
  return (
    <form className="st-inquiry" onSubmit={submit}>
      <div className="st-form-row">
        <label>
          Full name
          <input name="name" autoComplete="name" required maxLength={120} />
        </label>
        <label>
          Organization
          <input
            name="organization"
            autoComplete="organization"
            maxLength={160}
          />
        </label>
      </div>
      <label>
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        What business challenge are you working on?
        <textarea name="message" rows={4} required maxLength={4000} />
      </label>
      <button className="st-button st-button--solid" type="submit">
        <ArrowRight size={16} />
        Prepare email
      </button>
      <p className="st-form-note">
        Opens a draft in your email app for you to review and send.
      </p>
      {prepared && (
        <p role="status">
          Email app didn’t open? <a href={prepared}>Open the draft</a>.
        </p>
      )}
    </form>
  );
}
export function StudioContact() {
  const [windowState, setWindowState] = useState(() =>
    applyWindow(Date.now(), APPLY_DEADLINE_AT_MS),
  );
  useEffect(() => {
    const timer = window.setInterval(
      () => setWindowState(applyWindow(Date.now(), APPLY_DEADLINE_AT_MS)),
      30000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <Studio title="Get in touch">
      <Intro
        title={
          <>
            What comes next
            <br />
            <em>for your business?</em>
          </>
        }
      >
        <p>
          Tell us what you want to achieve. We’ll discuss whether a focused
          consulting project can help. Students can explore opportunities below.
        </p>
        <div className="st-contact-emails">
          {LEADERS.map((l) => (
            <a key={l.email} href={`mailto:${l.email}`}>
              {l.email}
              <ArrowUpRight size={22} />
            </a>
          ))}
        </div>
      </Intro>
      <section className="st-wrap st-contact-form" id="contact-form">
        <div>
          <h2>Start a conversation</h2>
          <address>
            {ROSS_ADDRESS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </address>
        </div>
        <InquiryForm />
      </section>
      <section className="st-join" id="join">
        <div className="st-wrap">
          <div className="st-section-top">
            <h2 className="st-section-heading">
              Build your skills.
              <br />
              Take on a real business challenge.
            </h2>
            <p>
              Open to University of Michigan undergraduates of all majors and
              years. Disabled and non-disabled students are welcome. No
              consulting experience required.
            </p>
          </div>
          <details open>
            <summary>
              Consulting analyst <span>Fall 2026</span>
            </summary>
            <div className="st-opening">
              <div>
                <p>
                  Work in a team of four to six analysts with two project managers.
                  Weekly client work runs from October through December.
                </p>
                <p>
                  {windowState === "open"
                    ? `Apply by ${APPLY_DEADLINE_LABEL}.`
                    : windowState === "before"
                      ? "Fall 2026 applications open September 2."
                      : "The Fall 2026 application deadline has passed. Contact the project managers about future opportunities."}
                </p>
                {windowState === "open" ? (
                  <Button href={CONSULTING_FORM_URL} solid>
                    Apply for Fall 2026
                  </Button>
                ) : (
                  <Button href={CONTACT_MAILTO}>Contact the team</Button>
                )}
              </div>
              <Timeline />
            </div>
          </details>
          <details>
            <summary>
              General member <span>Year-round</span>
            </summary>
            <div className="st-opening">
              <p>
                Learn through speaker events and workshops. Connect with students
                who care about disability in business. General membership is
                free and open without a selection process.
              </p>
              <Button href={MEMBERSHIP_FORM_URL}>Join UBLDA</Button>
            </div>
          </details>
        </div>
      </section>
    </Studio>
  );
}
