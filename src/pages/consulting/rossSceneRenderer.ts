import { carPosition, sceneCrop, traffic, trees, walks } from './rossSceneMotion'

const vertexSource = `
attribute vec2 position;
varying vec2 screenUV;
void main() { screenUV = vec2((position.x + 1.) * .5, (1. - position.y) * .5); gl_Position = vec4(position, 0., 1.); }
`
const fragmentSource = `
precision highp float;
varying vec2 screenUV;
uniform sampler2D photo;
uniform vec4 crop;
uniform float time;
uniform vec4 cars[${traffic.length}];
const vec2 imageSize = vec2(1672., 941.);

float canopy(vec2 p, vec4 tree) {
  return 1. - smoothstep(.35, 1., length((p - tree.xy) / tree.zw));
}
float foliage(vec3 color) {
  float light = max(max(color.r, color.g), .04);
  return smoothstep(.08, .23, (color.g - color.b) / light)
    * smoothstep(.68, .87, color.g / max(color.r, .03));
}
vec3 windPhoto(vec2 p) {
  vec3 original = texture2D(photo, p / imageSize).rgb;
  float mask = 0.;
  ${trees.map(t => `mask = max(mask, canopy(p, vec4(${t.map(n => n.toFixed(1)).join(',')})));`).join('\n  ')}
  // Large branches sway slowly; the smaller leaf movement has a different phase.
  float phase = time * 1.25 + p.x * .012 + p.y * .009;
  float gust = .7 + .3 * sin(time * .31);
  vec2 wind = vec2(sin(phase) * 2.7 + sin(time * 2.1 + p.y * .065) * .45,
                   cos(phase * .87) * 1.5 + sin(time * 1.7 + p.x * .06) * .3);
  vec2 offset = wind * gust * mask * foliage(original);
  vec3 moved = texture2D(photo, (p + offset) / imageSize).rgb;
  // Only foliage pixels move; roofs, curb lines and glass remain fixed.
  float safe = foliage(moved);
  return mix(original, moved, safe);
}
float box(vec2 p, vec2 size, float radius) {
  vec2 d = abs(p) - size + radius;
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - radius;
}
vec3 car(vec3 ground, vec2 p, vec4 pose, vec2 source) {
  vec2 delta = p - pose.xy;
  vec2 local = mat2(cos(pose.z), -sin(pose.z), sin(pose.z), cos(pose.z)) * delta;
  if (abs(local.x) > 14. || abs(local.y) > 23.) return ground;
  vec2 shadowLocal = mat2(cos(pose.z), -sin(pose.z), sin(pose.z), cos(pose.z)) * (delta - vec2(2.2, 2.8));
  float shadow = 1. - smoothstep(-1., 3., box(shadowLocal, vec2(6., 13.), 3.));
  ground *= 1. - shadow * .3;
  float body = 1. - smoothstep(-.45, .7, box(local, vec2(5.5, 13.), 2.7));
  // Use actual photographed vehicles, preserving windows, paint and reflections.
  vec3 paint = texture2D(photo, (source + local * vec2(pose.w, pose.w)) / imageSize).rgb;
  return mix(ground, paint, body);
}
vec3 walker(vec3 ground, vec2 p, vec2 start, vec2 end, float speed, float offset, vec3 coat) {
  vec2 forward = normalize(end - start);
  vec2 side = vec2(forward.y, -forward.x);
  float phase = fract(time * speed / length(end - start) + offset);
  // Fade only at route ends, mostly hidden by trees or the edge of the frame.
  float fade = smoothstep(0., .045, phase) * (1. - smoothstep(.955, 1., phase));
  float step = sin(time * 7.4 + offset * 29.);
  vec2 center = mix(start, end, phase) + side * step * .12;
  vec2 delta = p - center;
  if (length(delta) > 9.) return ground;
  vec2 local = vec2(dot(delta, side), -dot(delta, forward));
  float shadow = 1. - smoothstep(.5, 1.4, length((delta - vec2(1.9, 2.8)) / vec2(1.3, 2.4)));
  ground *= 1. - shadow * .36 * fade;
  float feet = min(length((local - vec2(-.6, .65 + step * .7)) / vec2(.42, .9)),
                   length((local - vec2(.6, .65 - step * .7)) / vec2(.42, .9)));
  ground = mix(ground, vec3(.13, .15, .16), (1. - smoothstep(.65, 1.2, feet)) * fade);
  float arms = min(length(local - vec2(-1.25, step * .5)), length(local - vec2(1.25, -step * .5)));
  ground = mix(ground, coat * .75, (1. - smoothstep(.35, .8, arms)) * fade);
  float body = 1. - smoothstep(.75, 1.2, length(local / vec2(1.25, 1.15)));
  ground = mix(ground, coat * (.93 + local.x * .08), body * fade);
  float head = 1. - smoothstep(.42, .9, length(local - vec2(0., -.8)));
  return mix(ground, vec3(.24, .19, .15), head * fade);
}
void main() {
  vec2 p = crop.xy + screenUV * crop.zw;
  vec3 ground = windPhoto(p);
  vec3 color = ground;
  ${traffic.map((c,i) => `color = car(color, p, cars[${i}], vec2(${c.source.map(n=>n.toFixed(1)).join(',')}));`).join('\n  ')}
  ${walks.map(w => `color = walker(color, p, vec2(${w.from.map(n=>n.toFixed(1)).join(',')}), vec2(${w.to.map(n=>n.toFixed(1)).join(',')}), ${w.speed.toFixed(2)}, ${w.phase.toFixed(2)}, vec3(${w.coat.join(',')}));`).join('\n  ')}
  // Trees occlude passing people, including their shadows.
  color = mix(color, ground, foliage(ground));
  gl_FragColor = vec4(color, 1.);
}
`

export function createRossSceneRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' })
  if (!gl) throw new Error('WebGL unavailable')
  const shaders: WebGLShader[] = []
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Scene compilation failed')
    return shader
  }
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Scene linking failed')
  gl.useProgram(program)
  const buffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
  const texture = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  const upload = () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  upload()
  const timeUniform = gl.getUniformLocation(program, 'time')
  const cropUniform = gl.getUniformLocation(program, 'crop')
  const carUniform = gl.getUniformLocation(program, 'cars[0]')
  const poses = new Float32Array(traffic.length * 4)
  return {
    upload,
    resize(width: number, height: number, mobile: boolean) {
      const ratio = Math.min(devicePixelRatio, mobile ? 1.5 : 1.25, Math.sqrt(2_200_000 / (width * height)))
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      gl.viewport(0, 0, canvas.width, canvas.height)
      const crop = sceneCrop(width, height, mobile)
      gl.uniform4f(cropUniform, crop.x, crop.y, crop.width, crop.height)
    },
    paint(seconds: number) {
      traffic.forEach((c, i) => {
        const pose = carPosition(seconds, c)
        poses.set([pose.x, pose.y, pose.angle, c.direction], i * 4)
      })
      gl.uniform1f(timeUniform, seconds)
      gl.uniform4fv(carUniform, poses)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    },
    dispose() {
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      shaders.forEach(shader => gl.deleteShader(shader))
      gl.deleteProgram(program)
    },
  }
}
