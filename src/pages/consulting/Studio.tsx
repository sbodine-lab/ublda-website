import {
  useCallback,
  useEffect,
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
import { useMenuKeyboard } from "../../hooks/useMenuKeyboard";
import { LEADERS, SOCIAL } from "./content";
import { MEMBERSHIP_FORM_URL } from "../../lib/forms";
import "./Studio.css";

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
      visible = true,
      paused = false;
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
    const color = (index: number) => {
      const phase = ((index % 42) + 42) % 42,
        lo = Math.floor(phase),
        mix = phase - lo;
      return `rgb(${colors[lo].map((v, j) => Math.round(v + (colors[(lo + 1) % 42][j] - v) * mix)).join(",")})`;
    };
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
      draw(time);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      paused = document.documentElement.classList.contains("st-paused");
      if (visible && !document.hidden && !media.matches && !paused)
        frame = requestAnimationFrame(tick);
      else draw(2200);
    };
    const resize = new ResizeObserver(() => {
      w = el.clientWidth;
      h = el.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  ["Work", "/consulting/work"],
  ["Practice", "/consulting/practice"],
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
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const [paused, setPaused] = useState(false);
  const { pathname, hash } = useLocation();
  const closeMenu = useCallback(() => setOpen(false), []);
  useMenuKeyboard(open, root, ".st-navlinks", ".st-menu-toggle", closeMenu);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1025px)");
    const onChange = () => {
      if (desktop.matches) closeMenu();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [closeMenu]);
  useEffect(() => {
    document.title =
      title === "Home"
        ? "UBLDA Consulting | Student consulting at Michigan Ross"
        : `${title} · UBLDA Consulting`;
    document.documentElement.classList.add("st-root");
    if (hash)
      requestAnimationFrame(() =>
        document.getElementById(hash.slice(1))?.scrollIntoView(),
      );
    else window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      document.documentElement.classList.remove(
        "st-root",
        "st-paused",
        "st-menu-open",
      );
    };
  }, [title, pathname, hash]);
  useEffect(() => {
    document.documentElement.classList.toggle("st-menu-open", open);
    return () => document.documentElement.classList.remove("st-menu-open");
  }, [open]);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
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
    if (!media.matches)
      items.forEach((el) => {
        el.classList.add("st-wait");
        observer.observe(el);
      });
    let frame = 0;
    const update = () => {
      frame = 0;
      node.querySelectorAll<HTMLElement>(".st-metrics").forEach((el) => {
        const shift = Math.min(
          1,
          Math.max(
            0,
            0.6 - el.getBoundingClientRect().top / window.innerHeight,
          ),
        );
        el.style.setProperty("--shift", String(shift));
      });
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(frame);
    };
  }, [pathname]);
  const toggleMotion = () => {
    document.documentElement.classList.toggle("st-paused", !paused);
    setPaused(!paused);
    window.dispatchEvent(new Event("studio-motion"));
  };
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
          <nav
            id="consulting-nav"
            className={`st-navlinks ${open ? "st-navlinks--open" : ""}`}
            aria-label="Consulting navigation"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) closeMenu();
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
              onMouseLeave={() => setAbout(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setAbout(false);
              }}
            >
              <button
                type="button"
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
                <Link to="/consulting/practice">Our practice</Link>
                <Link to="/consulting/leadership">Leadership</Link>
                <Link to="/consulting/partners">Our connections</Link>
                <Link to="/consulting/contact#join">Join the team</Link>
              </div>
            </div>
            <Link to="/consulting/contact#join" className="st-nav-contact">
              <ArrowRight size={15} /> Join the team
            </Link>
            <Link to="/" className="st-parent-menu">
              <ArrowLeft size={16} aria-hidden="true" /> UBLDA home
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" inert={open}>
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
            Get involved. <ArrowUpRight />
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
              <h3>Our work</h3>
              <Link to="/consulting/work">Arc Thrift Stores</Link>
              <Link to="/consulting/practice">How we work</Link>
              <Link to="/consulting/insights">Research & insights</Link>
            </div>
            <div>
              <h3>About us</h3>
              <Link to="/consulting/leadership">Leadership</Link>
              <Link to="/consulting/partners">Our connections</Link>
              <Link to="/consulting/contact#join">Join the team</Link>
              <Link to="/">UBLDA home</Link>
            </div>
            <div>
              <h3>Contact</h3>
              {LEADERS.map((l) => (
                <a href={`mailto:${l.email}`} key={l.email}>
                  {l.email}
                </a>
              ))}
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
            <a href="mailto:cooperry@umich.edu?subject=Accessibility%20support">
              Accessibility support
            </a>
            <button onClick={toggleMotion} aria-pressed={paused}>
              {paused ? <Play size={13} /> : <Pause size={13} />}
              {paused ? "Resume motion" : "Pause motion"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Callout({ join = false }: { join?: boolean }) {
  return (
    <section className="st-wrap st-callout" data-enter>
      <Bands />
      <div>
        <h2>
          {join ? (
            <>
              Build your consulting skills.
              <br />
              Put them to work for a client.
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
            to={join ? "/consulting/contact#join" : "/consulting/contact"}
          >
            {join ? "Join the team" : "Discuss a project"}
          </Button>
          <Button to={join ? "/consulting/leadership" : "/consulting/work"}>
            {join ? "Meet the team" : "Explore our work"}
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
