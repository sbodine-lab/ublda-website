import { useEffect, useId, useRef } from "react";
import { useCompactMotion, useDeviceReducedMotion, useMotionPaused } from "./motionPreference";
import { ribbonNames, ribbonSilhouette } from "./ribbonGeometry";
import "./ribbon.css";

export function RibbonAnchor({ name }: { name: string }) {
  const stage = Math.max(0, ribbonNames.indexOf(name));
  const id = useId().replace(/:/g, "");
  return (
    <div className="eq-glyph eq-ribbon-anchor" data-ribbon-stage={stage} aria-hidden="true">
      <svg viewBox="0 0 300 300" fill="none">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" /><stop offset=".5" stopColor="#faf7ee" /><stop offset="1" stopColor="#7fa49b" />
        </linearGradient></defs>
        {[2, 0, 1].map(band => <path key={band} d={ribbonSilhouette(stage, band)} fill={`url(#${id})`} />)}
      </svg>
    </div>
  );
}

/** One persistent sculpture follows the reading rail and unfolds between values. */
export function RibbonJourney() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paused = useMotionPaused();
  const reduced = useDeviceReducedMotion();
  const compactLayout = useCompactMotion();
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest<HTMLElement>(".eq-values");
    if (!canvas || !section || reduced || paused || compactLayout) return;
    const anchors = [...section.querySelectorAll<HTMLElement>(".eq-ribbon-anchor")];
    const zones = [...section.querySelectorAll<HTMLElement>(".eq-value-zone")];
    let disposed = false, visible = false, loading = false, frame = 0, previous = 0, elapsed = 0;
    let progress = 0, target = 0, centerX = 0, centerY = 0, size = 300;
    let current = 0, compact = false, drawVisible = false;
    let renderer: Awaited<ReturnType<typeof import("./ribbonRenderer")["createRibbonRenderer"]>> | undefined;
    const measure = () => {
      compact = innerWidth <= 768 || innerHeight <= 750 || section.dataset.static === "true";
      const tops = zones.map(zone => zone.getBoundingClientRect().top);
      if (compact) {
        current = anchors.reduce((best, anchor, i) => Math.abs(anchor.getBoundingClientRect().top - innerHeight * .28) < Math.abs(anchors[best].getBoundingClientRect().top - innerHeight * .28) ? i : best, 0);
        target = current;
      } else {
        current = tops.reduce((best, top, i) => top <= 170 ? i : best, 0);
        const next = tops[current + 1];
        target = current + (next === undefined ? 0 : Math.max(0, Math.min(1, (innerHeight * .7 - next) / (innerHeight * .7 - 170))));
      }
      // Every sticky panel shares its bottom boundary. The first anchor is
      // therefore a continuous rail for the entire desktop sequence: switching
      // shapes must not switch DOM positions or reveal a second silhouette.
      const rect = anchors[compact ? current : 0].getBoundingClientRect();
      size = compact ? rect.width : Math.min(340, rect.width * 1.4);
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
      canvas.style.width = canvas.style.height = `${size}px`;
      canvas.style.opacity = renderer && visible && rect.bottom > 68 && rect.top < innerHeight ? "1" : "0";
      anchors.forEach((anchor, i) => { anchor.dataset.live = String((!compact || i === current) && visible && Boolean(renderer)); });
      drawVisible = canvas.style.opacity === "1";
      canvas.dataset.stage = String(target);
      start();
    };
    const tick = (time: number) => {
      frame = 0;
      if (!visible || !drawVisible || document.hidden || !renderer) return;
      if (time - previous < 1000 / (innerWidth <= 768 ? 30 : 60) - 1) { frame = requestAnimationFrame(tick); return; }
      const delta = Math.min(.05, (time - previous) / 1000 || 0);
      previous = time;
      elapsed += delta;
      const difference = target - progress;
      progress += difference * (1 - Math.exp(-7 * delta));
      // Keep translation and geometry on the same smoothed clock. Squared sine
      // has zero slope at each endpoint, so the drift never snaps or reverses
      // abruptly when one form becomes the next.
      const flight = compact ? 0 : Math.sin((progress % 1) * Math.PI) ** 2;
      canvas.style.transform = `translate3d(${centerX - size / 2 + flight * 12}px,${centerY - size / 2 - flight * 20}px,0)`;
      renderer.paint(progress, elapsed);
      frame = requestAnimationFrame(tick);
    };
    function start() { if (!frame && visible && drawVisible && renderer && !document.hidden) { previous = performance.now(); frame = requestAnimationFrame(tick); } }
    const visibleSections = new Set<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleSections.add(entry.target);
        else visibleSections.delete(entry.target);
      }
      visible = visibleSections.size > 0;
      if (!visible) {
        cancelAnimationFrame(frame); frame = 0; canvas.style.opacity = "0";
        anchors.forEach(anchor => { anchor.dataset.live = "false"; });
      } else if (!renderer && !loading) {
        loading = true;
        import("./ribbonRenderer").then(({ createRibbonRenderer }) => {
          if (disposed) return;
          try { renderer = createRibbonRenderer(canvas); measure(); progress = target; start(); }
          catch { canvas.style.opacity = "0"; }
        }).catch(() => { /* Preserve the vector fallback if WebGL is unavailable. */ });
      } else measure();
    });
    observer.observe(section);
    const resize = new ResizeObserver(measure);
    resize.observe(section);
    anchors.forEach(anchor => resize.observe(anchor));
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else { measure(); start(); } };
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      removeEventListener("scroll", measure); removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", visibility);
      renderer?.dispose(); canvas.style.opacity = "0";
      anchors.forEach(anchor => { anchor.dataset.live = "false"; });
    };
  }, [paused, reduced, compactLayout]);
  return <canvas key={`${paused}-${reduced}`} ref={canvasRef} className="eq-ribbon-flight" aria-hidden="true" />;
}
