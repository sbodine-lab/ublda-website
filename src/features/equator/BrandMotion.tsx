import logoSource from "../../../public/logo-mark.svg?raw";
import { ParticleLogo } from "./ParticleLogo";

const logoPaths =
  logoSource.match(/<path[\s\S]*?<\/svg>/)?.[0].replace("</svg>", "") || "";

export function AnimatedMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`eq-mark ${className}`}
      viewBox="275 285 460 460"
      role="img"
      aria-label="UBLDA logo"
    >
      <g dangerouslySetInnerHTML={{ __html: logoPaths }} />
    </svg>
  );
}

/** White, feather-like particles flow between the official mark and a wave. */
export function BrandParticles({ closing = false }: { closing?: boolean }) {
  return (
    <div
      className={`eq-brand-particles ${closing ? "eq-brand-particles--closing" : ""}`}
      aria-hidden="true"
    >
      <div className="eq-particle-static">
        <AnimatedMark />
      </div>
      <ParticleLogo />
    </div>
  );
}

export function LogoStage() {
  return (
    <div className="eq-logo-stage" role="img" aria-label="UBLDA logo">
      <div className="eq-particle-static" aria-hidden="true">
        <AnimatedMark />
      </div>
      <ParticleLogo colored />
    </div>
  );
}

export { RibbonAnchor as Glyph } from "./RibbonJourney";

export function StoryArtwork({ kind }: { kind: string }) {
  return (
    <div className={`eq-story-art eq-story-art--${kind}`} aria-hidden="true">
      {kind === "arc" && (
        <>
          <div className="eq-art-partner">
            <img src="/consulting/logos/arc-thrift.svg" alt="" />
          </div>
          <div className="eq-art-blocks">
            <i />
            <i />
            <i />
          </div>
        </>
      )}
      {kind === "blda" && (
        <>
          <div className="eq-art-connection">
            <div>
              <AnimatedMark />
              <span>UBLDA</span>
            </div>
            <span className="eq-art-plus">+</span>
            <div>
              <img src="/partners-blda.webp" alt="" />
              <span>BLDA</span>
            </div>
          </div>
        </>
      )}
      {kind === "conversations" && (
        <>
          <div className="eq-art-conversations">
            <span>
              Lloyd Lewis<small>Arc Thrift Stores</small>
            </span>
            <span>
              Andrew Parker<small>Nestidd</small>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
