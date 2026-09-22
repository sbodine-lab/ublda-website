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
// Constrain vehicle pixels (including their shadows) to the pictured pavement.
float rossRoadMask(vec2 p) {
  float vertical = max(max(1449. - p.x, p.x - 1494.), 80. - p.y);
  float upper = max(abs(p.y - (76. + (p.x - 1500.) * .168)) - 20., 1440. - p.x);
  return 1. - smoothstep(0., 1., min(vertical, upper));
}

vec3 rossCar(vec3 background, vec2 p, float offset, float direction, vec2 sampleCenter) {
  // Cars travel on the clear lanes; the photographed curbside cars stay parked.
  float travel = mod(u_sceneTime * 19. + offset, 1500.);
  float distance = direction > 0. ? travel - 300. : 1200. - travel;
  float lane = direction > 0. ? 1461. : 1482.;
  float cornerY = direction > 0. ? 108. : 127.;
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
  vec2 forward = normalize(end - start);
  vec2 side = vec2(forward.y, -forward.x);
  float phase = fract(u_sceneTime * 5.5 / length(end - start) + offset);
  float step = sin(u_sceneTime * 8. + offset * 23.);
  vec2 center = mix(start, end, phase) + side * step * .25;
  vec2 delta = p - center;
  if (length(delta) > 8.) return background;
  float fade = smoothstep(0., .025, phase) * (1. - smoothstep(.975, 1., phase));
  float shadow = 1. - smoothstep(.5, 2.5, length((delta - vec2(2., 3.)) / vec2(.9, 1.5)));
  background *= 1. - shadow * .46 * fade;
  // Orient each walker along the path, with alternating feet and arm swing.
  vec2 local = vec2(dot(delta, side), -dot(delta, forward));
  float leftFoot = length((local - vec2(-.7, 2. + step * .6)) / vec2(.65, 1.));
  float rightFoot = length((local - vec2(.7, 2. - step * .6)) / vec2(.65, 1.));
  float feet = 1. - smoothstep(.55, 1.1, min(leftFoot, rightFoot));
  background = mix(background, vec3(.13, .16, .18), feet * fade);
  float arms = min(length(local - vec2(-1.7, step * .7)), length(local - vec2(1.7, -step * .7)));
  background = mix(background, coat * .85, (1. - smoothstep(.45, .95, arms)) * fade);
  float body = 1. - smoothstep(.75, 1.25, length(local / vec2(1.5, 1.65)));
  background = mix(background, coat, body * fade);
  float head = 1. - smoothstep(.65, 1.25, length(local - vec2(0., -1.35)));
  return mix(background, vec3(.49, .36, .26), head * fade);
}

vec3 rossStreetLife(vec3 color, vec2 uv) {
  vec2 p = uv * vec2(1672., 941.);
  vec3 ground = color;
  // Five evenly spaced vehicles in each direction keep the street active.
  color = rossCar(color, p, 15., 1., vec2(1442., 579.));
  color = rossCar(color, p, 315., 1., vec2(1442., 528.));
  color = rossCar(color, p, 615., 1., vec2(1441., 233.));
  color = rossCar(color, p, 915., 1., vec2(1442., 579.));
  color = rossCar(color, p, 1215., 1., vec2(1441., 233.));
  color = rossCar(color, p, 150., -1., vec2(1441., 233.));
  color = rossCar(color, p, 450., -1., vec2(1442., 579.));
  color = rossCar(color, p, 750., -1., vec2(1442., 528.));
  color = rossCar(color, p, 1050., -1., vec2(1442., 579.));
  color = rossCar(color, p, 1350., -1., vec2(1441., 233.));
  color = mix(ground, color, rossRoadMask(p));
  // Walkers stay on the east sidewalk and the broad southern entrance paths.
  color = rossPerson(color, p, vec2(1411., 145.), vec2(1411., 830.), .16, vec3(.17,.23,.28));
  color = rossPerson(color, p, vec2(1411., 145.), vec2(1411., 830.), .47, vec3(.74,.43,.19));
  color = rossPerson(color, p, vec2(1411., 145.), vec2(1411., 830.), .79, vec3(.24,.39,.48));
  color = rossPerson(color, p, vec2(1400., 820.), vec2(1400., 145.), .21, vec3(.65,.34,.25));
  color = rossPerson(color, p, vec2(1400., 820.), vec2(1400., 145.), .54, vec3(.17,.24,.31));
  color = rossPerson(color, p, vec2(1400., 820.), vec2(1400., 145.), .87, vec3(.66,.59,.43));
  color = rossPerson(color, p, vec2(765., 850.), vec2(1190., 850.), .07, vec3(.54,.29,.21));
  color = rossPerson(color, p, vec2(765., 850.), vec2(1190., 850.), .37, vec3(.17,.25,.35));
  color = rossPerson(color, p, vec2(765., 850.), vec2(1190., 850.), .71, vec3(.70,.53,.25));
  color = rossPerson(color, p, vec2(1180., 865.), vec2(765., 865.), .18, vec3(.23,.38,.36));
  color = rossPerson(color, p, vec2(1180., 865.), vec2(765., 865.), .50, vec3(.17,.23,.28));
  color = rossPerson(color, p, vec2(1180., 865.), vec2(765., 865.), .82, vec3(.58,.35,.26));
  // Activity on the west paths, plaza, and courtyard balances the east street.
  color = rossPerson(color, p, vec2(152., 333.), vec2(152., 428.), .22, vec3(.66,.39,.20));
  color = rossPerson(color, p, vec2(158., 428.), vec2(158., 333.), .68, vec3(.17,.25,.35));
  color = rossPerson(color, p, vec2(84., 421.), vec2(220., 421.), .15, vec3(.20,.32,.39));
  color = rossPerson(color, p, vec2(220., 429.), vec2(84., 429.), .64, vec3(.64,.32,.22));
  color = rossPerson(color, p, vec2(119., 579.), vec2(119., 649.), .26, vec3(.19,.29,.35));
  color = rossPerson(color, p, vec2(125., 649.), vec2(125., 579.), .73, vec3(.70,.49,.22));
  color = rossPerson(color, p, vec2(93., 605.), vec2(185., 605.), .17, vec3(.55,.28,.22));
  color = rossPerson(color, p, vec2(185., 613.), vec2(93., 613.), .62, vec3(.16,.25,.32));
  color = rossPerson(color, p, vec2(702., 522.), vec2(702., 698.), .24, vec3(.65,.44,.24));
  color = rossPerson(color, p, vec2(709., 698.), vec2(709., 522.), .70, vec3(.17,.24,.31));
  color = rossPerson(color, p, vec2(596., 694.), vec2(717., 694.), .18, vec3(.20,.34,.39));
  color = rossPerson(color, p, vec2(717., 702.), vec2(596., 702.), .63, vec3(.59,.32,.23));
  if (distance(color, ground) < .0001) return ground;
  // Sample the animated source canopy, before CMYK tinting, to occlude street
  // activity beneath green/gold leaves. This follows each branch as it sways.
  vec3 source = texture(u_image, rossWindUV(uv)).rgb;
  float brightness = max(max(source.r, source.g), max(source.b, .04));
  float foliage = smoothstep(.035, .10, (source.g - source.b) / brightness)
    * smoothstep(.62, .84, source.g / max(source.r, .03));
  return mix(color, ground, foliage);
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
