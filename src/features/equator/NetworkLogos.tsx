import { useEffect, useRef, useState, type CSSProperties } from "react";

const logos = [
  ["/partners-blda.webp", "BLDA"],
  ["/consulting/logos/arc-thrift.svg", "Arc Thrift Stores"],
  ["/partners-nestidd.png", "Nestidd"],
  ["/partners-wso.png", "Wall Street Oasis"],
];

export function NetworkLogos() {
  const viewport = useRef<HTMLDivElement>(null);
  const firstSet = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(2);

  useEffect(() => {
    const frame = viewport.current;
    const set = firstSet.current;
    if (!frame || !set) return;
    const measure = () => {
      const cycleWidth = set.getBoundingClientRect().width;
      if (cycleWidth > 0) {
        // Keep a full viewport of logos after advancing one complete set.
        setCopies(Math.max(2, Math.ceil(frame.clientWidth / cycleWidth) + 1));
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(set);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <div className="eq-marquee" ref={viewport}>
      <div style={{ "--logo-set-count": copies } as CSSProperties}>
        {Array.from({ length: copies }, (_, set) => (
          <div
            className="eq-logo-set"
            key={set}
            ref={set === 0 ? firstSet : undefined}
            aria-hidden={set > 0}
          >
            {logos.map(([src, alt]) => (
              <figure key={src}>
                <img src={src} alt={alt} decoding="async" />
              </figure>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
