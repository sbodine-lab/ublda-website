import { useEffect, useRef } from "react";
import type { ShaderMount } from "@paper-design/shaders";

/** The image stays visible if WebGL, the lazy module, or the texture fails. */
export function RossHero() {
  const image = useRef<HTMLImageElement>(null);
  const glass = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = glass.current;
    const photo = image.current;
    if (!host || !photo) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");
    let mount: ShaderMount | undefined;
    let disposed = false;
    let visible = false;
    let failed = false;
    let frame = 0;
    let elapsed = 0;
    let previous = 0;
    let painted = 0;

    // Fluted Glass has no time uniform. Animate its documented optical
    // controls through Paper's mount API, without React renders or image reloads.
    const tick = (now: number) => {
      elapsed += previous ? Math.min(now - previous, 100) : 0;
      previous = now;
      if (mount && now - painted >= 1000 / 30) {
        const wave = Math.sin(elapsed * Math.PI * 2 / 24000);
        mount.setUniforms({ u_shift: wave * 0.18, u_highlights: 0.10 + wave * 0.025 });
        painted = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      const active = !!mount && !failed && visible && !document.hidden &&
        !reduced.matches && !document.documentElement.classList.contains("st-paused");
      host.dataset.active = String(active);
      if (active) frame = requestAnimationFrame(tick);
    };
    const contextLost = () => {
      failed = true;
      host.dataset.ready = "false";
      sync();
    };
    const resize = () => mount?.setMaxPixelCount(mobile.matches ? 900_000 : 2_200_000);
    const textureChanged = async () => {
      try {
        await photo.decode();
        if (!disposed && !failed) mount?.setUniforms({ u_image: photo });
      } catch { /* The native image remains the fallback. */ }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(host);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("studio-motion", sync);
    reduced.addEventListener("change", sync);
    mobile.addEventListener("change", resize);
    photo.addEventListener("load", textureChanged);

    void (async () => {
      try {
        const [paper] = await Promise.all([import("@paper-design/shaders"), photo.decode()]);
        if (disposed) return;
        mount = new paper.ShaderMount(host, paper.flutedGlassFragmentShader, {
          u_image: photo,
          u_colorBack: paper.getShaderColorFromString("#0d1319"),
          u_colorShadow: paper.getShaderColorFromString("#000000"),
          u_colorHighlight: paper.getShaderColorFromString("#ffffff"),
          u_shadows: 0.18, u_highlights: 0.1,
          u_size: 0.68, u_shape: paper.GlassGridShapes.lines,
          u_distortionShape: paper.GlassDistortionShapes.prism,
          u_distortion: 0.025, u_shift: 0, u_angle: 0,
          u_blur: 0, u_edges: 0, u_stretch: 0,
          u_marginLeft: 0, u_marginRight: 0, u_marginTop: 0, u_marginBottom: 0,
          u_grainMixer: 0, u_grainOverlay: 0,
          u_fit: paper.ShaderFitOptions.cover, u_scale: 1,
          u_rotation: 0, u_offsetX: 0, u_offsetY: 0,
          u_originX: 0.5, u_originY: 0.5, u_worldWidth: 0, u_worldHeight: 0,
        }, { alpha: false, antialias: false }, 0, 0, 1,
        mobile.matches ? 900_000 : 2_200_000, ["u_image"]);
        mount.canvasElement.addEventListener("webglcontextlost", contextLost);
        host.dataset.ready = "true";
        sync();
      } catch {
        // WebGL is an enhancement; a failed mount must not obscure the hero.
        host.dataset.ready = "false";
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("studio-motion", sync);
      reduced.removeEventListener("change", sync);
      mobile.removeEventListener("change", resize);
      photo.removeEventListener("load", textureChanged);
      mount?.canvasElement.removeEventListener("webglcontextlost", contextLost);
      mount?.dispose();
      host.replaceChildren();
    };
  }, []);

  return (
    <div className="st-ross-hero" aria-hidden="true">
      <picture>
        <source media="(max-width: 767px)" srcSet="/consulting/ross-overhead-mobile.webp" />
        <img ref={image} className="st-hero-photo" alt=""
          src="/consulting/ross-overhead-1672.webp"
          srcSet="/consulting/ross-overhead-1080.webp 1080w, /consulting/ross-overhead-1672.webp 1672w"
          sizes="100vw" width={1672} height={941} fetchPriority="high" decoding="async" />
      </picture>
      <div ref={glass} className="st-ross-glass" />
    </div>
  );
}
