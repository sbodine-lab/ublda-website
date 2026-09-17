// Original parametric artwork. Each state shares a topology so it can unfold
// continuously: an opening, joined paths, pages, a dialogue, and a bridge.
export const ribbonNames = ["inclusion", "shared", "learning", "listening", "community"];
export function ribbonPoint(stage: number, band: number, u: number, v: number): [number, number, number] {
  const t = u * Math.PI * 2;
  const b = band - 1;
  if (stage === 2) {
    const x = (u * 2 - 1) * 1.28;
    const fold = Math.abs(u * 2 - 1);
    return [x, -.45 + .65 * Math.pow(fold, .65) + b * .14 + .06 * v * v,
      v * .72 + .18 * Math.sin(fold * Math.PI) + b * .10 * fold];
  }
  const center = (p: number): [number, number, number] => {
    if (stage === 0) {
      const a = -.18 + p * (Math.PI + .36);
      const r = .97 + b * .19;
      return [Math.cos(a) * r, Math.sin(a) * r - .35, b * .12 + .16 * Math.sin(a * 2)];
    }
    if (stage === 1) {
      const a = p * Math.PI * 2;
      return [1.12 * Math.sin(a), .52 * Math.sin(a * 2) + b * .19, .38 * Math.cos(a) + b * .16];
    }
    if (stage === 3) {
      const side = band === 1 ? -1 : 1;
      const a = -.7 * Math.PI + p * 1.4 * Math.PI;
      return [side * (.35 + .63 * Math.cos(a)), .74 * Math.sin(a), b * .26 + .12 * Math.cos(a)];
    }
    const x = (p * 2 - 1) * 1.3;
    return [x, band === 1 ? -.42 : .65 * Math.sin(p * Math.PI) - .42,
      b * .42];
  };
  const c = center(u), before = center(u - .001), after = center(u + .001);
  const dx = after[0] - before[0], dy = after[1] - before[1];
  const length = Math.hypot(dx, dy) || 1;
  const width = stage === 3 ? .10 : .075;
  const twist = stage === 1 ? Math.sin(t + band * .6) * .65 : Math.sin(t * .5) * .2;
  return [c[0] - dy / length * v * width, c[1] + dx / length * v * width,
    c[2] + v * (.26 + twist * .12)];
}

export function ribbonSilhouette(stage: number, band: number) {
  const project = (u: number, v: number) => {
    const [x, y, z] = ribbonPoint(stage, band, u, v);
    return `${(150 + x * 87 + z * 20).toFixed(2)},${(154 - y * 87 + z * 29).toFixed(2)}`;
  };
  return `M${Array.from({ length: 81 }, (_, i) => project(i / 80, -1)).join("L")}L${Array.from({ length: 81 }, (_, i) => project(1 - i / 80, 1)).join("L")}Z`;
}
