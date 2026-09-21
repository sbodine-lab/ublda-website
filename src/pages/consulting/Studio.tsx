import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Menu,
  Pause,
  Play,
  X,
} from "lucide-react";
import { useConsultingApplication } from "../../lib/useConsultingApplication";
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";
import { CONTACT_MAILTO, SOCIAL } from "./content";
import { MEMBERSHIP_FORM_URL } from "../../lib/forms";
import { useDeviceReducedMotion } from "../../features/equator/motionPreference";
import "./Studio.css";
import "./accessibility.css";
import "./mobile.css";

export function Button({
  children,
  to,
  href,
  solid = false,
}: {
  children: ReactNode;
  to?: string;
  href?: string;
  solid?: boolean;
}) {
  const cls = `st-button${solid ? " st-button--solid" : ""}`;
  return to ? (
    <Link className={cls} to={to}>
      <ArrowRight size={16} />
      {children}
    </Link>
  ) : (
    <a className={cls} href={href}>
      <ArrowRight size={16} />
      {children}
    </a>
  );
}

export function ApplicationButton({ solid = false }: { solid?: boolean }) {
  const application = useConsultingApplication();
  return <Button href={application.href} solid={solid}>{application.label}</Button>;
}

/** Reference geometry: 22 bands, 6.59s phase cycle, .72s column offset.
 * Canvas keeps the same stepped gradients without hundreds of per-frame DOM writes. */
export function Bands({ className = "" }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      w = 0,
      h = 0,
      visible = false,
      paused = false,
      elapsed = 2200,
      previous = 0,
      lastPaint = 0;
    const styles = getComputedStyle(el);
    const rgb = (token: string) => {
      const hex = styles.getPropertyValue(token).trim().slice(1);
      return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    };
    const bright = rgb("--st-band-bright");
    const dark = rgb("--st-band-dark");
    const palette = Array.from({ length: 22 }, (_, i) =>
      bright.map((channel, j) => channel + ((dark[j] - channel) * i) / 21),
    );
    const colors = [...palette, ...palette.slice(1, -1).reverse()];
    // Reuse a fine-grained palette instead of allocating hundreds of RGB
    // arrays and strings on every frame. Sixteen steps per band remain smooth.
    const paletteSteps = 16;
    const paintColors = Array.from({ length: 42 * paletteSteps }, (_, i) => {
      const lo = Math.floor(i / paletteSteps), mix = (i % paletteSteps) / paletteSteps;
      return `rgb(${colors[lo].map((v, j) => Math.round(v + (colors[(lo + 1) % 42][j] - v) * mix)).join(",")})`;
    });
    const color = (index: number) => paintColors[Math.floor((((index % 42) + 42) % 42) * paletteSteps)];
    const draw = (time: number) => {
      const columns = w <= 768 ? 2 : w <= 1024 ? 4 : 8;
      const band = Math.max(4, Math.round(h / 55)),
        tall = band * 3.3,
        short = Math.max(2, (band * 22 - tall) / 21);
      for (let c = 0; c < columns; c++) {
        const offset = Math.min(c, 3) * 105 + Math.max(0, c - 3) * 336;
        let y = -offset,
          row = 0;
        const shift = ((time - c * 720) * 22) / 6590;
        while (y < h) {
          const flip = Math.floor(row / 22) % 2 === 1,
            index = flip ? 21 - (row % 22) : row % 22;
          const height = index === 0 ? tall : short;
          ctx.fillStyle = color(index + (flip ? -shift : shift));
          ctx.fillRect((c * w) / columns, y, w / columns + 1, height + 0.5);
          y += height;
          row++;
        }
      }
    };
    const tick = (time: number) => {
      if (previous) elapsed += Math.min(time - previous, 50);
      previous = time;
      const interval = 1000 / (w <= 768 ? 30 : 60);
      if (time - lastPaint >= interval) {
        draw(elapsed);
        lastPaint = time - ((time - lastPaint) % interval);
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      paused = document.documentElement.classList.contains("st-paused");
      if (visible && !document.hidden && !media.matches && !paused)
        frame = requestAnimationFrame(tick);
      else if (media.matches || paused) draw(elapsed);
    };
    const resize = new ResizeObserver(() => {
      const width = el.clientWidth, height = el.clientHeight;
      if (width === w && height === h) return;
      w = width;
      h = height;
      // These flat bands don't need a full-resolution retina framebuffer.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(elapsed);
      sync();
    });
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    resize.observe(el);
    observer.observe(el);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("studio-motion", sync);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("studio-motion", sync);
    };
  }, []);
  return (
    <canvas
      ref={canvas}
      className={`st-bands ${className}`}
      aria-hidden="true"
    />
  );
}

