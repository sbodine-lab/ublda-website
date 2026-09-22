/** Image-space animation for the existing 1672 × 941 Ross visualization. */
const sceneFunctions = `
uniform float u_sceneTime;
uniform float u_sceneBlend;
uniform float u_cropShift;

float rossCanopy(vec2 p, vec2 center, vec2 radius) {
  return 1. - smoothstep(.65, 1., length((p - center) / radius));
}
vec2 rossWindUV(vec2 uv) {
  vec2 p = uv * vec2(1672., 941.);
  float mask = rossCanopy(p, vec2(85., 180.), vec2(76., 180.));
  mask = max(mask, rossCanopy(p, vec2(75., 510.), vec2(95., 190.)));
  mask = max(mask, rossCanopy(p, vec2(422., 270.), vec2(54., 135.)));
  mask = max(mask, rossCanopy(p, vec2(610., 91.), vec2(178., 45.)));
  mask = max(mask, rossCanopy(p, vec2(899., 70.), vec2(48., 70.)));
  mask = max(mask, rossCanopy(p, vec2(1123., 25.), vec2(135., 35.)));
  mask = max(mask, rossCanopy(p, vec2(559., 525.), vec2(84., 77.)));
  mask = max(mask, rossCanopy(p, vec2(360., 680.), vec2(122., 60.)));
  mask = max(mask, rossCanopy(p, vec2(915., 930.), vec2(235., 59.)));
  mask = max(mask, rossCanopy(p, vec2(1560., 170.), vec2(68., 78.)));
  mask = max(mask, rossCanopy(p, vec2(1580., 320.), vec2(78., 79.)));
  mask = max(mask, rossCanopy(p, vec2(1585., 550.), vec2(84., 192.)));
  float phase = u_sceneTime * .58 + p.x * .014 + p.y * .009;
  vec2 wind = vec2(sin(phase) * 1.7 + sin(phase * .63) * .5, cos(phase * .81) * .9);
  return uv + mask * wind / vec2(1672., 941.);
}

float rossBox(vec2 p, vec2 halfSize, float radius) {
  vec2 d = abs(p) - halfSize + radius;
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - radius;
}
vec3 rossCar(vec3 background, vec2 p, float offset, float direction, vec2 sampleCenter) {
  // Cars travel on the clear lanes; the photographed curbside cars stay parked.
  float travel = mod(u_sceneTime * 19. + offset, 1500.);
  float distance = direction > 0. ? travel - 300. : 1200. - travel;
  float lane = direction > 0. ? 1461. : 1482.;
  float cornerY = direction > 0. ? 120. : 140.;
  vec2 center = vec2(lane, cornerY + distance);
  float angle = 0.;
  // A continuous, constant-speed arc turns into the sloped upper street.
  if (distance < 0.) {
    angle = min(-distance / 40., 1.729);
    center = vec2(lane + 40. - 40. * cos(angle), cornerY - 40. * sin(angle));
    center += max(0., -distance - 40. * 1.729) * vec2(sin(angle), -cos(angle));
  }
  vec2 delta = p - center;
  vec2 local = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * delta;
  if (abs(local.x) > 12. || abs(local.y) > 22.) return background;
  float shadow = 1. - smoothstep(-1., 3., rossBox(local - vec2(2., 2.), vec2(6.5, 14.), 3.));
  background *= 1. - shadow * .27;
  float body = 1. - smoothstep(-.6, .7, rossBox(local, vec2(5.8, 13.5), 2.8));
  vec2 source = (sampleCenter + local * vec2(1., direction)) / vec2(1672., 941.);
  vec3 car = texture(u_image, source).rgb;
  float printDot = 1. - smoothstep(.13, .36, length(fract(p / 3.2) - .5));
  car *= 1. - printDot * .13;
  return mix(background, car, body);
}
vec3 rossPerson(vec3 background, vec2 p, vec2 start, vec2 end, float offset, vec3 coat) {
  float phase = fract(u_sceneTime / 115. + offset);
  vec2 center = mix(start, end, phase);
  vec2 delta = p - center;
  if (length(delta) > 6.) return background;
  float fade = smoothstep(0., .045, phase) * (1. - smoothstep(.955, 1., phase));
  float shadow = 1. - smoothstep(.4, 2.4, length((delta - vec2(1.4, 2.)) / vec2(.8, 1.3)));
  background *= 1. - shadow * .35 * fade;
  float body = 1. - smoothstep(.5, 1.4, length(delta / vec2(1., 1.5)));
  background = mix(background, coat, body * fade);
  float head = 1. - smoothstep(.4, 1., length(delta - vec2(0., -.9)));
  return mix(background, vec3(.38, .29, .22), head * fade);
}
vec3 rossStreetLife(vec3 color, vec2 uv) {
  vec2 p = uv * vec2(1672., 941.);
  color = rossCar(color, p, 345., 1., vec2(1442., 528.));
  color = rossCar(color, p, 910., 1., vec2(1442., 579.));
  color = rossCar(color, p, 520., -1., vec2(1441., 233.));
  color = rossPerson(color, p, vec2(1411., 145.), vec2(1411., 830.), .16, vec3(.17,.23,.28));
  color = rossPerson(color, p, vec2(1400., 820.), vec2(1400., 145.), .54, vec3(.57,.35,.24));
  color = rossPerson(color, p, vec2(765., 850.), vec2(1190., 850.), .37, vec3(.17,.25,.35));
  color = rossPerson(color, p, vec2(1180., 865.), vec2(765., 865.), .82, vec3(.4,.37,.3));
  return color;
}
`;

/** Keep Paper's CMYK rendering, extending its image coordinates and final composite. */
export function createRossSceneShader(paperFragment: string) {
  const substitutions = [
    ["uniform float u_gridNoise;", "uniform float u_gridNoise;\nuniform vec2 u_ubldaGridDrift;"],
    ["void main() {", `${sceneFunctions}\nvoid main() {`],
    ["vec2 uv = v_imageUV;", "vec2 sceneUV = v_imageUV + vec2(u_cropShift, 0.);\n  vec2 uv = rossWindUV(sceneUV);"],
    ["vec2 uvGrid = (uv - .5) / pad;", "vec2 uvGrid = (uv - .5) / pad + u_ubldaGridDrift;"],
    ["return uvGrid * pad + 0.5;", "return (uvGrid - u_ubldaGridDrift) * pad + 0.5;"],
    ["fragColor = vec4(color, opacity);", "vec3 scene = mix(texture(u_image, uv).rgb, color, u_sceneBlend);\n  fragColor = vec4(rossStreetLife(scene, sceneUV), 1.);"],
  ];
  let fragment = paperFragment;
  for (const [source, replacement] of substitutions) {
    if (!fragment.includes(source)) throw new Error("Paper CMYK scene contract changed");
    fragment = fragment.replace(source, replacement);
  }
  return fragment;
}

export function rossSceneSpeed(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return 1 + 3 * clamped * clamped * (3 - 2 * clamped);
}
