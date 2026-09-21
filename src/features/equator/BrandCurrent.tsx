import { useEffect, useRef } from "react";
import { useMotionPaused } from "./motionPreference";

/** An original flowing field: separate strands gather into one shared current. */
export function BrandCurrent() {
  const ref = useRef<HTMLCanvasElement>(null);
  const paused = useMotionPaused();
  useEffect(() => {
    const canvas = ref.current,
      context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let width = 1,
      height = 1,
      frame = 0,
      visible = false,
      previous = 0,
      elapsed = 0,
      scroll = 0;
    const paint = (time: number) => {
      context.clearRect(0, 0, width, height);
      const amplitude = Math.min(width * 0.21, height * 0.3);
      for (let band = 0; band < 24; band++) {
        const lane = band / 23;
        context.beginPath();
        for (let i = 0; i <= 70; i++) {
          const x = (i / 70) * width;
          const phase = (x / width) * Math.PI * 2.3 - time * 0.24;
          const envelope = 0.38 + 0.62 * Math.sin((i / 70) * Math.PI) ** 2;
          const y =
            height * 0.68 +
            Math.sin(phase + lane * 0.85) * amplitude * envelope +
            (lane - 0.5) * height * 0.34 +
            Math.sin(phase * 1.7 - time * 0.2) * 16 +
            scroll * 24;
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle =
          band % 5 === 0 ? "rgba(255,252,241,.34)" : "rgba(246,244,232,.17)";
        context.lineWidth = band % 5 === 0 ? 2 : 1;
        context.stroke();
      }
    };
    const tick = (time: number) => {
      frame = 0;
      if (!visible || paused || document.hidden) return;
      if (time - previous >= 1000 / 30 - 1) {
        elapsed += Math.min(0.05, (time - previous) / 1000);
        previous = time;
        paint(elapsed);
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame && visible && !paused && !document.hidden) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      const ratio = Math.min(devicePixelRatio, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint(elapsed);
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    observer.observe(canvas);
    const onScroll = () => {
      if (visible && !paused)
        scroll = canvas.getBoundingClientRect().top / innerHeight;
    };
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else start();
    };
    addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [paused]);
  return <canvas ref={ref} className="eq-brand-current" aria-hidden="true" />;
}
