import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Mail,
  Menu,
  Pause,
  Play,
  X,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  AnimatedMark,
  BrandParticles,
  Glyph,
  LogoStage,
  StoryArtwork,
} from "./BrandMotion";
import {
  MEMBERSHIP_FORM_URL,
  CONSULTING_FORM_URL,
  REMOVAL_FORM_URL,
} from "../../lib/forms";
import {
  applyWindow,
  APPLY_OPENS_AT_MS,
  APPLY_DEADLINE_AT_MS,
  APPLY_WINDOW_PROSE,
} from "../../lib/applyForm";
import { useClock } from "../../lib/useClock";
import { board } from "./content";
import { UpcomingEvents, PastEvents } from "./EventSections";
import { MotionPreference, useDeviceReducedMotion } from "./motionPreference";
import "./equator.css";
import "./refinement.css";
import "./events.css";
import "./accessibility.css";

gsap.registerPlugin(ScrollTrigger);
const values = [
  {
    title: (
      <>
        Inclusion,
        <br />
        from the start
      </>
    ),
    icon: "sustainability",
    a: "Disability inclusion belongs in the decisions that shape businesses: who gets hired, what gets built, and whose needs get heard.",
    b: "We bring that conversation to Michigan Ross, and make space for students to take part.",
  },
  {
    title: (
      <>
        Different experiences.
        <br />A shared purpose.
      </>
    ),
    icon: "global",
    a: "We bring together disabled and non-disabled students, across majors and backgrounds, around a common goal.",
    b: "A business community where people with disabilities can participate, contribute, and lead.",
  },
  {
    title: (
      <>
        Learning grounded
        <br />
        in real experience
      </>
    ),
    icon: "grounded",
    a: "Meet leaders working at the intersection of business and disability. Ask questions, explore their decisions, and learn from the people doing the work.",
    b: "From conversations with business leaders to student consulting projects, we connect ideas with practice.",
  },
  {
    title: (
      <>
        Lead with curiosity.
        <br />
        Listen with care.
      </>
    ),
    icon: "curiosity",
    a: "You don’t need a background in disability advocacy to get involved. Bring your questions, your perspective, and a willingness to learn.",
    b: "We want members to listen closely, challenge assumptions, and help shape what comes next.",
  },
  {
    title: (
      <>
        Build community.
        <br />
        Carry it forward.
      </>
    ),
    icon: "difference",
    a: "Our connection with BLDA, our MBA counterpart at Ross, brings undergraduate and graduate students together around a shared mission.",
    b: "We’re building relationships and experiences that students can take into their careers and communities.",
  },
];
const programs = [
  [
    "Speaker conversations",
    "Hear how business leaders think about disability in employment, technology, housing, and everyday business decisions. Bring your questions to our fireside chats.",
    "/events",
  ],
  [
    "Disability advocacy",
    "Help make disability inclusion part of the conversation at Ross. Learn from different experiences and bring that perspective to the way you study and work.",
    "/about",
  ],
  [
    "Student consulting",
    "Apply business skills to real client questions through our pro bono consulting program. UBLDA Consulting selects its team through a separate application and interview.",
    "/consulting",
  ],
  [
    "Career development",
    "Explore where disability and business intersect, meet professionals in the field, and learn through conversations and project work.",
    "/join",
  ],
  [
    "MBA connections",
    "Connect with Business Leaders for Diverse Abilities, our MBA counterpart at Michigan Ross. We share a mission and opportunities to learn from one another.",
    "/about",
  ],
  [
    "Community & belonging",
    "Meet students who care about inclusion. General membership welcomes all U-M students, with or without a disability or prior experience.",
    "/join",
  ],
  [
    "Education & workshops",
    "Our education team is developing programming on business and disability. Join the club to hear about new workshops as they are announced.",
    "/events",
  ],
  [
    "Student leadership",
    "Help organize events, contribute ideas, and shape the club’s next chapter. UBLDA is built and run by students.",
    "/team",
  ],
];

