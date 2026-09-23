/** All positions use the original aerial photograph's 1672 × 941 coordinates. */
export const ROSS_IMAGE = { width: 1672, height: 941 }

export const trees = [
  [90, 75, 70, 102], [34, 210, 53, 88], [69, 352, 88, 100],
  [106, 477, 70, 82], [30, 591, 52, 105],
  [415, 221, 52, 132], [490, 105, 86, 43], [652, 99, 69, 45],
  [901, 68, 70, 85], [1087, 26, 109, 53],
  [550, 522, 84, 91], [318, 664, 87, 69], [469, 733, 67, 110],
  [602, 724, 93, 38], [924, 926, 204, 58], [1335, 933, 100, 44],
  [1509, 167, 49, 63], [1537, 319, 83, 72], [1586, 501, 82, 100],
  [1589, 642, 77, 105], [1512, 837, 55, 63],
] as const

export const traffic = [
  { direction: 1, phase: 75, speed: 24, source: [1442, 579] },
  { direction: 1, phase: 730, speed: 24, source: [1442, 528] },
  { direction: -1, phase: 390, speed: 27, source: [1441, 233] },
  { direction: -1, phase: 1040, speed: 27, source: [1442, 579] },
] as const

const cornerRadius = 42
const cornerAngle = 1.729
const loopDistance = 1460

/** Cars enter and leave outside the photograph; the corner is a tangent arc. */
export function carPosition(seconds: number, car: (typeof traffic)[number]) {
  const travel = ((seconds * car.speed + car.phase) % loopDistance + loopDistance) % loopDistance
  const distance = car.direction > 0 ? travel - 390 : 1070 - travel
  const lane = car.direction > 0 ? 1462 : 1482
  const corner = car.direction > 0 ? 111 : 133
  if (distance >= 0) return { x: lane, y: corner + distance, angle: 0 }
  const angle = Math.min(-distance / cornerRadius, cornerAngle)
  const extension = Math.max(0, -distance - cornerRadius * cornerAngle)
  return {
    x: lane + cornerRadius * (1 - Math.cos(angle)) + extension * Math.sin(angle),
    y: corner - cornerRadius * Math.sin(angle) - extension * Math.cos(angle),
    angle,
  }
}

// Pavement only: east sidewalk, southern entrance plaza and courtyard path.
export const walks = [
  { from: [1413, 103], to: [1413, 896], speed: 6.2, phase: .17, coat: [.24, .33, .38] },
  { from: [1404, 903], to: [1404, 106], speed: 5.4, phase: .62, coat: [.69, .48, .29] },
  { from: [1415, 104], to: [1415, 895], speed: 6.2, phase: .73, coat: [.51, .25, .2] },
  { from: [1404, 900], to: [1404, 108], speed: 5.9, phase: .12, coat: [.2, .26, .34] },
  { from: [774, 865], to: [1201, 865], speed: 5.7, phase: .12, coat: [.26, .33, .4] },
  { from: [1200, 857], to: [777, 857], speed: 6.4, phase: .28, coat: [.62, .39, .25] },
  { from: [775, 867], to: [1200, 867], speed: 5.7, phase: .69, coat: [.6, .57, .48] },
  { from: [1258, 902], to: [1400, 902], speed: 5.3, phase: .2, coat: [.45, .25, .24] },
  { from: [1396, 892], to: [1215, 892], speed: 5.8, phase: .61, coat: [.22, .35, .36] },
  { from: [701, 519], to: [701, 695], speed: 5.1, phase: .27, coat: [.62, .43, .29] },
  { from: [706, 693], to: [706, 519], speed: 5.8, phase: .38, coat: [.2, .25, .3] },
  { from: [585, 696], to: [700, 696], speed: 5.2, phase: .54, coat: [.29, .38, .47] },
] as const

/** Match the photograph's CSS object-fit: cover and mobile object-position. */
export function sceneCrop(width: number, height: number, mobile: boolean) {
  const scale = Math.max(width / ROSS_IMAGE.width, height / ROSS_IMAGE.height)
  const visibleWidth = width / scale
  const visibleHeight = height / scale
  return {
    x: (ROSS_IMAGE.width - visibleWidth) * (mobile ? .88 : .5),
    y: (ROSS_IMAGE.height - visibleHeight) * .5,
    width: visibleWidth,
    height: visibleHeight,
  }
}
