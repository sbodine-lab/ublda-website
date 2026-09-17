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
      "Two 30-minute conversations at Ross, one behavioral and one technical.",
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
            <span data-enter>Business can include more people.</span>
            <span data-enter style={enterDelay(250)}>
              We help make it happen.
            </span>
          </h1>
          <div className="st-actions" data-enter style={enterDelay(600)}>
            <Button to="/consulting/work">Browse our work</Button>
            <Button to="/consulting/contact" solid>
              Talk to us
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
            UBLDA Consulting is the student-led, pro bono consulting division of
            Undergraduate Business Leaders for Diverse Abilities.
          </p>
          <p>
            We help disability-focused organizations solve business challenges
            and help companies across industries improve accessibility—in their
            products, services, and workplaces.
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
            Good business decisions start with understanding who gets left out.
            <br />
            <span>
              We’re here to ask better questions—and help answer them.
            </span>
          </h2>
          <p>
            Four to six analysts. Two project managers. A semester of research,
            collaboration, and recommendations for a real client.
          </p>
          <Button to="/consulting/practice">How we work</Button>
        </div>
      </section>
      <section className="st-wrap st-section" data-enter>
        <h2 className="st-section-heading">
          Where business strategy
          <br />
          meets disability inclusion
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
                Our Fall 2026 team will present to The Arc’s national board at
                the end of the semester.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="st-wrap st-section">
        <div className="st-section-top" data-enter>
          <h2 className="st-section-heading">
            A closer look
            <br />
            at inclusion
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
                Explore this area
              </Button>
            </div>
          </section>
        ))}
      </div>
      <section className="st-wrap st-scope-note">
        <p>
          These are potential project areas. Each engagement starts with a
          defined question, agreed scope, and a student team’s capacity. We
          provide research and recommendations, not legal advice or compliance
          certification.
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
          A focused question.
          <br />A useful recommendation.
        </h2>
        <div>
          <p>{area.detail}</p>
          <h3>Questions we can explore</h3>
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
            Business with
            <br />
            <em>a broader purpose.</em>
          </>
        }
      >
        <ClientLogos />
        <p>
          Our first consulting client is Arc Thrift Stores of Colorado. The Fall
          2026 engagement brings Michigan students together around a business
          with a commitment to disability inclusion.
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
            The engagement is sponsored by Arc Thrift’s CEO. Our team includes
            two project managers and four to six analysts, with a planned final
            presentation to The Arc’s national board in December.
          </p>
          <Button href="https://arcthrift.com">Visit Arc Thrift Stores</Button>
        </div>
      </section>
      <section className="st-wrap st-detail-body">
        <h2>
          A semester
          <br />
          of real client work.
        </h2>
        <div>
          <p>
            Weekly working sessions, research and analysis, a midpoint review,
            and a final presentation. Students learn how to turn an open
            question into a considered recommendation.
          </p>
          <Button to="/consulting/practice">Inside the practice</Button>
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
            Student-led.
            <br />
            <em>Purpose-driven.</em>
          </>
        }
      >
        <p>
          UBLDA Consulting is the pro bono consulting program of Undergraduate
          Business Leaders for Diverse Abilities at Michigan Ross.
        </p>
        <p>
          We support disability-focused organizations with business strategy
          and help companies across industries with accessibility research,
          programs, and workplace inclusion.
        </p>
      </Intro>
      <div className="st-wrap st-practice-art">
        <GenerativeArt kind="practice" />
      </div>
      <section className="st-wrap st-detail-body" data-enter>
        <h2>
          Small teams.
          <br />A clear question.
          <br />
          Shared responsibility.
        </h2>
        <div>
          <p>
            Analysts work in teams of four to six, supported by two project
            managers. Together, they research a client’s question, test their
            thinking, and develop recommendations.
          </p>
          <p>
            Weekly deliverables, a midpoint review, and a final presentation
            give the work structure and give students regular feedback.
          </p>
          <p>
            You don’t need prior consulting experience. Curiosity,
            follow-through, and a willingness to learn matter.
          </p>
          <Button to="/consulting/contact#join">Join the team</Button>
        </div>
      </section>
      <section className="st-wrap st-section">
        <h2 className="st-section-heading">Fall 2026, step by step</h2>
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
            The case for
            <br />
            <em>including more people.</em>
          </>
        }
      >
        <p>
          Research on disability, employment, and business performance.
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
          <h2>Why we’re paying attention</h2>
          <p>{item.takeaway}</p>
          <h2>Read the number in context</h2>
          <p>{item.context}</p>
          <a className="st-text-link" href={item.url}>
            Read the original source <ArrowUpRight size={18} />
          </a>
          <p className="st-article-note">
            Independent research, not UBLDA results. Source checked September 16, 2026.
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
        What would you like to work on?
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
            Let’s put a good
            <br />
            <em>question to work.</em>
          </>
        }
      >
        <p>
          Get in touch about a project or joining the team.
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
              Your first consulting project
              <br />
              can mean something.
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
                  Join four to six analysts and two project managers for weekly
                  client work, October through December.
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
                Join UBLDA for speaker events, workshops, and community. General
                membership is free and doesn’t require a selection process.
              </p>
              <Button href={MEMBERSHIP_FORM_URL}>Join UBLDA</Button>
            </div>
          </details>
        </div>
      </section>
    </Studio>
  );
}
