import { useState, type CSSProperties, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { ApplicationButton, Button, Callout, Intro, Studio } from "./Studio";
import { GenerativeArt } from "./GenerativeArt";
import { BusinessCase } from "./BusinessCase";
import { RossHero } from "./RossHero";
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
        <RossHero />
        <div className="st-wrap st-hero-content">
          <h1>
            <span data-enter>Student consulting on</span>
            {' '}
            <span data-enter style={enterDelay(250)}>
              disability and business.
            </span>
          </h1>
          <div className="st-actions" data-enter style={enterDelay(600)}>
            <Button to="/consulting/work">Meet our first client</Button>
          </div>
        </div>
      </section>
      <section className="st-wrap st-positioning">
        <div className="st-statement" data-enter>
          <p>
            UBLDA Consulting launched in Fall 2026 as a pro bono program led by
            Michigan undergraduates. Our first client is Arc Thrift Stores of
            Colorado. Future projects could address business questions for other
            disability-focused organizations or accessibility questions for
            companies.
          </p>
          <p>
            Student analysts research a question the client needs answered.
            They compare options and present recommendations they can support
            with evidence.
          </p>
          <p className="st-campus-affiliation">{PARTNER_STATEMENT}</p>
        </div>
      </section>
      <section
        className="st-wrap st-client-feature"
        aria-labelledby="client-heading"
        data-enter
      >
        <div className="st-client-copy">
          <p className="st-eyebrow">Our first client · Fall 2026</p>
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
                Our October–December engagement will conclude with the student
                team presenting its recommendations to The Arc’s national board
                in December 2026.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="st-experience">
        <div className="st-wrap">
          <div className="st-section-top" data-enter>
            <h2 className="st-section-heading">The Arc<br />{' '}project</h2>
            <p>Four to six analysts will work with two project managers from October through December 2026.</p>
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
              <p>The team will review its work at the midpoint and present its recommendations to The Arc’s national board in December.</p>
            </article>
          </div>
          <Button to="/consulting/practice">Inside the program</Button>
        </div>
      </section>
      <section className="st-wrap st-club-story" data-enter>
        <h2>The club behind<br />the program</h2>
        <div>
          <p>
            UBLDA hosts speaker events and club activities where students can
            learn about disability in business. The consulting program gives a
            smaller team the chance to work through a client’s business question.
          </p>
          <p>
            Business Leaders for Diverse Abilities is our MBA counterpart at
            Ross. The two clubs connect undergraduate and graduate students who
            care about disability in business.
          </p>
          <p>
            General membership is free and open to all U-M students. Consulting
            analysts apply separately and interview for a place on the team.
          </p>
          <Button to="/">About UBLDA</Button>
        </div>
      </section>
      <section className="st-wrap st-section" data-enter>
        <h2 className="st-section-heading">Projects we<br />{' '}could take on</h2>
        <ServiceCards />
        <div className="st-service-inquiry">
          <Button to="/consulting/contact">Discuss a project</Button>
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
      <BusinessCase />
      <Callout join />
    </Studio>
  );
}

export function StudioServices() {
  return (
    <Studio title="How we can help" dark>
      <Intro title="How we can help">
        <p>
          Arc Thrift Stores of Colorado is our first client. For future pro bono
          projects, student teams could research business questions for
          disability-focused organizations or accessibility questions for
          companies. Each project would need a scope the team can complete in
          one semester.
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
                View project ideas
              </Button>
            </div>
          </section>
        ))}
      </div>
      <section className="st-wrap st-scope-note">
        <p>
          Before accepting a project, we would agree on the question, available
          information and timeline with your team. Student research can inform
          business recommendations; it does not provide legal advice or
          compliance certification.
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
          <h3>Possible project topics</h3>
          <ul>
            {area.examples.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p>We would agree on a research question and project scope with your organization before taking on any of these topics.</p>
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
          Arc Thrift Stores of Colorado is UBLDA Consulting’s first client. The
          student team will work with the nonprofit retailer from October
          through December 2026 and then present its recommendations to The
          Arc’s national board.
        </p>
      </Intro>
      <section className="st-wrap st-work-row" data-enter>
        <div className="st-work-logo">
          <BrandLogo src="/partners-arc-thrift.png" alt="Arc Thrift Stores" />
        </div>
        <div>
          <p className="st-eyebrow">Our first client · Fall 2026</p>
          <h2>Arc Thrift Stores of Colorado</h2>
          <p>
            Arc Thrift Stores is a nonprofit retailer that funds disability
            advocacy and employs people with intellectual and developmental
            disabilities throughout its operations.
          </p>
          <p>
            Arc Thrift’s CEO sponsors the engagement. Four to six analysts and
            two project managers will meet each week as they prepare for the
            December presentation.
          </p>
          <Button href="https://arcthrift.com">Visit Arc Thrift Stores</Button>
        </div>
      </section>
      <section className="st-wrap st-detail-body">
        <h2>
          How we’ll work
          <br />
          with Arc Thrift
        </h2>
        <div>
          <p>
            The team will use weekly sessions and a midpoint review to test its
            research before the final presentation. Analysts will explain the
            evidence behind their recommendations.
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
            How our consulting
            <br />
            <em>program works</em>
          </>
        }
      >
        <p>
          UBLDA Consulting launched in Fall 2026 as a pro bono program for
          Michigan undergraduates. The program is designed for small teams to
          work on business or accessibility questions from client organizations.
        </p>
        <p>
          Our first client is Arc Thrift Stores of Colorado. During the
          October–December engagement, analysts will research a business
          question and develop recommendations with guidance from two project
          managers.
        </p>
      </Intro>
      <section className="st-wrap st-detail-body" data-enter>
        <h2>
          What analysts
          <br />
          will work on
        </h2>
        <div>
          <p>
            Four to six analysts will work with two project managers. They will
            research the client’s question, compare possible approaches and
            develop recommendations supported by evidence.
          </p>
          <p>
            Project managers will give feedback on weekly work and at a midpoint
            review. The team will then present its final recommendations.
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
            Organizations
            <br />
            <em>connected to UBLDA</em>
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
            Research on disability
            <br />
            <em>in business</em>
          </>
        }
      >
        <p>
          These studies examine how disability and accessibility relate to
          customers, employment, and company performance. Each article connects
          the findings to decisions organizations make and questions students
          can explore, with links to the original research and its limitations.
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
  if (insight === "removing-hiring-barriers") return <Navigate to="/consulting/insights/accommodations-and-retention" replace />;
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
          <h2>Why it matters as a business student</h2>
          <p>{item.studentRelevance}</p>
          <p>{item.studentApplication}</p>
          <h2>What it means for business</h2>
          <p>{item.takeaway}</p>
          <h2>What the data shows</h2>
          <p>{item.context}</p>
          <a className="st-text-link" href={item.url}>
            Read the original source <ArrowUpRight size={18} />
          </a>
          <p className="st-article-note">
            These findings come from the cited researchers and organizations,
            rather than UBLDA client projects. Source checked {item.checkedAt ?? "September 17, 2026"}.
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
          Contact Alex Forstner about the consulting program, analyst
          applications, or a potential project, including your organization’s
          name and the business or accessibility question you’d like a student
          team to research.
        </p>
        <div className="st-contact-emails">
          <a href={CONTACT_MAILTO}>alexfors@umich.edu<ArrowUpRight size={22} /></a>
        </div>
      </Intro>
      <section className="st-wrap st-contact-form" id="contact-form">
        <div>
          <h2>Contact the team</h2>
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
