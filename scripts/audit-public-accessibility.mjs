import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:5178';
const output = process.argv[3] || 'outputs/accessibility';
const routes = ['/', '/about', '/events', '/team', '/join', '/brand', '/links', '/unsubscribe', '/consulting', '/consulting/practice', '/consulting/leadership', '/consulting/contact'];
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
// Instrumentation only: production CSP is kept unchanged.
const page = await browser.newPage({ reducedMotion: 'reduce', bypassCSP: true });
const errors = [];
const reports = [];
page.on('pageerror', error => errors.push({ url: page.url(), message: error.message }));
await mkdir(output, { recursive: true });
try {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(base + route);
      await page.locator('h1').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const result = await page.evaluate(async () => {
        const axe = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return {
          title: document.title,
          h1Count: document.querySelectorAll('h1').length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
          incomplete: axe.incomplete.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })),
        };
      });
      reports.push({ route, width, ...result });
      console.log(JSON.stringify({ route, width, overflow: result.overflow, violations: result.violations.map(v => v.id) }));
    }
  }
} finally {
  await writeFile(path.join(output, 'automated.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), reports, errors }, null, 2));
  await browser.close();
}
if (errors.length || reports.some(r => r.overflow || r.violations.length)) process.exitCode = 1;
