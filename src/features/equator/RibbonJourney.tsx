import { useEffect, useId, useRef } from "react";
import { useDeviceReducedMotion, useMotionPaused } from "./motionPreference";
import { ribbonNames, ribbonSilhouette } from "./ribbonGeometry";
import "./ribbon.css";

export function RibbonAnchor({ name, hero = false }: { name: string; hero?: boolean }) {
  const stage = Math.max(0, ribbonNames.indexOf(name));
  const id = useId().replace(/:/g, "");
  return (
    <div className={hero ? "eq-brand-particles eq-ribbon-anchor eq-ribbon-hero" : "eq-glyph eq-ribbon-anchor"} data-ribbon-stage={stage} aria-hidden="true">
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
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest<HTMLElement>(".eq-values");
    if (!canvas || !section || reduced || paused) return;
    const anchors = [...section.querySelectorAll<HTMLElement>(".eq-ribbon-anchor")];
    const scope = section.closest(".eq-site");
    const hero = scope?.querySelector<HTMLElement>(".eq-hero");
    const heroAnchor = hero?.querySelector<HTMLElement>(".eq-ribbon-hero");
    const story = scope?.querySelector<HTMLElement>(".eq-story");
    const allAnchors = heroAnchor ? [heroAnchor, ...anchors] : anchors;
    const zones = [...section.querySelectorAll<HTMLElement>(".eq-value-zone")];
    let disposed = false, visible = false, loading = false, frame = 0, previous = 0, elapsed = 0;
    let progress = 0, target = 0, centerX = 0, centerY = 0, size = 300;
    let current = 0, moving = false, drawVisible = false;
    let renderer: Awaited<ReturnType<typeof import("./ribbonRenderer")["createRibbonRenderer"]>> | undefined;
    const measure = () => {
      const compact = innerWidth <= 768 || innerHeight <= 750 || section.dataset.static === "true";
      const sectionRect = section.getBoundingClientRect();
      const heroRect = hero?.getBoundingClientRect();
      if (heroAnchor && heroRect && sectionRect.top > innerHeight * .72) {
        allAnchors.forEach(anchor => { anchor.dataset.live = "false"; });
        if (heroRect.bottom > innerHeight * .2) {
          const rect = heroAnchor.getBoundingClientRect();
          size = rect.width; centerX = rect.left + size / 2; centerY = rect.top + rect.height / 2;
          target = 2;
          heroAnchor.dataset.live = String(Boolean(renderer) && visible);
        } else {
          // Carry the sculpture down the story's existing empty left margin.
          // Narrow screens keep artwork in its reserved space above the text.
          const text = story?.querySelector(".eq-words")?.getBoundingClientRect();
          size = compact ? 0 : Math.min(190, (text?.left ?? 0) - 35);
          centerX = (text?.left ?? 0) / 2;
          const storyTop = story?.getBoundingClientRect().top ?? 0;
          centerY = innerHeight * .46 + Math.sin(storyTop / 650) * 45;
          target = 1;
        }
        canvas.style.width = canvas.style.height = `${Math.max(0, size)}px`;
        canvas.style.transform = `translate3d(${centerX - size / 2}px,${centerY - size / 2}px,0)`;
        canvas.style.opacity = renderer && visible && size > 100 && (heroRect.bottom > 0 || (story?.getBoundingClientRect().bottom ?? 0) > 0) ? "1" : "0";
        drawVisible = canvas.style.opacity === "1";
        canvas.dataset.stage = String(target); moving = true; start(); return;
      }
      if (heroAnchor) heroAnchor.dataset.live = "false";
      const tops = zones.map(zone => zone.getBoundingClientRect().top);
      if (compact) {
        current = anchors.reduce((best, anchor, i) => Math.abs(anchor.getBoundingClientRect().top - innerHeight * .28) < Math.abs(anchors[best].getBoundingClientRect().top - innerHeight * .28) ? i : best, 0);
        target = current;
      } else {
        current = tops.reduce((best, top, i) => top <= 170 ? i : best, 0);
        const next = tops[current + 1];
        target = current + (next === undefined ? 0 : Math.max(0, Math.min(1, (innerHeight * .7 - next) / (innerHeight * .7 - 170))));
      }
      const rect = anchors[current].getBoundingClientRect();
      const blend = target - Math.floor(target);
      const flight = compact ? 0 : Math.sin(blend * Math.PI);
      size = compact ? rect.width : Math.min(340, rect.width * 1.4);
      centerX = rect.left + rect.width / 2 + flight * 18;
      centerY = rect.top + rect.height / 2 - flight * 48;
      canvas.style.width = canvas.style.height = `${size}px`;
      canvas.style.transform = `translate3d(${centerX - size / 2}px,${centerY - size / 2}px,0)`;
      canvas.style.opacity = renderer && visible && rect.bottom > 68 && rect.top < innerHeight ? "1" : "0";
      anchors.forEach((anchor, i) => { anchor.dataset.live = String(i === current && visible && Boolean(renderer)); });
      drawVisible = canvas.style.opacity === "1";
      canvas.dataset.stage = String(target);
      moving = true;
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
      progress += difference * Math.min(1, delta * 14);
      if (Math.abs(difference) < .002) { progress = target; moving = false; }
      renderer.paint(progress, elapsed, moving ? difference : 0);
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
        allAnchors.forEach(anchor => { anchor.dataset.live = "false"; });
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
    if (heroAnchor && hero) observer.observe(hero);
    if (heroAnchor && story) observer.observe(story);
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
      allAnchors.forEach(anchor => { anchor.dataset.live = "false"; });
    };
  }, [paused, reduced]);
  return <canvas key={`${paused}-${reduced}`} ref={canvasRef} className="eq-ribbon-flight" aria-hidden="true" />;
}
