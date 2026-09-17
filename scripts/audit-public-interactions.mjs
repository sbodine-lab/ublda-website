import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:5178';
const output = process.argv[3] || 'outputs/accessibility';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, bypassCSP: true });
const checks = [];
const check = (name, pass, detail) => { checks.push({ name, pass, detail }); console.log(JSON.stringify(checks.at(-1))); };
await mkdir(output, { recursive: true });
try {
  await page.goto(base + '/');
  await page.getByRole('button', { name: 'Pause animations', exact: true }).waitFor();
  await page.keyboard.press('Tab');
  check('Skip link is first in keyboard order', await page.locator('.eq-skip').evaluate(el => el === document.activeElement));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'main-content');
  check('Skip link transfers focus to main', await page.evaluate(() => document.activeElement.id === 'main-content'));
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  await page.waitForTimeout(400);
  const canvas = page.locator('.eq-logo-stage canvas');
  const still = await canvas.evaluate(el => el.toDataURL());
  await page.waitForTimeout(300);
  check('Pause stops canvas and CSS animation', still === await canvas.evaluate(el => el.toDataURL()) && await page.evaluate(() => document.getAnimations().every(a => a.playState !== 'running')));
  await page.reload();
  check('Motion preference persists', await page.getByRole('button', { name: 'Resume animations', exact: true }).getAttribute('aria-pressed') === 'true');
  await page.getByRole('button', { name: 'Resume animations', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  check('Device reduced motion is respected', await page.getByRole('button', { name: 'Animations paused by device preference', exact: true }).isDisabled());

  await page.goto(base + '/events');
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  check('Menu excludes background from keyboard and assistive navigation', await page.locator('main').evaluate(el => el.inert));
  await page.keyboard.press('Escape');
  check('Escape restores menu trigger focus', await page.getByRole('button', { name: 'Open menu', exact: true }).evaluate(el => el === document.activeElement) && !(await page.locator('main').evaluate(el => el.inert)));
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Team', exact: true }).click();
  await page.waitForURL('**/team');
  await page.waitForFunction(() => document.activeElement.id === 'main-content');
  check('Client navigation transfers focus to main', await page.locator('main').evaluate(el => el === document.activeElement));
  const person = page.getByRole('button', { name: 'Sam Bodine Co-President', exact: true });
  await person.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Sam Bodine' });
  check('Team profile opens a named modal with focus inside', await dialog.isVisible() && await dialog.evaluate(el => el.contains(document.activeElement)));
  await page.keyboard.press('Tab');
  check('Profile LinkedIn is keyboard reachable', await page.getByRole('link', { name: 'Sam Bodine on LinkedIn' }).evaluate(el => el === document.activeElement));
  await page.keyboard.press('Escape');
  check('Profile Escape restores its trigger', await person.evaluate(el => el === document.activeElement) && !(await dialog.isVisible()));

  await page.goto(base + '/#capabilities');
  const program = page.getByRole('button', { name: 'Speaker conversations', exact: true });
  await program.click();
  check('Program accordion exposes its details', await program.getAttribute('aria-expanded') === 'true' && !(await page.locator('#program-0').evaluate(el => el.inert)));
  await page.getByRole('button', { name: 'A conversation with Microsoft', exact: true }).click();
  check('Community card details remain inside their card', await page.locator('.eq-story-card.is-open').evaluate(el => { const card = el.getBoundingClientRect(); const text = el.querySelector('.eq-card-detail').getBoundingClientRect(); return text.bottom <= card.bottom + 1; }));
  for (let i = 0; i < 3; i++) { await page.getByRole('button', { name: 'Next story', exact: true }).click(); await page.waitForTimeout(100); }
  check('Carousel works without dragging', await page.getByRole('button', { name: 'Next story', exact: true }).isDisabled());

  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/about', '/events', '/team', '/join', '/brand', '/links', '/unsubscribe']) {
      await page.goto(base + route);
      await page.locator('.eq-site h1').waitFor();
      await page.addStyleTag({ content: '.eq-site * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .eq-site p { margin-bottom: 2em !important; }' });
      if (route === '/') await page.locator('#intro').scrollIntoViewIfNeeded();
      const result = await page.evaluate(() => {
        const header = document.querySelector('.eq-header');
        const controls = [...header.querySelectorAll('a,button')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
        const boxes = controls.map(el => ({ label: el.textContent || el.getAttribute('aria-label'), r: el.getBoundingClientRect() }));
        return { overflow: document.documentElement.scrollWidth > innerWidth, headerOverlap: boxes.some((a, i) => boxes.slice(i + 1).some(b => a.r.left < b.r.right && b.r.left < a.r.right && a.r.top < b.r.bottom && b.r.top < a.r.bottom)) };
      });
      check(`Text spacing ${width}px ${route}`, !result.overflow && !result.headerOverlap, result);
    }
  }
  for (const viewport of [{ width: 640, height: 450 }, { width: 320, height: 225 }]) {
    await page.setViewportSize(viewport);
    for (const route of ['/', '/about', '/events', '/team', '/join', '/brand', '/links', '/unsubscribe']) {
      await page.goto(base + route);
      await page.locator('.eq-site h1').waitFor();
      check(`Zoom reflow ${viewport.width}x${viewport.height} ${route}`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(base + '/events#past-events');
  await page.locator('.eq-event-recap summary').first().focus();
  await page.keyboard.press('Enter');
  check('Event recap works with keyboard', await page.locator('.eq-event-recap').first().evaluate(el => el.open));
  await page.screenshot({ path: output + '/mobile-event-recap.png' });
} finally {
  await writeFile(output + '/interactions.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), checks }, null, 2));
  await browser.close();
}
if (checks.some(result => !result.pass)) process.exitCode = 1;
