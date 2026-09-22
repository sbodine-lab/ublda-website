import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://127.0.0.1:5178';
const output = process.argv[3] || 'outputs/consulting-accessibility';
const routes = ['', '/work', '/practice', '/services', '/services/strategy', '/services/accessibility', '/services/workplace', '/leadership', '/partners', '/contact', '/insights', '/insights/disability-is-not-a-niche', '/insights/the-business-case', '/insights/employment-and-access', '/insights/disability-in-the-workforce', '/insights/accommodations-and-retention'].map(p => '/consulting' + p);
const selectedRoutes = process.argv[4] ? routes.filter(route => route === process.argv[4]) : routes;
if (!selectedRoutes.length) throw new Error('Unknown consulting route');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ reducedMotion: 'reduce', bypassCSP: true });
const reports = [], errors = [];
page.on('pageerror', e => errors.push({ url: page.url(), message: e.message }));
await mkdir(output, { recursive: true });
try {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of selectedRoutes) {
      await page.goto(base + route);
      await page.locator('.st h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
      const result = await page.evaluate(async () => {
        const scan = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return {
          title: document.title, h1Count: document.querySelectorAll('h1').length,
          overflow: document.documentElement.scrollWidth > innerWidth,
          outsideViewport: [...document.querySelectorAll('.st h1, .st h2, .st h3, .st p, .st a, .st button, .st label')].filter(el => {
            if(!el.getClientRects().length || el.closest('[aria-hidden="true"], [inert], .st-art'))return false;
            const rect=el.getBoundingClientRect();return rect.left < -1 || rect.right > innerWidth+1;
          }).map(el=>({element:el.className||el.tagName,text:el.textContent.trim().slice(0,80)})),
          splitHeadingWords: [...document.querySelectorAll('.st h1, .st h2, .st h3')].flatMap(heading => {
            const split=[];
            const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);
            while(walker.nextNode()) {
              const node=walker.currentNode;
              for(const word of node.textContent.matchAll(/[A-Za-z]{6,}/g)) {
                const range=document.createRange();range.setStart(node,word.index);range.setEnd(node,word.index+word[0].length);
                const tops=[...range.getClientRects()].map(r=>Math.round(r.top));
                if(tops.length>1 && Math.max(...tops)-Math.min(...tops)>5)split.push(word[0]);
              }
            }
            return split.length?[{heading:heading.textContent,words:split}]:[];
          }),
          consistentPalette: [...document.querySelectorAll('.st-bands, .st-art')].every(el => {
            const style = getComputedStyle(el);
            return el.matches('.st-bands')
              ? style.getPropertyValue('--st-band-bright').trim() === style.getPropertyValue('--st-accent').trim()
                && style.getPropertyValue('--st-band-dark').trim() === style.getPropertyValue('--st-dark').trim()
              : style.getPropertyValue('--art-deep').trim() === style.getPropertyValue('--st-accent').trim()
                && style.getPropertyValue('--art-light').trim() === style.getPropertyValue('--st-highlight').trim();
          }),
          violations: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
          incomplete: scan.incomplete.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })),
        };
      });
      reports.push({ route, width, ...result });
      console.log(JSON.stringify({ route, width, violations: result.violations.map(v => v.id), overflow: result.overflow, splitHeadingWords: result.splitHeadingWords, outsideViewport: result.outsideViewport }));
    }
  }
} finally {
  await writeFile(output + '/automated.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), reports, errors }, null, 2));
  await browser.close();
}
process.exit(errors.length || reports.some(r => r.overflow || r.outsideViewport.length || r.splitHeadingWords.length || !r.consistentPalette || r.violations.length) ? 1 : 0);
