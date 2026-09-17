import { useEffect, useId, useRef } from "react";

const strands = Array.from({ length: 19 }, (_, i) => i);

/** Contour ribbons give each value a related, architectural form. */
function loop(row: number, open = false) {
  const width = (row - 9) * 2.6;
  return Array.from({ length: 97 }, (_, index) => {
    const t = (index / 96) * Math.PI * (open ? 1.62 : 2);
    const radius = 69 + width * Math.cos(t / 2);
    const x = radius * Math.cos(t);
    const y = radius * Math.sin(t) * 0.68 + width * Math.sin(t / 2) * 0.8;
    const angle = -0.35;
    return `${index ? "L" : "M"}${(120 + x * Math.cos(angle) - y * Math.sin(angle)).toFixed(2)},${(120 + x * Math.sin(angle) + y * Math.cos(angle)).toFixed(2)}`;
  }).join(" ");
}

export function ValueSculpture({ name }: { name: string }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      node.dataset.moving = String(entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`eq-glyph eq-sculpture eq-sculpture--${name}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 240 240"
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id={`${id}-ink`} x1=".1" y1="0" x2=".9" y2="1">
            <stop stopColor="#0A3658" />
            <stop offset=".52" stopColor="#326D69" />
            <stop offset="1" stopColor="#A4772E" />
          </linearGradient>
          <linearGradient id={`${id}-teal`} x1="0" x2="1" y1="0" y2=".7">
            <stop stopColor="#0A3658" />
            <stop offset="1" stopColor="#45918B" />
          </linearGradient>
        </defs>
        <g className="eq-sculpture-body" stroke={`url(#${id}-ink)`}>
          {name === "sustainability" &&
            strands.map((i) => <path key={i} d={loop(i)} />)}
          {name === "global" &&
            [0, 120, 240].map((angle, n) => (
              <g key={angle} transform={`rotate(${angle} 120 120)`}>
                <g className={`eq-sculpture-fold eq-sculpture-fold--${n}`}>
                  {strands.map((i) => (
                    <path
                      key={i}
                      d={`M${120 + i * 0.7} ${122 + i * 0.35} C${129 + i * 1.9} ${109 - i * 1.3},${135 + i * 1.7} ${56 - i * 0.5},${98 + i * 2.8} ${33 + i * 0.75}`}
                    />
                  ))}
                </g>
              </g>
            ))}
          {name === "grounded" &&
            [-1, 1].map((side) => (
              <g
                key={side}
                transform={`translate(120 0) scale(${side} 1) translate(-120 0)`}
              >
                <g className="eq-sculpture-page">
                  {strands.map((i) => (
                    <path
                      key={i}
                      d={`M120 ${182 - i * 1.6} C${105 - i * 0.5} ${152 - i * 2.2},${64 - i} ${170 - i * 4},${35 + i * 1.8} ${140 - i * 4.6}`}
                    />
                  ))}
                </g>
              </g>
            ))}
          {name === "curiosity" && (
            <>
              <g className="eq-sculpture-arc">
                {strands.map((i) => (
                  <path key={i} d={loop(i, true)} />
                ))}
              </g>
              <g
                transform="translate(240 240) rotate(180)"
                stroke={`url(#${id}-teal)`}
              >
                <g className="eq-sculpture-arc">
                  {strands
                    .filter((i) => i % 2 === 0)
                    .map((i) => (
                      <path key={i} d={loop(i, true)} />
                    ))}
                </g>
              </g>
            </>
          )}
          {name === "difference" && (
            <>
              <g className="eq-sculpture-weave">
                {strands.map((i) => (
                  <path
                    key={i}
                    d={`M34 ${86 + i * 2.7} C88 ${31 + i * 3.6},152 ${184 - i * 2.5},206 ${131 + i * 2.7}`}
                  />
                ))}
              </g>
              <g transform="rotate(90 120 120)" stroke={`url(#${id}-teal)`}>
                <g className="eq-sculpture-weave">
                  {strands.map((i) => (
                    <path
                      key={i}
                      d={`M34 ${86 + i * 2.7} C88 ${31 + i * 3.6},152 ${184 - i * 2.5},206 ${131 + i * 2.7}`}
                    />
                  ))}
                </g>
              </g>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}
