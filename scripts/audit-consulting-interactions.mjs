import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5178';
const output = process.argv[3] || 'outputs/consulting-accessibility';
const routes = ['', '/work', '/practice', '/services', '/services/strategy', '/services/accessibility', '/services/workplace', '/leadership', '/partners', '/contact', '/insights', '/insights/disability-is-not-a-niche', '/insights/the-business-case', '/insights/employment-and-access'].map(p => '/consulting' + p);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, bypassCSP: true });
const checks = [];
function check(name, pass, detail) { checks.push({ name, pass, detail }); console.log(JSON.stringify(checks.at(-1))); }
const ready = async route => { await page.goto(base + route); await page.locator('.st h1').waitFor(); await page.evaluate(() => document.fonts.ready); };
await mkdir(output, { recursive: true });
try {
  await ready('/consulting');
  await page.locator('.skip-nav').focus();
  await page.keyboard.press('Enter');
  check('Skip link focuses main', await page.locator('main').evaluate(el => el === document.activeElement));
  const toggle = page.locator('.st-motion-toggle');
  await toggle.click();
  check('Motion pause is exposed', await toggle.getAttribute('aria-pressed') === 'true');
  await page.waitForTimeout(150);
  const frozenA = await page.locator('.st-hero canvas').evaluate(el => el.toDataURL());
  await page.waitForTimeout(200);
  check('Paused canvas stays still', frozenA === await page.locator('.st-hero canvas').evaluate(el => el.toDataURL()));
  await page.getByRole('navigation').getByRole('link', { name: 'Practice', exact: true }).click();
  await page.locator('.st h1').waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'main-content');
  check('Client navigation focuses main', true);
  check('Motion preference survives navigation', await toggle.getAttribute('aria-pressed') === 'true' && await page.evaluate(() => document.documentElement.classList.contains('st-paused')));
  await page.reload();
  await toggle.waitFor();
  check('Motion preference survives reload', await toggle.getAttribute('aria-pressed') === 'true');
  await toggle.click();
  check('Motion resumes', await toggle.getAttribute('aria-pressed') === 'false');
  const about = page.getByRole('button', { name: 'About us', exact: true });
  await about.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  check('About dropdown exposes keyboard links', await page.evaluate(() => document.activeElement?.getAttribute('href') === '/consulting/practice'));
  await page.keyboard.press('Escape');
  check('About Escape restores trigger', await about.evaluate(el => el === document.activeElement) && await about.getAttribute('aria-expanded') === 'false');
  await about.click();
  await page.getByRole('link', { name: 'Leadership', exact: true }).first().focus();
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  check('About closes when focus leaves', await about.getAttribute('aria-expanded') === 'false');
  await page.locator('.st-logo').focus(); await about.hover(); await page.keyboard.press('Escape');
  check('Hover-opened About menu can be dismissed with Escape', await about.getAttribute('aria-expanded') === 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.waitForTimeout(90);
  check('Mobile menu focus enters navigation', await page.locator('.st-navlinks').evaluate(el => el.contains(document.activeElement)));
  await page.keyboard.press('Shift+Tab');
  check('Mobile menu reverse Tab reaches close button', await page.getByRole('button', { name: 'Close menu', exact: true }).evaluate(el => el === document.activeElement));
  await page.keyboard.press('Tab');
  check('Mobile menu Tab wraps into navigation', await page.locator('.st-navlinks a').first().evaluate(el => el === document.activeElement));
  check('Mobile menu blocks background content', await page.locator('main').getAttribute('inert') !== null && await page.locator('footer').getAttribute('inert') !== null);
  await about.click(); await page.getByRole('link', { name: 'Leadership', exact: true }).first().focus(); await page.keyboard.press('Escape');
  check('Nested menu Escape closes only About', await about.getAttribute('aria-expanded') === 'false' && await page.getByRole('button', { name: 'Close menu', exact: true }).isVisible());
  await page.keyboard.press('Escape');
  check('Mobile Escape restores menu button', await page.getByRole('button', { name: 'Open menu', exact: true }).evaluate(el => el === document.activeElement));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('.st-motion-toggle')?.disabled);
  check('Device reduced motion disables resume', await toggle.isDisabled());
  await ready('/consulting/services');
  check('Reduced motion stops decorative animation', await page.locator('.st-art').first().evaluate(el => el.getAnimations({ subtree: true }).every(a => a.playState !== 'running' || a.effect?.getComputedTiming().duration === 0)));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await ready('/consulting');
  const card = page.locator('.st-service-card').first();
  await card.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(700);
  check('Service card has a visible keyboard focus ring', await card.evaluate(el => el === document.activeElement && el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
  check('Service title stays visible on keyboard focus', await card.locator('h3').evaluate(el => getComputedStyle(el).opacity === '1'));
  check('Service title and description do not overlap', await card.evaluate(el => { const h = el.querySelector('h3').getBoundingClientRect(), d = el.querySelector('.st-service-desc').getBoundingClientRect(); return h.bottom <= d.top + 1; }));
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const focusedViolations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice'] } })).violations.map(v => ({ id:v.id, targets:v.nodes.map(n => n.target) })));
  check('Focused service card axe scan', focusedViolations.length === 0, focusedViolations);
  await page.screenshot({ path: output + '/services-desktop.png' });
  await ready('/consulting/insights');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  check('Insight filtering announces result count', await page.getByRole('status').innerText() === '1 insights shown in Data.' && await page.locator('.st-insight-card').count() === 1);
  await ready('/consulting/contact');
  check('Required fields have visible labels', (await page.locator('input[required], textarea[required]').evaluateAll(fields => fields.every(el => el.labels?.[0]?.textContent.includes('required')))));
  await page.getByRole('button', { name: 'Prepare email', exact: true }).click();
  check('Empty contact form focuses invalid field', await page.locator('input[name="name"]').evaluate(el => el === document.activeElement && !el.validity.valid));
  await page.locator('input[name="email"]').fill('invalid');
  check('Contact email validates format', await page.locator('input[name="email"]').evaluate(el => el.validity.typeMismatch));
  // No valid submission: the form opens the user's external email application.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const layout = () => {
    const outside = [...document.querySelectorAll('.st h1, .st h2, .st h3, .st p, .st a, .st button, .st label')].filter(el => {
      if (!el.getClientRects().length || el.closest('[aria-hidden="true"], [inert], .st-art')) return false;
      const r = el.getBoundingClientRect();
      return r.left < -1 || r.right > innerWidth + 1;
    }).map(el => ({ element: el.className || el.tagName, text: el.textContent.trim().slice(0, 65) }));
    const nav = [...document.querySelectorAll('.st-header-inner > *, .st-navlinks > *')].filter(el => el.getClientRects().length);
    const overlap = nav.some((a,i) => nav.slice(i+1).some(b => { if (a.contains(b) || b.contains(a)) return false; const x=a.getBoundingClientRect(),y=b.getBoundingClientRect(); return x.left<y.right && y.left<x.right && x.top<y.bottom && y.top<x.bottom; }));
    return { overflow: document.documentElement.scrollWidth > innerWidth, outside, overlap };
  };
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await ready(route);
      await page.addStyleTag({ content: '.st * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .st p { margin-bottom: 2em !important; }' });
      const result = await page.evaluate(layout);
      check(`Text spacing ${width} ${route}`, !result.overflow && !result.outside.length && !result.overlap, result);
    }
  }
  for (const viewport of [{width:640,height:450},{width:320,height:225}]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await ready(route); const result = await page.evaluate(layout);
      check(`Zoom reflow ${viewport.width} ${route}`, !result.overflow && !result.outside.length && !result.overlap, result);
    }
  }
  await page.setViewportSize({width:320,height:900});
  await ready('/consulting/contact');
  await page.locator('.st-inquiry').scrollIntoViewIfNeeded();
  await page.screenshot({path:output+'/contact-mobile.png'});
  await page.goto(base + '/#intro');
  await page.locator('.eq-hero-sub').waitFor();
  check('Club hero decorative dot is removed', await page.locator('.eq-hero-sub > span').count() === 0);
} finally {
  await writeFile(output + '/interactions.json', JSON.stringify({base, checkedAt:new Date().toISOString(), checks}, null, 2));
  await browser.close();
}
process.exit(checks.some(c => !c.pass) ? 1 : 0);
