import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { ApplicationButton, Button, Callout, Intro, Studio } from "./Studio";
import { GenerativeArt } from "./GenerativeArt";
import { AREAS, RESEARCH } from "./research";
import { LEADERS, PARTNERS, PARTNER_STATEMENT, ROSS_ADDRESS, CONTACT_MAILTO } from "./content";
import { CONSULTING_FORM_URL, MEMBERSHIP_FORM_URL } from "../../lib/forms";
import { useConsultingApplication } from "../../lib/useConsultingApplication";
import {
  APPLY_DEADLINE_LABEL,
  APPLY_WINDOW_SHORT,
  INTERVIEW_WINDOW_SHORT,
  INTERVIEW_FORMAT,
  OFFERS_SHORT,
  KICKOFF_SHORT,
} from "../../lib/applyForm";

const enterDelay = (ms: number) =>
  ({ "--enter-delay": `${ms}ms` }) as CSSProperties;

const LOGO_ASSETS: Record<string, string> = {
  "/partners-arc-thrift.png": "/consulting/logos/arc-thrift.svg",
  "/partners-nestidd.png": "/consulting/logos/nestidd.svg",
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
function InsightCards({ filter = "All", headingLevel = 3 }: { filter?: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
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
            <p className="st-metric-label">{item.metricLabel}</p>
            <ArrowUpRight size={32} />
          </div>
          <p className="st-eyebrow">{item.source}</p>
          <Heading>{item.title}</Heading>
          <p className="st-insight-date">{item.date}</p>
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
          <p>{person.role}</p>
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
      <figure>
        <BrandLogo src="/partners-arc-thrift.png" alt="Arc Thrift Stores" />
        <figcaption>Fall 2026 consulting client</figcaption>
      </figure>
      <figure>
        <BrandLogo src="/client-the-arc.svg" alt="The Arc" />
        <figcaption>Planned national board presentation</figcaption>
      </figure>
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
      "Interviews",
      INTERVIEW_WINDOW_SHORT,
      `${INTERVIEW_FORMAT} Invited applicants will receive confirmed dates and times.`,
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
      <section className="st-hero st-hero--photo">
        <picture>
          <source media="(max-width: 767px)" srcSet="/consulting/ross-hero-glass-mobile.webp" />
          <img
            className="st-hero-photo"
            src="/consulting/ross-hero-glass-2160.webp"
            srcSet="/consulting/ross-hero-glass-1080.webp 1080w, /consulting/ross-hero-glass-2160.webp 2160w"
            sizes="100vw"
            alt=""
            aria-hidden="true"
            width={2160}
            height={1215}
            fetchPriority="high"
            decoding="async"
          />
        </picture>
        <div className="st-wrap st-hero-content">
          <h1>
            <span data-enter>Business with</span>
            <span data-enter style={enterDelay(250)}>
              disability in focus.
            </span>
          </h1>
          <div className="st-actions" data-enter style={enterDelay(600)}>
            <Button to="/consulting/work">Meet our first client</Button>
            <ApplicationButton solid />
          </div>
        </div>
      </section>
      <section className="st-wrap st-positioning">
        <div className="st-statement" data-enter>
          <p>
            UBLDA Consulting is the pro bono consulting division of
            Undergraduate Business Leaders for Diverse Abilities. We bring
            Michigan students together to work on business questions that
            affect people with disabilities and the organizations that serve them.
          </p>
          <p>
            Our first client engagement is planned for Fall 2026 with Arc Thrift
            Stores of Colorado. For future projects, we welcome conversations
            about business strategy, accessibility, and workplace inclusion.
          </p>
          <p className="st-campus-affiliation">{PARTNER_STATEMENT}</p>
        </div>
      </section>
      <section className="st-experience">
        <div className="st-wrap">
          <div className="st-section-top" data-enter>
            <h2 className="st-section-heading">How the<br />project works.</h2>
            <p>Our Fall 2026 engagement runs from October through December, with four to six analysts working alongside two project managers.</p>
          </div>
          <div className="st-experience-grid">
            <article data-enter>
              <span aria-hidden="true">01</span>
              <h3>Research the business</h3>
              <p>Analysts investigate the client’s question and gather evidence before developing a recommendation.</p>
            </article>
            <article data-enter>
              <span aria-hidden="true">02</span>
              <h3>Build a recommendation</h3>
              <p>The team compares possible approaches and uses feedback from project managers to test its assumptions and strengthen the analysis.</p>
            </article>
            <article data-enter>
              <span aria-hidden="true">03</span>
              <h3>Present the findings</h3>
              <p>A midpoint review and final presentation give the team a way to share findings and explain its recommendations.</p>
            </article>
          </div>
          <Button to="/consulting/practice">Inside the program</Button>
        </div>
      </section>
      <section className="st-wrap st-club-story" data-enter>
        <h2>Part of a broader<br />UBLDA community.</h2>
        <div>
          <p>
            Our club creates a place for students to understand disability
            through the lens of business and to consider the role they can play
            in a more inclusive workplace. Consulting is one part of that work
            alongside speaker events and activities that bring our members together.
          </p>
          <p>
            Our connection with Business Leaders for Diverse Abilities at Ross
            brings undergraduate and MBA students into a shared conversation
            about disability in business. Members contribute different experiences
            and perspectives to the questions we explore as a club.
          </p>
          <p>
            General membership is free and open to all U-M students. Consulting
            analyst positions are for U-M undergraduates, selected through an
            application and interview process.
          </p>
          <Button to="/">Explore UBLDA</Button>
        </div>
      </section>
      <section className="st-wrap st-section" data-enter>
        <h2 className="st-section-heading">How we could<br />help your organization.</h2>
        <ServiceCards />
      </section>
      <Callout join />
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
                The nonprofit retailer funds disability advocacy and community
                programs and employs people with intellectual and developmental
                disabilities.
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
      <section className="st-team-section">
        <div className="st-wrap">
          <div className="st-section-top" data-enter>
            <h2 className="st-section-heading">Meet our<br />project managers.</h2>
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
    <Studio title="How we can help" dark>
      <Intro title="How we can help">
        <p>
          Have a business question with a disability focus? These are possible
          areas for a pro bono student project. Our first engagement is planned
          for Fall 2026; we’re interested in shaping future projects with
          organizations whose questions fit our team’s skills and a semester’s timeline.
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
                Explore project ideas
              </Button>
            </div>
          </section>
        ))}
      </div>
      <section className="st-wrap st-scope-note">
        <p>
          We would agree on the question, scope, and expected output with you
          before committing to a project. Our focus is student research and
          recommendations. We do not offer legal advice or compliance certification.
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
          What a project
          <br />could look like.
        </h2>
        <div>
          <p>{area.detail}</p>
          <h3>Topics a project could explore</h3>
          <ul>
            {area.examples.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p>These are possible directions for a future project. We would confirm the scope and fit with your organization before work begins.</p>
          <Button to="/consulting/contact">Discuss a project</Button>
        </div>
      </section>
      <Callout />
    </Studio>
  );
}
export function StudioWork() {
  return (
    <Studio title="Our first client">
      <Intro
        title={
          <>
            Our first
            <br />
            <em>client engagement.</em>
          </>
        }
      >
        <ClientLogos />
        <p>
          Our first engagement is planned for October–December 2026, bringing
          UBLDA students together with Arc Thrift
          Stores of Colorado to develop business recommendations for a social
          enterprise whose work supports disability employment and advocacy.
        </p>
      </Intro>
      <section className="st-wrap st-work-row" data-enter>
        <div className="st-work-logo">
          <BrandLogo src="/partners-arc-thrift.png" alt="Arc Thrift Stores" />
        </div>
        <div>
          <p className="st-eyebrow">Planned for Fall 2026</p>
          <h2>Arc Thrift Stores of Colorado</h2>
          <p>
            Arc Thrift Stores is a nonprofit retailer that funds disability
            advocacy and employs people with intellectual and developmental
            disabilities throughout its operations.
          </p>
          <p>
            Four to six analysts will work with two project managers on an
            engagement sponsored by Arc Thrift’s CEO. The team plans to present
            its recommendations to The Arc’s national board in December.
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
            The Fall 2026 plan includes weekly working sessions, a midpoint
            review, and a final presentation. The team will aim to give the
            client a clear account of its research and the reasoning behind
            its recommendations.
          </p>
          <Button to="/consulting/practice">Our program</Button>
        </div>
      </section>
      <Callout join />
    </Studio>
  );
}
export function StudioPractice() {
  return (
    <Studio title="Our program">
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
          UBLDA Consulting brings Michigan undergraduates together to provide
          pro bono consulting through Undergraduate Business Leaders for
          Diverse Abilities at Michigan Ross.
        </p>
        <p>
          We’re preparing for our first engagement in October–December 2026
          with Arc Thrift Stores of Colorado. The program is designed to give
          students experience researching a business question and developing
          recommendations with guidance from two project managers.
        </p>
      </Intro>
      <section className="st-wrap st-detail-body" data-enter>
        <h2>
          Focused teams.
          <br />Critical thinking.
          <br />
          Practical recommendations.
        </h2>
        <div>
          <p>
            The Fall 2026 team will include four to six analysts and two project
            managers. Project managers will guide the research and help analysts
            turn findings into recommendations, with time for the team to question
            assumptions and consider different perspectives.
          </p>
          <p>
            Our planned format includes weekly deliverables, a midpoint review,
            and a final client presentation. These milestones will give students
            opportunities to discuss their research, receive feedback, and
            revise their recommendations.
          </p>
          <p>
            Students from every undergraduate major and class year are welcome
            to apply with no prior consulting experience required.
          </p>
          <ApplicationButton />
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
      <Callout join />
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
            <em>A broader perspective.</em>
          </>
        }
      >
        <p>
          These readings offer students a broader view of disability in
          business and provide context for the questions our club explores
          as we prepare for client work. These are external research findings,
          not results from UBLDA projects.
        </p>
      </Intro>
      <section className="st-wrap st-section">
        <div className="st-filters" role="group" aria-label="Filter insights">
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
        <p className="sr-only" role="status">{RESEARCH.filter(item => filter === "All" || item.category === filter).length} insights shown{filter === "All" ? "" : ` in ${filter}`}.</p>
        <InsightCards filter={filter} headingLevel={2} />
      </section>
      <Callout join />
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
          <p className="st-article-metric-label">{item.metricLabel}</p>
          <small>{item.source}<br />{item.date}</small>
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
            project results. Source checked September 17, 2026.
          </p>
          <Button to="/consulting/insights">All insights</Button>
        </div>
      </article>
      <Callout join />
    </Studio>
  );
}
function InquiryForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending" || status === "sent") return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success !== true) throw new Error(result.error || "Your message could not be sent. Please try again.");
      form.reset();
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error && err.name === "Error" ? err.message : "Your message could not be sent. Please try again.");
      setStatus("error");
    }
  };
  return (
    <form className="st-inquiry" onSubmit={submit} aria-describedby="inquiry-instructions" aria-busy={status === "sending"}>
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="st-form-row">
        <label>
          Full name (required)
          <input name="name" autoComplete="name" required maxLength={120} />
        </label>
        <label>
          Organization (optional)
          <input
            name="organization"
            autoComplete="organization"
            maxLength={160}
          />
        </label>
      </div>
      <label>
        Email (required)
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        What would you like to ask us? (required)
        <textarea name="message" rows={4} required maxLength={4000} />
      </label>
      <button className="st-button st-button--solid" type="submit" disabled={status === "sending" || status === "sent"}>
        <ArrowRight size={16} />
        {status === "sending" ? "Sending…" : status === "sent" ? "Message sent" : "Send message"}
      </button>
      <p className="st-form-note" id="inquiry-instructions">
        Sends your message to Alex Forstner, with Cooper Perry, Alexa Chiang, and Sam Bodine copied.
      </p>
      <p role="status">{status === "sent" && "Your message has been sent. Alex will reply to the email address you provided."}</p>
      {status === "error" && <p role="alert">{error} <a href={CONTACT_MAILTO}>Email Alex directly</a>.</p>}
    </form>
  );
}
export function StudioContact() {
  const { state: windowState } = useConsultingApplication();
  return (
    <Studio title="Get in touch">
      <Intro
        title={
          <>
            Contact
            <br />
            <em>UBLDA Consulting.</em>
          </>
        }
      >
        <p>
          For all questions about UBLDA Consulting, applications, or working
          with a student team, contact Alex Forstner. If you have a potential
          project, tell us about your organization and the question you’d like
          to explore so we can discuss scope, timing, and fit.
        </p>
        <div className="st-contact-emails">
          <a href={CONTACT_MAILTO}>alexfors@umich.edu<ArrowUpRight size={22} /></a>
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
              Fall 2026
              <br />
              analyst applications.
            </h2>
            <p>
              We welcome applications from disabled and non-disabled University
              of Michigan undergraduates across all majors and class years
              with no prior consulting experience required.
            </p>
          </div>
          <details open>
            <summary>
              Consulting analyst <span>Fall 2026</span>
            </summary>
            <div className="st-opening">
              <div>
                <p>
                  Our Fall 2026 team will include four to six analysts working
                  with two project managers on weekly client work from October
                  through December.
                </p>
                <p>
                  {windowState === "open"
                    ? `Apply by ${APPLY_DEADLINE_LABEL}.`
                    : windowState === "before"
                      ? "Fall 2026 applications open September 2."
                      : "The Fall 2026 application deadline has passed. Contact Alex Forstner about future opportunities."}
                </p>
                {windowState === "open" ? (
                  <Button href={CONSULTING_FORM_URL} solid>
                    Apply
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
              General member <span>Fall 2026 signup</span>
            </summary>
            <div className="st-opening">
              <p>
                General members take part in speaker events and club activities
                with other students interested in disability in business.
                Membership is free and open to all U-M students without a
                selection process.
              </p>
              <Button href={MEMBERSHIP_FORM_URL}>Join UBLDA</Button>
            </div>
          </details>
        </div>
      </section>
    </Studio>
  );
}