const links = [
  ["Our client", "/consulting/work"],
  ["Program", "/consulting/practice"],
  ["Services", "/consulting/services"],
  ["Insights", "/consulting/insights"],
];
export function Studio({
  title,
  children,
  dark = false,
  hero = false,
}: {
  title: string;
  children: ReactNode;
  dark?: boolean;
  hero?: boolean;
}) {
  const application = useConsultingApplication();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const aboutButton = useRef<HTMLButtonElement>(null);
  const [paused, setPaused] = useState(() => {
    try { return localStorage.getItem("ublda-motion-paused") === "true"; }
    catch { return false; }
  });
  const deviceReducedMotion = useDeviceReducedMotion();
  const motionPaused = paused || deviceReducedMotion;
  const previousPathname = useRef<string | null>(null);
  const samePageScrollBehavior = useEffectEvent(() => motionPaused ? "instant" as const : "smooth" as const);
  const { pathname, hash, key: locationKey } = useLocation();
  const closeMenu = useCallback(() => setOpen(false), []);
  useMenuKeyboard(open, root, ".st-navlinks", ".st-menu-toggle", closeMenu);
  useEffect(() => {
    if (!about) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAbout(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [about]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    const onChange = () => {
      if (desktop.matches) closeMenu();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [closeMenu]);
  useEffect(() => {
    document.title = "UBLDA Consulting";
    const frame = requestAnimationFrame(() => {
      const target = (hash && document.getElementById(hash.slice(1))) || root.current?.querySelector<HTMLElement>("main");
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        const behavior = previousPathname.current === pathname ? samePageScrollBehavior() : "instant";
        if (hash) target.scrollIntoView({ behavior });
        else window.scrollTo({ top: 0, behavior });
        previousPathname.current = pathname;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [title, pathname, hash, locationKey]);
  useLayoutEffect(() => {
    document.documentElement.classList.add("st-root");
    return () => {
      document.documentElement.classList.remove(
        "st-root",
        "st-paused",
        "st-menu-open",
      );
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("st-paused", motionPaused);
    window.dispatchEvent(new Event("studio-motion"));
  }, [motionPaused]);
  useEffect(() => {
    document.documentElement.classList.toggle("st-menu-open", open);
    return () => document.documentElement.classList.remove("st-menu-open");
  }, [open]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const items = node.querySelectorAll<HTMLElement>("[data-enter]");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("st-entered");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    if (!motionPaused)
      items.forEach((el) => {
        if (!el.classList.contains("st-entered")) {
          el.classList.add("st-wait");
          observer.observe(el);
        }
      });
    return () => {
      observer.disconnect();
      items.forEach(el => el.classList.remove("st-wait"));
    };
  }, [pathname, motionPaused]);
  const toggleMotion = () => {
    setPaused(!paused);
    try { localStorage.setItem("ublda-motion-paused", String(!paused)); }
    catch { /* The control still works when storage is unavailable. */ }
  };
  const motionLabel = deviceReducedMotion ? "Motion paused by device preference" : paused ? "Resume motion" : "Pause motion";
  return (
    <div
      ref={root}
      data-page={pathname.split("/").at(-1)}
      className={`st ${dark ? "st--dark" : ""} ${hero ? "st--home" : ""}`}
    >
      <header className={`st-header ${hero || dark ? "st-header--light" : ""}`}>
        <div className="st-wrap st-header-inner">
          <div className="st-brand-lockup" inert={open}>
            <Link
              to="/consulting"
              className="st-logo"
              aria-label="UBLDA Consulting home"
            >
              <img
                src="/consulting/logos/consulting-wordmark-color.svg"
                alt="UBLDA Consulting"
                width="116"
                height="48"
              />
            </Link>
            <Link to="/" className="st-parent-link">
              <ArrowLeft size={13} aria-hidden="true" /> UBLDA home
            </Link>
          </div>
          <nav
            id="consulting-nav"
            className={`st-navlinks ${open ? "st-navlinks--open" : ""}`}
            aria-label="Consulting navigation"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) {
                closeMenu();
                setAbout(false);
              }
            }}
          >
            {links.map(([label, to]) => (
              <Link
                key={to}
                to={to}
                aria-current={pathname === to ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
            <div
              className="st-about"
              onMouseEnter={() => setAbout(true)}
              onMouseLeave={(e) => {
                if (!e.currentTarget.contains(document.activeElement)) setAbout(false);
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setAbout(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && about) {
                  e.preventDefault();
                  e.stopPropagation();
                  setAbout(false);
                  aboutButton.current?.focus();
                }
              }}
            >
              <button
                type="button"
                ref={aboutButton}
                aria-expanded={about}
                aria-controls="consulting-about"
                onClick={() => setAbout(!about)}
              >
                About us <ChevronDown size={13} />
              </button>
              <div
                id="consulting-about"
                className="st-dropdown"
                hidden={!about}
              >
                <Link to="/consulting/practice">Our program</Link>
                <Link to="/consulting/leadership">Leadership</Link>
                <Link to="/consulting/partners">Our connections</Link>
                <a href={application.href}>{application.label}</a>
              </div>
            </div>
            <a href={application.href} className="st-nav-contact">
              <ArrowRight size={15} /> {application.label}
            </a>
            <Link to="/" className="st-parent-menu">
              <ArrowLeft size={16} aria-hidden="true" /> UBLDA home
            </Link>
          </nav>
          <button type="button" className="st-motion-toggle" onClick={toggleMotion}
            aria-label={motionLabel} aria-pressed={motionPaused} disabled={deviceReducedMotion} inert={open}>
            {motionPaused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
          </button>
          <button
            className="st-menu-toggle"
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="consulting-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} inert={open}>
        {children}
      </main>
      <div className="st-footer-band" aria-hidden="true" />
      <footer className="st-footer" inert={open}>
        <div className="st-wrap">
          <div className="st-footer-top">
            <h2>
              Business.
              <br />
              Disability.
              <br />
              Possibility.
            </h2>
            <div>
              <Button href={MEMBERSHIP_FORM_URL}>Join the community</Button>
            </div>
          </div>
          <Link className="st-footer-talk" to="/consulting/contact">
            Contact us. <ArrowUpRight />
          </Link>
          <div className="st-footer-grid">
            <div>
              <h3>Services</h3>
              <Link to="/consulting/services/strategy">Strategy & growth</Link>
              <Link to="/consulting/services/accessibility">
                Accessible experiences
              </Link>
              <Link to="/consulting/services/workplace">
                Inclusive workplaces
              </Link>
            </div>
            <div>
              <h3>Our first client</h3>
              <Link to="/consulting/work">Arc Thrift Stores</Link>
              <Link to="/consulting/practice">Our program</Link>
              <Link to="/consulting/insights">Research & insights</Link>
            </div>
            <div>
              <h3>About us</h3>
              <Link to="/consulting/leadership">Leadership</Link>
              <Link to="/consulting/partners">Our connections</Link>
              <a href={application.href}>{application.label}</a>
              <Link to="/">UBLDA home</Link>
            </div>
            <div>
              <h3>Contact</h3>
              <a href={CONTACT_MAILTO}>alexfors@umich.edu</a>
              {SOCIAL.map((s) => (
                <a href={s.href} key={s.href}>
                  {s.label} ↗
                </a>
              ))}
            </div>
          </div>
          <div className="st-footer-bottom">
            <p>
              © {new Date().getFullYear()} UBLDA Consulting · University of
              Michigan · Ann Arbor
            </p>
            <a href="mailto:alexfors@umich.edu?subject=Accessibility%20support">
              Accessibility support
            </a>
            <button type="button" onClick={toggleMotion} aria-pressed={motionPaused} disabled={deviceReducedMotion}>
              {motionPaused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
              {motionLabel}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Callout({ join = false }: { join?: boolean }) {
  const application = useConsultingApplication();
  return (
    <section className="st-wrap st-callout" data-enter>
      <Bands />
      <div>
        <h2>
          {join ? (
            <>
              Interested in
              <br />
              UBLDA Consulting?
            </>
          ) : (
            <>
              Bring us your
              <br />
              next business challenge.
            </>
          )}
        </h2>
        <div className="st-actions">
          <Button
            to={join ? undefined : "/consulting/contact"}
            href={join ? application.href : undefined}
          >
            {join ? application.label : "Discuss a project"}
          </Button>
          <Button to={join ? "/consulting/leadership" : "/consulting/work"}>
            {join ? "Meet the team" : "Meet our first client"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Intro({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="st-wrap st-intro">
      <div data-enter>
        {eyebrow && <p className="st-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children && (
        <div className="st-intro-copy" data-enter>
          {children}
        </div>
      )}
    </section>
  );
}
