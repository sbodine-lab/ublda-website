import { useEffect, useRef } from "react";
import type { ShaderMount } from "@paper-design/shaders";

/** The image stays visible if WebGL, the lazy module, or the texture fails. */
export function RossHero() {
  const image = useRef<HTMLImageElement>(null);
  const shader = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = shader.current;
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

    // Drift the printing grid over the stationary image in a slow 48-second orbit.
    // Paper's mount API updates uniforms without rebuilding or reloading textures.
    const tick = (now: number) => {
      elapsed += previous ? Math.min(now - previous, 100) : 0;
      previous = now;
      if (mount && now - painted >= 1000 / 30) {
        const phase = elapsed * Math.PI * 2 / 48000;
        const wave = Math.sin(phase);
        mount.setUniforms({
          u_ubldaGridDrift: [Math.sin(phase) * 8, (Math.cos(phase) - 1) * 5],
          u_gainC: 0.12 + wave * 0.06, u_gainM: -wave * 0.04,
        });
        host.style.setProperty("--st-halftone-opacity", String(0.52 + wave * 0.06));
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
        const noise = paper.getShaderNoiseTexture();
        await noise?.decode();
        if (disposed) return;
        // Paper 0.0.80 exposes no CMYK grid-position control. Extend only its
        // grid coordinates, then undo that offset when sampling the image so
        // Ross remains aligned with the native-image layer underneath.
        const substitutions = [
          ["uniform float u_gridNoise;", "uniform float u_gridNoise;\nuniform vec2 u_ubldaGridDrift;"],
          ["vec2 uvGrid = (uv - .5) / pad;", "vec2 uvGrid = (uv - .5) / pad + u_ubldaGridDrift;"],
          ["return uvGrid * pad + 0.5;", "return (uvGrid - u_ubldaGridDrift) * pad + 0.5;"],
        ];
        let fragment = paper.halftoneCmykFragmentShader;
        for (const [source, replacement] of substitutions) {
          if (!fragment.includes(source)) throw new Error("Paper CMYK grid contract changed");
          fragment = fragment.replace(source, replacement);
        }
        mount = new paper.ShaderMount(host, fragment, {
          u_ubldaGridDrift: [0, 0],
          u_image: photo,
          u_noiseTexture: noise,
          u_colorBack: paper.getShaderColorFromString("#f8f7f3"),
          u_colorC: paper.getShaderColorFromString("#00b4ff"),
          u_colorM: paper.getShaderColorFromString("#fc519f"),
          u_colorY: paper.getShaderColorFromString("#ffd800"),
          u_colorK: paper.getShaderColorFromString("#0d1319"),
          u_size: 0.18, u_type: paper.HalftoneCmykTypes.ink,
          u_contrast: 1, u_softness: 0.85, u_gridNoise: 0.14,
          u_grainSize: 0.5, u_grainMixer: 0, u_grainOverlay: 0.01,
          u_floodC: 0.04, u_floodM: 0, u_floodY: 0, u_floodK: 0,
          u_gainC: 0.12, u_gainM: 0, u_gainY: 0.08, u_gainK: -0.04,
          u_fit: paper.ShaderFitOptions.cover, u_scale: 1,
          u_rotation: 0, u_offsetX: 0, u_offsetY: 0,
          u_originX: 0.5, u_originY: 0.5, u_worldWidth: 0, u_worldHeight: 0,
        }, { alpha: false, antialias: false }, 0, 0, 1,
        mobile.matches ? 900_000 : 2_200_000);
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
      <div ref={shader} className="st-ross-shader" />
    </div>
  );
}
