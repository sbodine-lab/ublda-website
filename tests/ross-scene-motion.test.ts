import assert from 'node:assert/strict'
import test from 'node:test'
import { carPosition, sceneCrop, traffic } from '../src/pages/consulting/rossSceneMotion.ts'

test('traffic stays on the road and wraps outside the photographed scene', () => {
  for (const car of traffic) {
    let previous = carPosition(0, car)
    for (let t = .02; t < 130; t += .02) {
      const pose = carPosition(t, car)
      if (pose.y >= 150 && pose.y <= 941) {
        assert.ok(pose.x >= 1454 && pose.x <= 1490, 'traffic must clear parked cars and the sidewalk')
      }
      const step = Math.hypot(pose.x - previous.x, pose.y - previous.y)
      if (step > 2) {
        assert.ok(previous.x > 1690 || previous.y > 970, 'a car cannot disappear in view')
        assert.ok(pose.x > 1690 || pose.y > 970, 'a car cannot reappear in view')
      } else {
        assert.ok(Math.abs(step - car.speed * .02) < .01, 'speed should stay smooth through the corner')
      }
      previous = pose
    }
  }
})

test('the scene uses the photo crop in desktop, portrait and landscape layouts', () => {
  const whole = sceneCrop(1672, 941, false)
  assert.deepEqual(whole, { x: 0, y: 0, width: 1672, height: 941 })
  for (const [width, height, mobile] of [[390, 650, true], [1440, 810, false], [844, 320, false]] as const) {
    const crop = sceneCrop(width, height, mobile)
    assert.ok(Math.abs(crop.width / crop.height - width / height) < .00001)
    assert.ok(crop.x >= 0 && crop.y >= 0)
    assert.ok(crop.x + crop.width <= 1672.00001 && crop.y + crop.height <= 941.00001)
  }
  const phone = sceneCrop(390, 650, true)
  assert.ok(1482 >= phone.x && 1482 <= phone.x + phone.width, 'traffic must remain visible in the phone crop')
})
