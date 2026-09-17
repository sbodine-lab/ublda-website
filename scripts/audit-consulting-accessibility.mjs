import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:5178';
const output = process.argv[3] || 'outputs/consulting-accessibility';
const routes = ['', '/work', '/practice', '/services', '/services/strategy', '/services/accessibility', '/services/workplace', '/leadership', '/partners', '/contact', '/insights', '/insights/disability-is-not-a-niche', '/insights/the-business-case', '/insights/employment-and-access'].map(p => '/consulting' + p);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ reducedMotion: 'reduce', bypassCSP: true });
const reports = [], errors = [];
page.on('pageerror', e => errors.push({ url: page.url(), message: e.message }));
await mkdir(output, { recursive: true });
try {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(base + route);
      await page.locator('.st h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const result = await page.evaluate(async () => {
        const scan = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return {
          title: document.title, h1Count: document.querySelectorAll('h1').length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
          incomplete: scan.incomplete.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })),
        };
      });
      reports.push({ route, width, ...result });
      console.log(JSON.stringify({ route, width, violations: result.violations.map(v => v.id), overflow: result.overflow }));
    }
  }
} finally {
  await writeFile(output + '/automated.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), reports, errors }, null, 2));
  await browser.close();
}
process.exit(errors.length || reports.some(r => r.overflow || r.violations.length) ? 1 : 0);
