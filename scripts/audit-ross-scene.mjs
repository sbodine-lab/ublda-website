import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const base = process.env.BASE_URL || 'http://127.0.0.1:5173'
const output = process.env.OUTPUT_DIR || '/private/tmp/ross-scene-qa'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/consulting`, { waitUntil: 'networkidle' })
    const canvas = page.locator('.st-ross-scene')
    await page.waitForFunction(() => document.querySelector('.st-ross-scene')?.dataset.active === 'true')
    await page.evaluate(() => {
      window.sceneFrames = 0
      window.sceneObserver = new MutationObserver(records => { window.sceneFrames += records.filter(record => record.attributeName === 'data-time').length })
      window.sceneObserver.observe(document.querySelector('.st-ross-scene'), { attributes: true })
    })
    const start = Number(await canvas.getAttribute('data-time'))
    await page.waitForTimeout(3000)
    const elapsed = Number(await canvas.getAttribute('data-time')) - start
    const frames = await page.evaluate(() => { window.sceneObserver.disconnect(); return window.sceneFrames })
    assert.ok(elapsed > 2, 'scene time must advance naturally')
    assert.ok(frames > 45, `animation must paint smoothly: ${frames} frames in 3 seconds`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await page.screenshot({ path: `${output}/hero-${width}.png` })
    await page.getByRole('button', { name: 'Pause motion', exact: true }).first().click()
    await page.waitForFunction(() => document.querySelector('.st-ross-scene')?.dataset.active === 'false')
    const paused = await canvas.getAttribute('data-time')
    await page.waitForTimeout(350)
    assert.equal(await canvas.getAttribute('data-time'), paused, 'pause must freeze the scene')
    await page.getByRole('button', { name: 'Resume motion', exact: true }).first().click()
    await page.waitForFunction(() => document.querySelector('.st-ross-scene')?.dataset.active === 'true')
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForFunction(() => document.querySelector('.st-ross-scene')?.dataset.active === 'false')
    const hidden = await canvas.getAttribute('data-time')
    await page.waitForTimeout(350)
    assert.equal(await canvas.getAttribute('data-time'), hidden, 'offscreen scene must stop')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForFunction(() => document.querySelector('.st-ross-scene')?.dataset.active === 'true')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(() => { const canvas = document.querySelector('.st-ross-scene'); return getComputedStyle(canvas).display === 'none' && canvas.dataset.active === 'false' })
    assert.equal(await canvas.getAttribute('data-active'), 'false')
    assert.equal(await page.locator('.st-hero-photo').evaluate(image => image.complete && image.naturalWidth > 0), true)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.waitForFunction(() => document.querySelector('.st-ross-scene')?.dataset.active === 'true')
    if (width === 390) {
      await page.setViewportSize({ width: 844, height: 390 })
      await page.waitForTimeout(500)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: `${output}/hero-landscape.png` })
    }
    await canvas.evaluate(canvas => canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext())
    await page.waitForFunction(() => document.querySelector('.st-ross-scene')?.dataset.ready === 'false')
    assert.equal(await canvas.getAttribute('data-active'), 'false')
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ width, framesInThreeSeconds: frames, elapsed, pause: 'passed', offscreen: 'passed', reducedMotion: 'passed', webglFallback: 'passed', errors }))
    await page.close()
  }
  const reduced = await browser.newPage({ reducedMotion: 'reduce' })
  const requests = []
  reduced.on('request', request => requests.push(request.url()))
  await reduced.goto(`${base}/consulting`, { waitUntil: 'networkidle' })
  assert.equal(await reduced.locator('.st-hero-photo').evaluate(image => image.complete && image.naturalWidth > 0), true)
  assert.equal(requests.some(url => /rossSceneRenderer/.test(url)), false, 'reduced motion must skip the renderer download')
  console.log('Initial reduced-motion photo and renderer-download avoidance passed.')
  await reduced.close()
} finally {
  await browser.close()
}
