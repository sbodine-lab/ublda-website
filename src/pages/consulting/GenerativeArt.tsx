import { useEffect, useId, useRef } from "react";
import "./GenerativeArt.css";

type ArtKind = "strategy" | "accessibility" | "workplace" | "perspective" | "practice";

/** Original vector studies: resolution-independent, decorative, and intentionally non-photographic. */
export function GenerativeArt({ kind }: { kind: ArtKind }) {
  const id = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let visible = false;
    const sync = () => {
      el.dataset.active = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const wide = kind === "practice";
  return (
    <div ref={root} className={`st-art st-art--${kind}`} aria-hidden="true">
      <svg viewBox={wide ? "0 0 1600 600" : "0 0 1000 1200"} preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="1" y2="1">
            <stop className="st-art-stop--mint" />
            <stop offset=".48" className="st-art-stop--teal" />
            <stop offset="1" className="st-art-stop--accent" />
          </linearGradient>
          <linearGradient id={`${id}-reverse`} x1="1" y1="0" x2="0" y2="1">
            <stop className="st-art-stop--accent" />
            <stop offset=".55" className="st-art-stop--teal" />
            <stop offset="1" className="st-art-stop--mint" />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop className="st-art-stop--accent" stopOpacity=".65" />
            <stop offset="1" className="st-art-stop--accent" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={wide ? 800 : 500} cy={wide ? 300 : 520} rx={wide ? 1000 : 680} ry={wide ? 500 : 780} fill={`url(#${id}-glow)`} />
        {kind === "perspective" && (
          <g className="st-art-float" fill="none" stroke={`url(#${id}-ribbon)`} strokeWidth="2.4">
            {Array.from({ length: 64 }, (_, i) => {
              const angle = (i / 64) * Math.PI * 2;
              const width = 160 + 190 * (1 + Math.cos(angle));
              return <ellipse key={i} cx="500" cy="600" rx={width} ry="395" transform={`rotate(${i * 2.8125} 500 600)`} opacity={0.45 + 0.5 * (1 + Math.sin(angle)) / 2} />;
            })}
          </g>
        )}
        {kind === "strategy" && (
          <g className="st-art-rise" fill="none" stroke={`url(#${id}-ribbon)`} strokeWidth="3">
            {Array.from({ length: 70 }, (_, i) => (
              <path key={i} d={`M ${-160 + i * 11} 1380 C ${-320 + i * 14} 870, ${960 - i * 10} 810, ${850 - i * 7} 510 S ${120 + i * 6} 130, ${330 + i * 11} -180`} />
            ))}
          </g>
        )}
        {kind === "accessibility" && (
          <g className="st-art-breathe" fill="none" stroke={`url(#${id}-reverse)`} strokeWidth="3.5">
            {Array.from({ length: 48 }, (_, i) => {
              const x = 85 + i * 7.8, y = 150 + i * 9.5, r = 415 - i * 7.8;
              return <path key={i} d={`M ${x} 1400 V ${y + r} A ${r} ${r} 0 0 1 ${1000 - x} ${y + r} V 1400`} />;
            })}
          </g>
        )}
        {kind === "workplace" && (
          <>
            <g className="st-art-weave" fill="none" stroke={`url(#${id}-ribbon)`} strokeWidth="3">
              {Array.from({ length: 52 }, (_, i) => <path key={i} d={`M -160 ${190 + i * 12} C 220 ${-150 + i * 14}, 780 ${1250 - i * 14}, 1160 ${910 - i * 12}`} />)}
            </g>
            <g className="st-art-weave st-art-weave--reverse" fill="none" stroke={`url(#${id}-reverse)`} strokeWidth="3">
              {Array.from({ length: 52 }, (_, i) => <path key={i} d={`M -160 ${910 - i * 12} C 220 ${1250 - i * 14}, 780 ${-150 + i * 14}, 1160 ${190 + i * 12}`} />)}
            </g>
          </>
        )}
        {kind === "practice" && (
          <g className="st-art-tide" fill="none" stroke={`url(#${id}-ribbon)`} strokeWidth="2.5">
            {Array.from({ length: 65 }, (_, i) => <path key={i} d={`M -100 ${-220 + i * 16} C 380 ${820 - i * 9}, 470 ${-340 + i * 12}, 810 ${40 + i * 8} S 1300 ${760 - i * 10}, 1700 ${-100 + i * 14}`} />)}
          </g>
        )}
      </svg>
    </div>
  );
}
