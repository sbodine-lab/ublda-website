import { useEffect, useId, useRef } from "react";
import { useDeviceReducedMotion, useMotionPaused } from "./motionPreference";
import { ribbonNames, ribbonSilhouette } from "./ribbonGeometry";
import "./ribbon.css";

export function RibbonAnchor({ name }: { name: string }) {
  const stage = Math.max(0, ribbonNames.indexOf(name));
  const id = useId().replace(/:/g, "");
  return (
    <div
      className="eq-glyph eq-ribbon-anchor"
      data-ribbon-stage={stage}
      aria-hidden="true"
    >
      <svg viewBox="0 0 300 300" fill="none">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fff" />
            <stop offset=".5" stopColor="#faf7ee" />
            <stop offset="1" stopColor="#7fa49b" />
          </linearGradient>
        </defs>
        {[2, 0, 1].map((band) => (
          <path
            key={band}
            d={ribbonSilhouette(stage, band)}
            fill={`url(#${id})`}
          />
        ))}
      </svg>
    </div>
  );
}

/** One sculpture, one reading rail. On touch screens CSS owns its sticky position. */
export function RibbonJourney() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paused = useMotionPaused();
  const reduced = useDeviceReducedMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest<HTMLElement>(".eq-values");
    const rail = canvas?.parentElement;
    if (!canvas || !section || !rail || reduced || paused) return;
    const anchors = [
      ...section.querySelectorAll<HTMLElement>(
        ".eq-value-zone .eq-ribbon-anchor",
      ),
    ];
    const zones = [...section.querySelectorAll<HTMLElement>(".eq-value-zone")];
    let disposed = false,
      visible = false,
      loading = false,
      frame = 0,
      measurement = 0,
      previous = 0,
      elapsed = 0;
    let progress = 0,
      target = 0,
      compact = false,
      drawVisible = false;
    let renderer:
      | ReturnType<(typeof import("./ribbonRenderer"))["createRibbonRenderer"]>
      | undefined;
    const measure = () => {
      measurement = 0;
      if (disposed) return;
      compact = section.dataset.static === "true";
      const tops = zones.map((zone) => zone.getBoundingClientRect().top);
      const railRect = rail.getBoundingClientRect();
      const readingLine = compact ? 68 + railRect.height + 48 : 170;
      const current = tops.reduce(
        (best, top, i) => (top <= readingLine ? i : best),
        0,
      );
      const next = tops[current + 1];
      // Hold each recognizable form while its copy is read; unfold as the next
      // heading approaches. Reverse scrolling uses the same continuous timeline.
      const transition = compact
        ? Math.min(220, innerHeight * 0.28)
        : innerHeight * 0.7 - 170;
      target =
        current +
        (next === undefined
          ? 0
          : Math.max(
              0,
              Math.min(1, (readingLine + transition - next) / transition),
            ));
      const rect = compact ? railRect : anchors[0].getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const size = compact
        ? Math.min(220, railRect.height)
        : Math.min(340, rect.width * 1.4);
      canvas.style.width = canvas.style.height = `${size}px`;
      renderer?.resize(size);
      const top = Math.min(
        Math.max(innerHeight * 0.27, sectionRect.top + 110),
        sectionRect.bottom - size - 60,
      );
      canvas.style.transform = compact
        ? "translateX(-50%)"
        : `translate3d(${rect.left + (rect.width - size) / 2}px,${top}px,0)`;
      drawVisible =
        visible &&
        (compact
          ? rect.bottom > 68 && rect.top < innerHeight
          : top + size > 68 && top < innerHeight);
      const counter = section.querySelector(".eq-value-counter span");
      if (counter) counter.textContent = String(Math.round(target) + 1);
      canvas.style.opacity = renderer && drawVisible ? "1" : "0";
      anchors.forEach((anchor) => {
        anchor.dataset.live = String(Boolean(renderer) && visible);
      });
      const fallback = rail.querySelectorAll<HTMLElement>(".eq-ribbon-anchor");
      fallback.forEach((anchor, i) => {
        anchor.style.opacity =
          i === Math.round(target) && !renderer ? "1" : "0";
      });
      canvas.dataset.stage = String(target);
      start();
    };
    const scheduleMeasure = () => {
      if (!measurement) measurement = requestAnimationFrame(measure);
    };
    const tick = (time: number) => {
      frame = 0;
      if (!visible || !drawVisible || document.hidden || !renderer) return;
      if (time - previous < 1000 / (compact ? 30 : 60) - 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const delta = Math.min(0.05, (time - previous) / 1000 || 0);
      previous = time;
      elapsed += delta;
      progress += (target - progress) * (1 - Math.exp(-9 * delta));
      canvas.dataset.progress = progress.toFixed(3);
      renderer.paint(progress, elapsed);
      frame = requestAnimationFrame(tick);
    };
    function start() {
      if (!frame && visible && drawVisible && renderer && !document.hidden) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    const restoreFallback = () => {
      canvas.style.opacity = "0";
      anchors.forEach((anchor) => {
        anchor.dataset.live = "false";
      });
      rail
        .querySelectorAll<HTMLElement>(".eq-ribbon-anchor")
        .forEach((anchor, i) => {
          anchor.style.opacity = i === Math.round(target) ? "1" : "0";
        });
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      frame = 0;
      renderer = undefined;
      restoreFallback();
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        cancelAnimationFrame(frame);
        frame = 0;
        canvas.style.opacity = "0";
      } else if (!renderer && !loading) {
        loading = true;
        import("./ribbonRenderer")
          .then(({ createRibbonRenderer }) => {
            if (disposed) return;
            try {
              renderer = createRibbonRenderer(canvas);
              measure();
              progress = target;
              start();
            } catch {
              restoreFallback();
            }
          })
          .catch(restoreFallback);
      } else measure();
    });
    observer.observe(section);
    const resize = new ResizeObserver(scheduleMeasure);
    resize.observe(section);
    resize.observe(rail);
    anchors.forEach((anchor) => resize.observe(anchor));
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else scheduleMeasure();
    };
    addEventListener("scroll", scheduleMeasure, { passive: true });
    addEventListener("resize", scheduleMeasure);
    document.addEventListener("visibilitychange", visibility);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measurement);
      observer.disconnect();
      resize.disconnect();
      removeEventListener("scroll", scheduleMeasure);
      removeEventListener("resize", scheduleMeasure);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      renderer?.dispose();
      restoreFallback();
    };
  }, [paused, reduced]);
  return (
    <div className="eq-ribbon-rail" aria-hidden="true">
      {ribbonNames.map((name) => (
        <RibbonAnchor key={name} name={name} />
      ))}
      <canvas
        key={`${paused}-${reduced}`}
        ref={canvasRef}
        className="eq-ribbon-flight"
        aria-hidden="true"
      />
    </div>
  );
}
