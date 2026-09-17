import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const output = process.argv[3] || 'outputs/scroll-performance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const route of ['/', '/consulting']) {
    for (const device of ['desktop', 'mobile', 'reduced']) {
      const context = await browser.newContext({ viewport: { width: device === 'mobile' ? 390 : 1440, height: 900 }, deviceScaleFactor: 1, isMobile: device === 'mobile', hasTouch: device === 'mobile', reducedMotion: device === 'reduced' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        window.__perf = { longTasks: [], shifts: [], frames: [] };
        new PerformanceObserver(list => list.getEntries().forEach(e => window.__perf.longTasks.push({ start: e.startTime, duration: e.duration }))).observe({ type: 'longtask', buffered: true });
        new PerformanceObserver(list => list.getEntries().forEach(e => { if (!e.hadRecentInput) window.__perf.shifts.push(e.value); })).observe({ type: 'layout-shift', buffered: true });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await page.goto(base + route);
      await page.locator('main h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(3200);
      const load = await page.evaluate(() => ({ resources: performance.getEntriesByType('resource').filter(e => ['script', 'link', 'css'].includes(e.initiatorType)).map(e => ({ name: new URL(e.name).pathname, bytes: e.encodedBodySize })), navigation: performance.getEntriesByType('navigation')[0].toJSON(), shifts: window.__perf.shifts.reduce((a,b) => a+b,0), longTasks: window.__perf.longTasks }));
      const before = (await cdp.send('Performance.getMetrics')).metrics;
      await page.evaluate(() => { window.__sampling = true; let last = performance.now(); const tick = time => { window.__perf.frames.push(time-last); last=time; if(window.__sampling) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      for (let step = 0; step < 28; step++) {
        if (device === 'mobile') {
          await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 650, yDistance: -430, speed: 1800, gestureSourceType: 'touch' });
        } else await page.mouse.wheel(0, 430);
        await page.waitForTimeout(85);
      }
      await page.waitForTimeout(850);
      const after = (await cdp.send('Performance.getMetrics')).metrics;
      const scroll = await page.evaluate(() => { window.__sampling = false; const frames = window.__perf.frames.slice(1).sort((a,b)=>a-b); return { y: scrollY, max: document.documentElement.scrollHeight-innerHeight, overflow: document.documentElement.scrollWidth>innerWidth+1, p95FrameMs: frames[Math.floor(frames.length*.95)], framesOver32ms: frames.filter(t=>t>32).length, frameCount: frames.length }; });
      const cost = Object.fromEntries(['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','TaskDuration'].map(name=>[name,after.find(m=>m.name===name).value-before.find(m=>m.name===name).value]));
      await page.screenshot({ path: `${output}/${route==='/'?'club':'consulting'}-${device}.png` });
      const result = { route, device, load, scroll, cost, errors };
      results.push(result);
      console.log(JSON.stringify({route,device,jsBytes:load.resources.filter(r=>r.name.endsWith('.js')).reduce((a,b)=>a+b.bytes,0),cls:load.shifts,scroll,cost,errors}));
      await context.close();
    }
  }
  await writeFile(`${output}/performance.json`, JSON.stringify({ base, checkedAt:new Date().toISOString(),results },null,2));
} finally { await browser.close(); }
if(results.some(r=>r.errors.length || r.scroll.overflow || r.scroll.y < 500)) process.exitCode=1;
