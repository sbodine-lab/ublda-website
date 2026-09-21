import { useEffect, useRef } from "react";
import logoSource from "../../../public/logo-mark.svg?raw";
import { useMotionPaused } from "./motionPreference";

type Particle = { x: number; y: number; color: string; seed: number };
type LogoArtwork = { particles: Particle[]; image: HTMLImageElement };
let sampledLogo: Promise<LogoArtwork> | undefined;

/** Sample the actual artwork so the flock retains the club's exact silhouette. */
function getParticles() {
  return (sampledLogo ??= new Promise<LogoArtwork>((resolve, reject) => {
    const image = new Image();
    const source = logoSource.replace(
      'width="1000" height="1000"',
      'width="460" height="460" viewBox="275 285 460 460"',
    );
    image.onload = () => {
      const sample = document.createElement("canvas");
      sample.width = sample.height = 460;
      const context = sample.getContext("2d", { willReadFrequently: true });
      if (!context) return reject(new Error("Canvas unavailable"));
      context.drawImage(image, 0, 0, 460, 460);
      const { data } = context.getImageData(0, 0, 460, 460);
      const points: Particle[] = [];
      for (let y = 3; y < 460; y += 6) {
        for (let x = 3; x < 460; x += 6) {
          const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
          const px = Math.min(459, x + (seed % 3) - 1);
          const py = Math.min(459, y + ((seed >>> 3) % 3) - 1);
          const index = (py * 460 + px) * 4;
          if (data[index + 3] < 180) continue;
          points.push({
            x: px,
            y: py,
            seed: (seed % 10000) / 10000,
            color: `rgb(${data[index]},${data[index + 1]},${data[index + 2]})`,
          });
        }
      }
      resolve({ particles: points, image });
    };
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  }));
}

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// Zero velocity and acceleration at both ends of the final material transition.
const settle = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** An organic flock, not a tiled texture: every fleck has its own flight path. */
export function ParticleLogo({ colored = false }: { colored?: boolean }) {
  const paused = useMotionPaused();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const context = canvas?.getContext("2d");
    if (!canvas || !parent || !context) return;
    const staticMark = parent.querySelector<HTMLElement>(".eq-particle-static");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let particles: Particle[] = [];
    let frame = 0;
    let disposed = false;
    let visible = false;
    let elapsed = 0;
    let previous = 0;
    let lastPaint = 0;
    let pointerX = 0;
    let pointerY = 0;
    let aimX = 0;
    let aimY = 0;
    let fleckScale = 1;
    let solidPainted = false;
    const resize = new ResizeObserver(([entry]) => {
      // Keep individual flecks legible when the canvas is scaled down on phones.
      fleckScale = Math.max(1, Math.min(2, 380 / entry.contentRect.width));
      if (particles.length && (paused || motion.matches)) paint(0, true);
    });

    const size = Math.round(600 * Math.min(devicePixelRatio || 1, 1.5));
    canvas.width = canvas.height = size;
    context.setTransform(size / 600, 0, 0, size / 600, 0, 0);
    // Composite the flock and the original artwork in the same pixel space.
    // The DOM SVG is a fallback only; there is no renderer switch at the end.
    const particleLayer = document.createElement("canvas");
    const logoLayer = document.createElement("canvas");
    particleLayer.width = logoLayer.width = size;
    particleLayer.height = logoLayer.height = size;
    const particleContext = particleLayer.getContext("2d");
    const logoContext = logoLayer.getContext("2d");
    if (!particleContext || !logoContext) return;
    particleContext.setTransform(size / 600, 0, 0, size / 600, 0, 0);
    logoContext.setTransform(size / 600, 0, 0, size / 600, 0, 0);
    resize.observe(parent);

    const paint = (seconds: number, still = false) => {
      // Assemble, hold, release into a rippling flock, and return without a loop cut.
      const cycle = seconds % (colored ? 12.4 : 16);
      const disperse = still
        ? 0
        : colored
          ? cycle < 2.7
            ? 1 - smooth(cycle / 2.7)
            : cycle < 8.7
              ? 0
              : smooth((cycle - 8.7) / 2.7)
          : cycle < 3
            ? 0
            : cycle < 8
              ? smooth((cycle - 3) / 5)
              : cycle < 10
                ? 1
                : 1 - smooth((cycle - 10) / 6);
      const solid = colored ? 1 - settle(disperse / 0.36) : 0;
      // Both layers share the exact final geometry throughout the optical blend.
      const drift = colored ? disperse * (1 - solid) ** 2 : disperse;
      if (staticMark) {
        staticMark.style.opacity = "0";
        staticMark.style.transform = "none";
      }
      const hold = Math.max(0, Math.min(1, (cycle - 3.05) / 5.3));
      const tilt =
        still || solid < 1
          ? 0
          : Math.sin(hold * Math.PI * 2) * Math.sin(hold * Math.PI) ** 2;
      canvas.style.opacity = "1";
      canvas.style.transform = colored
        ? `perspective(1000px) rotateY(${tilt * 5}deg) rotateX(${tilt * -2}deg)`
        : "none";
      if (solid === 1) {
        if (!solidPainted) {
          context.clearRect(0, 0, 600, 600);
          context.drawImage(logoLayer, 0, 0, 600, 600);
          solidPainted = true;
        }
        return;
      }
      solidPainted = false;
      context.clearRect(0, 0, 600, 600);
      const ink = colored ? particleContext : context;
      if (colored) ink.clearRect(0, 0, 600, 600);
      pointerX += (aimX - pointerX) * 0.04;
      pointerY += (aimY - pointerY) * 0.04;
      for (const point of particles) {
        const seed = point.seed;
        const sx = (point.x - 230) * (colored ? 456 / 460 : 1.06);
        const sy = (point.y - 230) * (colored ? 456 / 460 : 1.06);
        const phase = seed * Math.PI * 2;
        const depth = Math.sin(phase + seconds * 0.45 * (1 - solid));
        const ripple = Math.sin(
          point.x * 0.021 + seconds * 1.8 + point.y * 0.008,
        );
        const flutter = still ? 0 : Math.sin(seconds * 2.5 + phase);
        const waveX = sx * 0.87 + 45 * Math.sin(phase + seconds * 0.42);
        const waveY =
          83 * Math.sin(sx * 0.012 + seconds * 0.7) + (seed - 0.5) * 85;
        const x =
          300 +
          sx * (1 - drift) +
          waveX * drift +
          ripple * (colored ? 8 : 15) * drift +
          pointerX * depth * (colored ? drift : 1);
        const y =
          300 +
          sy * (1 - drift) +
          waveY * drift +
          flutter * (colored ? 5 * drift : 10 * (drift + 0.12)) +
          pointerY * depth * (colored ? drift : 1);
        const radius = (0.75 + seed * 0.85 + (depth + 1) * 0.22) * fleckScale;
        ink.globalAlpha = 0.48 + (depth + 1) * 0.22;
        ink.fillStyle = colored ? point.color : "#ffffff";
        // Short elliptical strokes capture the original bird's feather-like texture.
        ink.beginPath();
        ink.ellipse(
          x,
          y,
          radius * (1.2 + disperse * 1.5),
          radius * 0.65,
          (ripple * 0.6 + disperse * Math.cos(phase + seconds) * 0.6) *
            (1 - solid),
          0,
          Math.PI * 2,
        );
        ink.fill();
      }
      ink.globalAlpha = 1;
      if (colored) {
        context.globalAlpha = 1 - solid;
        context.drawImage(particleLayer, 0, 0, 600, 600);
        // Add premultiplied layers so the blend never dims or doubles its edges.
        context.globalCompositeOperation = "lighter";
        context.globalAlpha = solid;
        context.drawImage(logoLayer, 0, 0, 600, 600);
        context.globalCompositeOperation = "source-over";
        context.globalAlpha = 1;
      }
    };
    const tick = (now: number) => {
      if (disposed || !visible || document.hidden || paused || motion.matches) {
        frame = 0;
        return;
      }
      if (previous) elapsed += Math.min((now - previous) / 1000, 0.08);
      previous = now;
      const interval = 1000 / (colored && innerWidth > 768 ? 60 : 30);
      if (now - lastPaint >= interval) {
        paint(elapsed);
        lastPaint = now - ((now - lastPaint) % interval);
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (!particles.length) return;
      if (paused || motion.matches) paint(0, true);
      else if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 },
    );
    observer.observe(parent);
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const bounds = parent.getBoundingClientRect();
      aimX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 12;
      aimY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 12;
    };
    const leave = () => {
      aimX = aimY = 0;
    };
    parent.addEventListener("pointermove", pointer);
    parent.addEventListener("pointerleave", leave);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    getParticles()
      .then((artwork) => {
        if (disposed) return;
        particles = artwork.particles;
        logoContext.drawImage(artwork.image, 72, 72, 456, 456);
        parent.dataset.particlesReady = "true";
        paint(0, paused || motion.matches);
        sync();
      })
      .catch(() => {
        /* The official SVG stays visible if canvas cannot initialize. */
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      parent.removeEventListener("pointermove", pointer);
      parent.removeEventListener("pointerleave", leave);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [colored, paused]);
  return (
    <canvas ref={canvasRef} className="eq-particle-canvas" aria-hidden="true" />
  );
}
