import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5192';
const output = process.argv[3] || 'outputs/public-performance-regressions';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__valueReads = 0;
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (...args) {
        if (this.matches('.eq-value-zone, .eq-ribbon-rail, .eq-ribbon-anchor')) window.__valueReads++;
        return original.apply(this, args);
      };
    });
    await page.goto(base + '/');
    await page.locator('main h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const initial = await page.evaluate(() => performance.getEntriesByType('resource').map(e => ({ path: new URL(e.name).pathname, bytes: e.encodedBodySize })));
    assert.equal(initial.some(e => /partners-|arc-thrift/.test(e.path)), false, 'lower-page logos must not compete with the opening screen');
    const marquee = page.locator('.eq-marquee');
    assert.equal(await marquee.locator(':scope > div').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
    await marquee.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.eq-marquee').dataset.active === 'true');
    await page.waitForFunction(() => [...document.querySelectorAll('.eq-marquee img')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await marquee.locator(':scope > div').evaluate(el => getComputedStyle(el).animationPlayState), 'running');
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.eq-marquee').dataset.active === 'false');
    await page.evaluate(() => { window.__valueReads = 0; });
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, i % 2 ? 180 : -180);
      await page.waitForTimeout(80);
    }
    const offscreenReads = await page.evaluate(() => window.__valueReads);
    assert.equal(offscreenReads, 0, 'offscreen value animations must not measure their panels on scroll');
    await page.locator('.eq-value-zone').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => Number(document.querySelector('.eq-ribbon-flight').style.opacity) === 1);
    await page.waitForFunction(() => Number(document.querySelector('.eq-ribbon-flight').dataset.progress) >= 0);
    const progress = await page.locator('.eq-ribbon-flight').getAttribute('data-progress');
    await page.locator('.eq-value-zone').last().scrollIntoViewIfNeeded();
    await page.waitForFunction(previous => document.querySelector('.eq-ribbon-flight').dataset.progress !== previous, progress);
    await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.eq-site').dataset.motionPaused === 'true');
    assert.equal(await marquee.locator(':scope > div').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
    await page.screenshot({ path: `${output}/club-${width}.png` });

    // Public URL variants must use the same page shell and retain query/fragment.
    for (const path of ['/about', '/events', '/team', '/join', '/brand', '/links', '/consulting', '/consulting/services/strategy']) {
      await page.goto(base + path.toUpperCase() + '/?source=audit#main-content');
      await page.waitForURL(url => url.pathname === path);
      await page.locator('main h1').waitFor();
      const url = new URL(page.url());
      assert.equal(url.search, '?source=audit');
      assert.equal(url.hash, '#main-content');
      assert.equal(await page.locator(path.startsWith('/consulting') ? '.st' : '.eq-site').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('#legacy-fonts').count(), 0);
    }
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto(base + '/consulting');
    await page.locator('main h1').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /dm-sans/.test(e.name)).map(e => ({ path: new URL(e.name).pathname, bytes: e.encodedBodySize })));
    assert.equal(fonts.length, 2);
    assert.ok(fonts.every(font => font.path.endsWith('.woff2') && font.bytes > 0));
    assert.ok(fonts.reduce((total, font) => total + font.bytes, 0) < 60000);
    await page.screenshot({ path: `${output}/consulting-${width}.png` });
    assert.deepEqual(errors, []);
    const report = { width, initialBytes: initial.reduce((total, entry) => total + entry.bytes, 0), initial, offscreenReads, canonicalRoutes: 8, fonts, errors };
    reports.push(report);
    console.log(JSON.stringify(report));
    await context.close();
  }
} finally {
  await writeFile(`${output}/checks.json`, JSON.stringify({ base, reports }, null, 2));
  await browser.close();
}
