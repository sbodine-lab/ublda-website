// Original ribbon sculptures: people, shared purpose, learning, listening, care.
// Every form keeps three strips and the same vertex order for continuous morphs.
export const ribbonNames = [
  "inclusion",
  "shared",
  "learning",
  "listening",
  "community",
];
type Point = [number, number];
type Curve = [Point, Point, Point, Point];
const line = (a: Point, b: Point): Curve => [a, a, b, b];
const person: Curve[] = [
  [
    [0, 0.98],
    [0.45, 0.98],
    [0.46, 0.37],
    [0.19, 0.28],
  ],
  [
    [0.19, 0.28],
    [0.2, 0.16],
    [0.53, 0.17],
    [0.54, -0.34],
  ],
  [
    [0.54, -0.34],
    [0.55, -0.51],
    [-0.55, -0.51],
    [-0.54, -0.34],
  ],
  [
    [-0.54, -0.34],
    [-0.53, 0.17],
    [-0.2, 0.16],
    [-0.19, 0.28],
  ],
  [
    [-0.19, 0.28],
    [-0.46, 0.37],
    [-0.45, 0.98],
    [0, 0.98],
  ],
];
const book: Curve[] = [
  [
    [0, 0.57],
    [-0.35, 0.88],
    [-0.77, 0.87],
    [-1.13, 0.77],
  ],
  line([-1.13, 0.77], [-1.13, -0.62]),
  [
    [-1.13, -0.62],
    [-0.69, -0.5],
    [-0.31, -0.5],
    [0, -0.77],
  ],
  [
    [0, -0.77],
    [0.31, -0.5],
    [0.69, -0.5],
    [1.13, -0.62],
  ],
  line([1.13, -0.62], [1.13, 0.77]),
  [
    [1.13, 0.77],
    [0.77, 0.87],
    [0.35, 0.88],
    [0, 0.57],
  ],
  // Follow the center fold and return along it; a narrow taper avoids a cap.
  line([0, 0.57], [0, -0.77]),
  line([0, -0.77], [0, 0.57]),
];
// A listening ear: outer rim, inner fold, and an incoming sound wave.
// Each part remains a ribbon strip, so the sculpture shares the morph topology.
const earRim: Curve[] = [
  [
    [-0.68, 0.18],
    [-0.82, 1.24],
    [0.86, 1.35],
    [0.8, 0.38],
  ],
  [
    [0.8, 0.38],
    [0.81, -0.05],
    [0.36, -0.2],
    [0.25, -0.66],
  ],
  [
    [0.25, -0.66],
    [0.12, -1.22],
    [-0.62, -1.08],
    [-0.56, -0.55],
  ],
];
const earFold: Curve[] = [
  [
    [-0.3, 0.25],
    [-0.38, 0.91],
    [0.43, 0.89],
    [0.38, 0.3],
  ],
  [
    [0.38, 0.3],
    [0.36, -0.03],
    [-0.03, 0.07],
    [-0.08, -0.34],
  ],
];
const soundWave: Curve[] = [
  [
    [-1.03, 0.67],
    [-1.34, 0.27],
    [-1.35, -0.13],
    [-1.05, -0.53],
  ],
];
const heart: Curve[] = [
  [
    [0, 0.52],
    [-0.83, 1.42],
    [-1.78, 0.28],
    [0, -0.98],
  ],
  [
    [0, -0.98],
    [1.78, 0.28],
    [0.83, 1.42],
    [0, 0.52],
  ],
];
// Equal-distance samples prevent short edges from bunching up during a morph.
function sample(curves: Curve[]) {
  const points: Point[] = [],
    lengths: number[] = [];
  let total = 0;
  curves.forEach((curve) => {
    for (let i = 0; i < 80; i++) {
      const t = i / 80,
        q = 1 - t;
      const p: Point = [0, 1].map(
        (axis) =>
          q ** 3 * curve[0][axis] +
          3 * q * q * t * curve[1][axis] +
          3 * q * t * t * curve[2][axis] +
          t ** 3 * curve[3][axis],
      ) as Point;
      if (points.length)
        total += Math.hypot(p[0] - points.at(-1)![0], p[1] - points.at(-1)![1]);
      points.push(p);
      lengths.push(total);
    }
  });
  const last = curves.at(-1)![3];
  total += Math.hypot(last[0] - points.at(-1)![0], last[1] - points.at(-1)![1]);
  points.push(last);
  lengths.push(total);
  return (u: number): Point => {
    const distance = Math.max(0, Math.min(1, u)) * total;
    let low = 0,
      high = lengths.length - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (lengths[mid] < distance) low = mid;
      else high = mid;
    }
    const t = (distance - lengths[low]) / (lengths[high] - lengths[low] || 1);
    return [
      points[low][0] + (points[high][0] - points[low][0]) * t,
      points[low][1] + (points[high][1] - points[low][1]) * t,
    ];
  };
}
const outlines = [
  sample(person),
  undefined,
  sample(book),
  undefined,
  sample(heart),
];
const listeningParts = [sample(earRim), sample(earFold), sample(soundWave)];
export function ribbonPoint(
  stage: number,
  band: number,
  u: number,
  v: number,
): [number, number, number] {
  const b = band - 1,
    t = u * Math.PI * 2;
  const center = (p: number): [number, number, number] => {
    if (stage === 1) {
      const a = p * Math.PI * 2;
      // The infinity form Sam selected, including its original layered spacing.
      return [
        1.12 * Math.sin(a),
        0.52 * Math.sin(a * 2) + b * 0.19,
        0.38 * Math.cos(a) + b * 0.16,
      ];
    }
    if (stage === 3) {
      const [x, y] = listeningParts[band](p);
      return [x + 0.18, y, b * 0.12 + 0.08 * Math.sin(p * Math.PI)];
    }
    let [x, y] = outlines[stage]!(p);
    if (stage === 0) {
      const scale = band === 1 ? 0.9 : 0.72;
      x = x * scale + b * 0.83;
      y = y * scale - (band === 1 ? 0 : 0.16);
    }
    if (stage === 2) {
      x *= 1 - b * 0.035;
      y = y * 0.86 + b * 0.14;
    }
    if (stage === 4) {
      const scale = 1 - b * 0.17;
      x *= scale;
      y *= scale;
    }
    return [x, y, b * 0.16 + 0.06 * Math.sin(p * Math.PI * 2)];
  };
  const c = center(u),
    before = center(Math.max(0, u - 0.001)),
    after = center(Math.min(1, u + 0.001));
  const dx = after[0] - before[0],
    dy = after[1] - before[1],
    length = Math.hypot(dx, dy) || 1;
  const width =
    stage === 0 ? 0.046 : stage === 1 ? 0.075 : stage === 3 ? 0.065 : 0.04;
  const depth =
    stage === 1
      ? 0.26 + Math.sin(t + band * 0.6) * 0.078
      : stage === 0
        ? 0.1
        : 0.14;
  return [
    c[0] - (dy / length) * v * width,
    c[1] + (dx / length) * v * width,
    c[2] + v * depth,
  ];
}
export function ribbonSilhouette(stage: number, band: number) {
  const project = (u: number, v: number) => {
    const [x, y, z] = ribbonPoint(stage, band, u, v);
    return `${(150 + x * 87 + z * 20).toFixed(2)},${(154 - y * 87 + z * 29).toFixed(2)}`;
  };
  return `M${Array.from({ length: 161 }, (_, i) => project(i / 160, -1)).join("L")}L${Array.from({ length: 161 }, (_, i) => project(1 - i / 160, 1)).join("L")}Z`;
}