function Words({
  children,
  indent = false,
}: {
  children: string;
  indent?: boolean;
}) {
  return (
    <p className={`eq-words ${indent ? "eq-indent" : ""}`}>
      <span className="eq-sr-only">{children}</span>
      {children.split(" ").map((word, i) => (
        <span key={i} aria-hidden="true">
          {word}{" "}
        </span>
      ))}
    </p>
  );
}
function Button({ to, children }: { to: string; children: ReactNode }) {
  const contents = (
    <>
      {children}
      <ArrowUpRight size={18} aria-hidden="true" />
    </>
  );
  return to.startsWith("/") ? (
    <Link className="eq-button" to={to}>
      {contents}
    </Link>
  ) : (
    <a className="eq-button" href={to}>
      {contents}
    </a>
  );
}
function Header({ home, paused, systemMotion, onToggleMotion }: { home: boolean; paused: boolean; systemMotion: boolean; onToggleMotion: () => void }) {
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = [...document.querySelectorAll<HTMLElement>(".eq-site > main, .eq-site > footer")];
    background.forEach(element => { element.inert = true; });
    const first = nav.current?.querySelector<HTMLElement>("a");
    first?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
      if (event.key === "Tab") {
        const links = [
          ...(nav.current?.querySelectorAll<HTMLElement>("a") || []),
        ];
        const last = links.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          toggle.current?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          toggle.current?.focus();
        } else if (document.activeElement === toggle.current) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      background.forEach(element => { element.inert = false; });
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const links = home
    ? [
        ["/#our-story", "Our Story"],
        ["/#what-we-stand-for", "What we stand for"],
        ["/#capabilities", "What we do"],
        ["/#our-work", "Our Community"],
        ["/events", "Events"],
        ["/#team", "Team"],
        ["/consulting", "UBLDA Consulting"],
      ]
    : [
        ["/about", "Our Story"],
        ["/#what-we-stand-for", "What we stand for"],
        ["/events", "Events"],
        ["/team", "Team"],
        ["/join", "Join UBLDA"],
        ["/consulting", "UBLDA Consulting"],
      ];
  return (
    <header
      className={`eq-header ${home ? "eq-header--home" : ""} ${open ? "eq-header--open" : ""}`}
    >
      <Link
        className="eq-wordmark"
        to="/"
        aria-label="UBLDA home"
        onClick={() => setOpen(false)}
      >
        UBLDA<span>Michigan Ross</span>
      </Link>
      <button
        className="eq-menu"
        ref={toggle}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="eq-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav ref={nav} id="eq-navigation" aria-label="Main navigation">
        {links.map(([href, text]) => (
          <Link
            key={href}
            to={href}
            aria-current={pathname === href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {text}
          </Link>
        ))}
        <a href="mailto:cooperry@umich.edu" aria-label="Email UBLDA">
          <Mail size={22} />
          <span className="eq-mobile-label">Email us</span>
        </a>
        <a
          href="https://www.linkedin.com/company/ublda/"
          aria-label="UBLDA on LinkedIn"
          target="_blank"
          rel="noreferrer"
        >
          <span className="eq-linkedin-icon" aria-hidden="true">
            in
          </span>
          <span className="eq-mobile-label">LinkedIn</span>
        </a>
      </nav>
      <button
        type="button"
        className="eq-motion-toggle"
        aria-label={systemMotion ? "Animations paused by device preference" : paused ? "Resume animations" : "Pause animations"}
        title={systemMotion ? "Animations paused by device preference" : paused ? "Resume animations" : "Pause animations"}
        aria-pressed={paused}
        disabled={systemMotion}
        onClick={onToggleMotion}
      >
        {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
      </button>
    </header>
  );
}
function Splash() {
  return (
    <section
      className="eq-splash"
      data-tone="cream"
      aria-label="Welcome to UBLDA"
    >
      <div className="eq-splash-brand">
        <LogoStage />
        <p className="eq-affiliation">
          Undergraduate Business Leaders for Diverse Abilities (UBLDA) is a
          student organization that advances disability inclusion in business
          through education, community, and consulting and is affiliated with the
          Stephen M. Ross School of Business.
        </p>
      </div>
      <a
        className="eq-explore"
        href="#intro"
        aria-label="Scroll to introduction"
      >
        <ArrowDown size={16} aria-hidden="true" />
      </a>
    </section>
  );
}
function Hero({
  title,
  description,
  label,
}: {
  title: ReactNode;
  description: string;
  label?: string;
}) {
  return (
    <section className="eq-hero" id="intro" data-tone="teal" aria-label={label}>
      <BrandParticles />
      <h1>{title}</h1>
      <p className="eq-hero-sub">
        <span aria-hidden="true" />
        {description}
      </p>
    </section>
  );
}
function Story({ full = false }: { full?: boolean }) {
  return (
    <section className="eq-story" id="our-story" data-tone="cream">
      <div className="eq-story-inner">
        <Words>
          We’re students with different backgrounds and ambitions, brought
          together by one belief: disability inclusion belongs in business.
        </Words>
        <div className="eq-story-logos" data-reveal>
          <img
            src="/partners-blda.webp"
            alt="Business Leaders for Diverse Abilities"
          />
        </div>
        <Words>
          At Michigan Ross, we’re building a community around that belief.
        </Words>
        <Words indent>
          Through conversations that challenge us. Through relationships that
          connect us. Through work that puts our learning into practice.
        </Words>
        <Words indent>
          We’re UBLDA. And there’s a place for you here.
        </Words>
        {full && (
          <div className="eq-story-origin" data-reveal>
            <h2>
              A shared mission.
              <br />
              An undergraduate chapter.
            </h2>
            <p>
              UBLDA began with a conversation. After being admitted to Michigan,
              Sam Bodine connected with the former co-presidents of BLDA, the
              MBA organization at Ross, about bringing its mission to
              undergraduates.
            </p>
            <p>
              Today, our student team brings that mission to life through
              speaker conversations, community events, and pro bono consulting.
              We welcome students from every school at U-M.
            </p>
          </div>
        )}
        <Link className="eq-text-link" to={full ? "/join" : "/about"}>
          {full ? "Become part of the story" : "More about UBLDA"}
          <ArrowUpRight size={22} />
        </Link>
      </div>
    </section>
  );
}
function Values() {
  const ref = useRef<HTMLElement>(null);
  const number = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const section = ref.current;
    if (!section) return;
    const panels = [...section.querySelectorAll<HTMLElement>(".eq-value-zone")];
    // Enlarged or widely spaced text must never be trapped in a sticky panel.
    let disposed = false;
    let fontsReady = false;
    const reflow = new ResizeObserver(() => {
      if (disposed || !fontsReady || section.dataset.static === "true") return;
      const tooTall = panels.some(panel => (panel.firstElementChild as HTMLElement).offsetHeight > innerHeight - 68);
      if (tooTall) {
        section.dataset.static = "true";
        ScrollTrigger.refresh();
      }
    });
    document.fonts.ready.then(() => {
      if (disposed) return;
      fontsReady = true;
      panels.forEach(panel => reflow.observe(panel.firstElementChild!));
    });
    let frame = 0;
    const update = () => {
      frame = 0;
      const index = panels.reduce(
        (active, panel, i) =>
          panel.getBoundingClientRect().top < 160 ? i : active,
        0,
      );
      if (number.current) number.current.textContent = String(index + 1);
      panels.forEach((panel, i) => {
        const next = panels[i + 1];
        const fade = next
          ? Math.max(
              0,
              Math.min(
                1,
                (next.getBoundingClientRect().top - 170) / (innerHeight * 0.55),
              ),
            )
          : 1;
        panel.style.setProperty("--panel-opacity", String(fade));
      });
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", scroll);
    update();
    return () => {
      disposed = true;
      reflow.disconnect();
      removeEventListener("scroll", scroll);
      removeEventListener("resize", scroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <section
      ref={ref}
      id="what-we-stand-for"
      className="eq-values"
      data-tone="gold"
      aria-label="What we stand for"
    >
      <div className="eq-value-counter" aria-hidden="true">
        <div>
          <span ref={number}>1</span>/5
        </div>
      </div>
      {values.map((v, i) => (
        <div
          className="eq-value-zone"
          key={v.icon}
          style={{ "--index": i } as React.CSSProperties}
        >
          <article className="eq-value">
            <Glyph name={v.icon} />
            <h2>{v.title}</h2>
            <div className="eq-value-copy">
              <p>{v.a}</p>
              <p>{v.b}</p>
            </div>
          </article>
        </div>
      ))}
    </section>
  );
}
function Programs() {
  const [opened, setOpened] = useState<number | null>(null);
  return (
    <section
      className="eq-programs eq-section"
      id="capabilities"
      data-tone="cream"
    >
      <h2 data-reveal>
        A place to learn.
        <br />A chance to contribute.
      </h2>
      <p className="eq-intro" data-reveal>
        Explore business through the lens of disability inclusion. Find a
        conversation, a community, or a project that makes you want to get
        involved.
      </p>
      <div className="eq-program-grid">
        {programs.map(([title, text, url], i) => (
          <article
            className={`eq-program ${opened === i ? "is-open" : ""}`}
            key={title}
          >
            <button
              aria-expanded={opened === i}
              aria-controls={`program-${i}`}
              onClick={() => setOpened(opened === i ? null : i)}
            >
              <h3>{title}</h3>
              <span className="eq-pill" aria-hidden="true">
                {opened === i ? "−" : "+"}
              </span>
            </button>
            <div
              className="eq-program-body"
              id={`program-${i}`}
              inert={opened !== i}
            >
              <div>
                <p>{text}</p>
                <Link to={url} className="eq-text-link">
                  Explore
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
const stories = [
  {
    title: "A conversation with Microsoft",
    art: "microsoft",
    text: "On October 1, join us at Ross for a conversation with Alli Hirt, Director of Accessibility Engineering at Microsoft. Alli joins live by video from Seattle. 7–8 PM ET; attendance is free.",
    link: "/events",
  },
  {
    title: "Learning through client work",
    art: "arc",
    text: "Our Fall 2026 pro bono consulting engagement is with Arc Thrift Stores of Colorado. Students will research business questions and develop recommendations through UBLDA Consulting.",
    link: "/consulting",
  },
  {
    title: "Connected through BLDA",
    art: "blda",
    text: "UBLDA is the undergraduate counterpart to BLDA at Michigan Ross. Our shared mission connects students across programs through disability advocacy and community.",
    link: "/about",
  },
  {
    title: "Conversations that stay with us",
    art: "conversations",
    text: "Past speakers include Lloyd Lewis, CEO of Arc Thrift Stores, and Andrew Parker, CEO and co-founder of Nestidd. We learn directly from leaders working in disability-focused businesses.",
    link: "/events",
  },
];
function Community() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const move = (direction: number) => {
    const card = track.current?.querySelector<HTMLElement>("article");
    if (track.current && card)
      track.current.scrollBy({
        left: direction * (card.offsetWidth + 20),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  return (
    <section
      className="eq-community eq-section"
      id="our-work"
      data-tone="cream"
    >
      <h2 data-reveal>
        Our mission,
        <br />
        in good company.
      </h2>
      <div className="eq-carousel-controls">
        <button
          aria-label="Previous story"
          onClick={() => move(-1)}
          disabled={slide === 0}
        >
          <ArrowLeft />
        </button>
        <button
          aria-label="Next story"
          onClick={() => move(1)}
          disabled={atEnd}
        >
          <ArrowRight />
        </button>
        <span>
          {slide + 1} / {stories.length}
        </span>
      </div>
      <div
        className="eq-carousel"
        ref={track}
        onScroll={() => {
          const el = track.current;
          if (el) {
            setSlide(
              Math.round(
                el.scrollLeft /
                  ((el.firstElementChild as HTMLElement).offsetWidth + 20),
              ),
            );
            setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 5);
          }
        }}
      >
        {stories.map((story, i) => (
          <article
            key={story.title}
            className={`eq-story-card ${active === i ? "is-open" : ""}`}
          >
            <StoryArtwork kind={story.art} />
            <button
              className="eq-card-toggle"
              onClick={() => setActive(active === i ? null : i)}
              aria-expanded={active === i}
              aria-controls={`story-${i}`}
            >
              <h3>{story.title}</h3>
              <span className="eq-pill" aria-hidden="true">
                {active === i ? "−" : "+"}
              </span>
            </button>
            <div
              className="eq-card-detail"
              id={`story-${i}`}
              inert={active !== i}
            >
              <p>{story.text}</p>
              <Link to={story.link} className="eq-text-link" aria-label={`Learn more: ${story.title}`}>
                Learn more
                <ArrowUpRight size={18} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="eq-network" aria-label="Our community">
        <div className="eq-marquee">
          <div>
            {[0, 1].map((set) => (
              <div className="eq-logo-set" key={set} aria-hidden={set === 1}>
                {[
                  ["blda.webp", "BLDA"],
                  ["arc-thrift.png", "Arc Thrift Stores — consulting client"],
                  ["nestidd.png", "Nestidd — past speaker"],
                  ["microsoft.png", "Microsoft — speaker’s organization"],
                  ["wso.png", "Wall Street Oasis"],
                ].map(([src, alt]) => (
                  <img
                    key={src}
                    src={`/partners-${src}`}
                    alt={alt}
                    loading="lazy"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
function TeamSection({ page = false }: { page?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const person = selected === null ? null : board[selected];
  useEffect(() => {
    if (selected === null || !dialog.current) return;
    const panel = dialog.current;
    panel.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      panel.close();
      document.body.style.overflow = previous;
    };
  }, [selected]);
  return (
    <section
      className={`eq-team eq-section ${page ? "eq-team-page" : ""}`}
      id="team"
      data-tone="teal"
    >
      <div className="eq-team-intro">
        {page ? (
          <h1>
            Meet the people
            <br />
            behind UBLDA.
          </h1>
        ) : (
          <h2 data-reveal>
            Students leading
            <br />
            with purpose.
          </h2>
        )}
        <p className="eq-intro">
          We’re a student-run organization. Our executive board brings together
          different interests and experiences to build UBLDA’s programs,
          partnerships, and community.
        </p>
      </div>
      <div
        className="eq-team-interactive"
        onKeyDown={(event) => {
          if (event.key === "Escape") setActive(null);
        }}
      >
        <div
          className={`eq-person-preview ${active !== null ? "is-visible" : ""}`}
          aria-hidden="true"
          inert
        >
          {active !== null && (
            <>
              <div className="eq-person-art">
                <AnimatedMark />
                <span>{board[active].initials}</span>
              </div>
              <h3>{board[active].name}</h3>
              <p>{board[active].desc}</p>
              <div className="eq-person-meta">
                <span>{board[active].role}</span>
              </div>
            </>
          )}
        </div>
        <div className="eq-team-list">
          {board.map((person, i) => (
            <button
              key={person.name}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => { setActive(i); setSelected(i); }}
              className={active === i ? "is-active" : ""}
              aria-expanded={selected === i}
              aria-haspopup="dialog"
              aria-controls="eq-profile-dialog"
            >
              <span>{person.name}</span>
              <small>{person.role}</small>
            </button>
          ))}
        </div>
      </div>
      <dialog ref={dialog} id="eq-profile-dialog" className="eq-profile-dialog" aria-labelledby="eq-profile-title" onClose={() => setSelected(null)}>
        {person && <>
          <button type="button" className="eq-person-close" aria-label="Close team profile" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true" /></button>
          <div className="eq-person-art" aria-hidden="true"><AnimatedMark /><span>{person.initials}</span></div>
          <h2 id="eq-profile-title">{person.name}</h2>
          <p>{person.desc}</p>
          <div className="eq-person-meta">
            <span>{person.role}</span>
            <a href={person.linkedin} target="_blank" rel="noreferrer" aria-label={`${person.name} on LinkedIn`}>LinkedIn<ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
        </>}
      </dialog>
      {!page && (
        <Link to="/team" className="eq-text-link eq-team-link">
          Meet the executive board
          <ArrowUpRight size={20} />
        </Link>
      )}
    </section>
  );
}
function CTA() {
  return (
    <section className="eq-cta" data-tone="cream">
      <BrandParticles closing />
      <h2 data-reveal>Let’s make disability inclusion part of business.</h2>
      <div className="eq-cta-buttons">
        <Button to="/join">Join UBLDA</Button>
        <Button to="/events">Come to an event</Button>
      </div>
    </section>
  );
}
function Footer() {
  return (
    <footer className="eq-footer" data-tone="navy">
      <div className="eq-footer-art">
        <AnimatedMark />
      </div>
      <div className="eq-footer-info">
        <p>
          Undergraduate Business Leaders for Diverse Abilities (UBLDA). A student
          community at Michigan Ross, bringing disability inclusion into
          business.
        </p>
        <a href="https://maps.google.com/?q=701+Tappan+Avenue+Ann+Arbor">
          Michigan Ross · University of Michigan
          <br />
          701 Tappan Avenue, Ann Arbor
        </a>
        <a href="mailto:cooperry@umich.edu">
          <Mail size={20} />
          Email us
        </a>
        <div className="eq-footer-social">
          <a href="https://www.linkedin.com/company/ublda/">
            LinkedIn
            <ArrowUpRight size={16} />
          </a>
          <a href="https://www.instagram.com/michiganublda/">
            Instagram
            <ArrowUpRight size={16} />
          </a>
        </div>
        <p className="eq-copyright">© {new Date().getFullYear()} UBLDA</p>
      </div>
      <Link className="eq-footer-wordmark" to="/">
        UBLDA
      </Link>
      <nav className="eq-footer-nav" aria-label="Footer navigation">
        {[
          ["/about", "Our Story"],
          ["/events", "Events"],
          ["/team", "Team"],
          ["/consulting", "Consulting"],
          ["/join", "Join"],
          ["/brand", "Brand"],
          ["/links", "Links"],
          ["/unsubscribe", "Unsubscribe"],
          ["/workspace", "Leadership login"],
        ].map(([url, label]) => (
          <Link key={url} to={url}>
            {label}
          </Link>
        ))}
        <a href="mailto:cooperry@umich.edu?subject=Accessibility%20support">
          Accessibility support
        </a>
      </nav>
    </footer>
  );
}
function EventsPage() {
  return (
    <>
      <Hero
        label="Events at UBLDA"
        title={
          <>
            Good questions.
            <br />
            New perspectives.
          </>
        }
        description="Conversations with business leaders and experiences with the wider disability community at Michigan Ross."
      />
      <UpcomingEvents />
      <PastEvents />
      <CTA />
    </>
  );
}
function JoinPage() {
  const state = applyWindow(
    useClock(APPLY_OPENS_AT_MS, APPLY_DEADLINE_AT_MS),
    APPLY_DEADLINE_AT_MS,
  );
  return (
    <>
      <Hero
        label="Join UBLDA"
        title={
          <>
            Your perspective
            <br />
            belongs here.
          </>
        }
        description="All U-M students are welcome. You don’t need a business major, a disability, or experience in advocacy. Start with curiosity."
      />
      <section className="eq-section eq-join" data-tone="cream">
        <h2 data-reveal>Find your way in.</h2>
        <div className="eq-join-grid">
          <article>
            <h3>
              Be part of
              <br />
              the community.
            </h3>
            <p>
              Join UBLDA for speaker events, club updates, and opportunities to
              connect with students who care about disability inclusion in
              business.
            </p>
            <p>
              General membership is open to all U-M students. It is separate
              from the consulting team application.
            </p>
            <Button to={MEMBERSHIP_FORM_URL}>Join UBLDA</Button>
          </article>
          <article>
            <h3>
              Put your learning
              <br />
              into practice.
            </h3>
            <p>
              UBLDA Consulting is our pro bono student consulting program. Work
              with a team on real business questions for a client.
            </p>
            <p>
              {state === "closed"
                ? "Fall 2026 consulting applications are closed."
                : `Fall 2026 applications run ${APPLY_WINDOW_PROSE}. No consulting experience is required.`}
            </p>
            <Button to="/consulting">Explore UBLDA Consulting</Button>
            {state === "open" && (
              <a className="eq-text-link" href={CONSULTING_FORM_URL}>
                Open the application
                <ArrowUpRight size={18} />
              </a>
            )}
          </article>
        </div>
      </section>
      <section className="eq-section eq-questions" data-tone="gold">
        <h2>Come as you are.</h2>
        {[
          [
            "Do I need to be a Ross student?",
            "No. UBLDA welcomes students from every school and major at the University of Michigan.",
          ],
          [
            "Do I need to have a disability?",
            "No. Disabled and non-disabled students are welcome. A shared interest in disability inclusion is what brings us together.",
          ],
          [
            "Is general membership the consulting application?",
            "No. General membership connects you with the club and its events. UBLDA Consulting has a separate application and interview process.",
          ],
          [
            "How can I request accessibility support?",
            "Email Cooper Perry at cooperry@umich.edu with questions or access needs for an event.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
function BrandPage() {
  return (
    <>
      <Hero
        label="UBLDA Brand"
        title={
          <>
            Different parts.
            <br />
            One identity.
          </>
        }
        description="Our mark brings people together. Our colors connect every piece of UBLDA’s public identity."
      />
      <section className="eq-section" data-tone="cream">
        <h2>Our colors.</h2>
        <div className="eq-swatches">
          {[
            ["Navy", "#0A3658"],
            ["Teal", "#67B8B3"],
            ["Gold", "#D2A54B"],
            ["Cream", "#FAF9F6"],
          ].map(([name, hex]) => (
            <article key={hex}>
              <div style={{ background: hex }} />
              <h3>{name}</h3>
              <span>{hex}</span>
            </article>
          ))}
        </div>
        <div className="eq-brand-assets">
          <AnimatedMark />
          <div>
            <h2>Our mark.</h2>
            <p>
              Use the official UBLDA logo with its proportions and colors
              intact. Leave clear space around it.
            </p>
            <a className="eq-button" href="/logo-mark.svg" download>
              Download SVG
              <ArrowDown size={18} />
            </a>
            <a className="eq-button" href="/logo-1000.png" download>
              Download PNG
              <ArrowDown size={18} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
function LinksPage() {
  return (
    <>
      <Hero
        label="UBLDA · Michigan Ross"
        title={
          <>
            One community.
            <br />
            Many ways in.
          </>
        }
        description="Find your next event, join the club, or explore UBLDA Consulting."
      />
      <section className="eq-section eq-quick-links" data-tone="cream">
        {[
          [MEMBERSHIP_FORM_URL, "Join UBLDA"],
          ["/events", "Upcoming events"],
          ["/consulting", "UBLDA Consulting"],
          ["/team", "Meet the team"],
          ["https://www.instagram.com/michiganublda/", "Instagram"],
          ["https://www.linkedin.com/company/ublda/", "LinkedIn"],
          ["mailto:cooperry@umich.edu", "Get in touch"],
        ].map(([url, label]) => (
          <Button key={url} to={url}>
            {label}
          </Button>
        ))}
      </section>
    </>
  );
}
function UnsubscribePage() {
  return (
    <>
      <Hero
        label="Membership"
        title={
          <>
            Keep your inbox
            <br />
            your own.
          </>
        }
        description="Use our removal form to leave the UBLDA mailing list."
      />
      <section className="eq-section" data-tone="cream">
        <Button to={REMOVAL_FORM_URL}>Open removal form</Button>
      </section>
    </>
  );
}

export default function EquatorSite() {
  const { pathname, hash } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  const systemMotion = useDeviceReducedMotion();
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem("ublda-motion-paused") === "true"; }
    catch { return false; }
  });
  const motionPaused = paused || systemMotion;
  const toggleMotion = () => {
    const next = !paused;
    setPaused(next);
    try { localStorage.setItem("ublda-motion-paused", String(next)); }
    catch { /* The control still works when browser storage is unavailable. */ }
  };
  const home = pathname === "/";
  useEffect(() => {
    if (motionPaused) return;
    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>(".eq-words").forEach((p) =>
          gsap.fromTo(
            p.querySelectorAll("span[aria-hidden]"),
            { opacity: 0.6 },
            {
              opacity: 1,
              stagger: 0.07,
              ease: "none",
              scrollTrigger: {
                trigger: p,
                start: "top 90%",
                end: "bottom 60%",
                scrub: 0.25,
              },
            },
          ),
        );
        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) =>
          gsap.from(el, {
            y: 35,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          }),
        );
      });
      return () => media.revert();
    }, root);
    return () => context.revert();
  }, [motionPaused, pathname]);
  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "Disability inclusion belongs in business",
      "/about": "Our Story",
      "/team": "Our Team",
      "/events": "Events",
      "/join": "Join UBLDA",
      "/brand": "Brand",
      "/links": "Links",
      "/unsubscribe": "Unsubscribe",
    };
    document.title = `${titles[pathname] || "UBLDA"} — UBLDA · Michigan Ross`;
    const old = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    if (previousPath.current !== pathname) root.current?.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
    previousPath.current = pathname;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = root.current;
      if (!el) return;
      const start = innerWidth > 768 ? innerHeight / 2 - 34 : 0;
      const y = home ? Math.max(0, start - scrollY) : 0;
      const scale = home
        ? 1 + Math.max(0, 1 - scrollY / (innerHeight * 0.65)) * 0.5
        : 1;
      el.style.setProperty("--brand-y", `${y}px`);
      el.style.setProperty("--brand-scale", String(scale));
      el.dataset.navVisible = String(!home || scrollY > innerHeight * 0.35);
      const sections = [...el.querySelectorAll<HTMLElement>("[data-tone]")];
      const section = sections.find((section) => {
        const r = section.getBoundingClientRect();
        return r.top <= 80 && r.bottom > 80;
      });
      el.dataset.headerTone = section?.dataset.tone || "teal";
      if (home)
        el.querySelectorAll<HTMLAnchorElement>(".eq-header nav a").forEach(
          (link) => {
            if (link.hash && link.hash.slice(1) === section?.id)
              link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          },
        );
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("resize", scroll);
    update();
    const refresh = () => ScrollTrigger.refresh();
    document.fonts.ready.then(refresh);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", scroll);
      removeEventListener("resize", scroll);
      document.documentElement.style.scrollBehavior = old;
    };
  }, [home, pathname]);
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: "instant", block: "start" });
      const heading = id === "main-content" ? target : target.querySelector<HTMLElement>("h1, h2, h3") || target;
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, pathname]);
  let content: ReactNode;
  if (home)
    content = (
      <>
        <Splash />
        <Hero
          title={
            <>
              Disability inclusion
              <br />
              belongs in
              <br />
              business.
            </>
          }
          description="A student community at Michigan Ross. We bring people together to learn, lead, and make business more inclusive."
        />
        <Story />
        <Values />
        <Programs />
        <Community />
        <UpcomingEvents preview />
        <PastEvents preview />
        <TeamSection />
        <CTA />
      </>
    );
  else if (pathname === "/about")
    content = (
      <>
        <Hero
          label="Our Story"
          title={
            <>
              Business is better
              <br />
              when everyone
              <br />
              belongs.
            </>
          }
          description="We are Undergraduate Business Leaders for Diverse Abilities (UBLDA), a student organization at Michigan Ross, open to every U-M student."
        />
        <Story full />
        <Values />
        <CTA />
      </>
    );
  else if (pathname === "/team")
    content = (
      <>
        <TeamSection page />
        <CTA />
      </>
    );
  else if (pathname === "/events") content = <EventsPage />;
  else if (pathname === "/join") content = <JoinPage />;
  else if (pathname === "/brand") content = <BrandPage />;
  else if (pathname === "/links") content = <LinksPage />;
  else content = <UnsubscribePage />;
  return (
    <MotionPreference value={motionPaused}>
    <div
      ref={root}
      className="eq-site"
      data-header-tone="teal"
      data-nav-visible={!home}
      data-motion-paused={motionPaused}
    >
      <a className="eq-skip" href="#main-content">
        Skip to content
      </a>
      <Header key={pathname} home={home} paused={motionPaused} systemMotion={systemMotion} onToggleMotion={toggleMotion} />
      <main id="main-content" tabIndex={-1}>{content}</main>
      <Footer />
    </div>
    </MotionPreference>
  );
}
