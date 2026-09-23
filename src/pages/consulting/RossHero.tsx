export function RossHero() {
  return (
    <div className="st-ross-hero" aria-hidden="true">
      <img
        className="st-hero-photo"
        alt=""
        src="/consulting/ross-overhead-1672.webp"
        srcSet="/consulting/ross-overhead-1080.webp 1080w, /consulting/ross-overhead-1672.webp 1672w"
        sizes="100vw"
        width={1672}
        height={941}
        fetchPriority="high"
        decoding="async"
      />
    </div>
  );
}
