import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5178';
const output = process.argv[3] || 'outputs/public-navigation';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ reducedMotion: 'reduce' });
page.setDefaultTimeout(10000);
const checks = [], errors = [], links = new Map();
page.on('pageerror', e => errors.push({ url:page.url(),message:e.message }));
const check = (name, pass, detail) => { checks.push({name,pass,detail}); console.log(JSON.stringify(checks.at(-1))); };
const ready = async (route='/') => { await page.goto(base+route); await page.locator('main h1').waitFor(); await page.evaluate(()=>document.fonts.ready); };
const pause = async () => {
  // Native smooth navigation is interruptible and distance-dependent. Check the
  // settled destination rather than assuming every click teleports in 100ms.
  await page.waitForTimeout(150);
  await page.evaluate(() => new Promise(resolve => {
    let last = scrollY, stable = 0;
    const start = performance.now();
    const tick = () => {
      stable = Math.abs(scrollY - last) < .5 ? stable + 1 : 0;
      last = scrollY;
      if (stable >= 5 || performance.now() - start > 4000) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
};
const routeClick = async (link, name) => {
  const destination = new URL(await link.getAttribute('href'),page.url());
  await link.click(); await page.waitForURL(url=>url.pathname===destination.pathname && url.hash===destination.hash); await page.locator('main h1').waitFor(); await pause();
  const valid = await page.locator('main').evaluate(el=>!el.inert && el.getBoundingClientRect().height>0);
  check(name, valid && !(await page.locator('main h1').innerText()).includes('404'), {destination:destination.pathname+destination.hash,title:await page.title()});
};
await mkdir(output,{recursive:true});
try {
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    await ready();
    await page.getByRole('link',{name:'Scroll to introduction',exact:true}).click(); await pause();
    check(`Intro arrow ${width}`, await page.locator('#intro').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<110));
    for (const [label,id] of [['Our Story','our-story'],['What we stand for','what-we-stand-for'],['What we do','capabilities'],['Our Community','our-work'],['Team','team']]) {
      for (let repeat=0;repeat<2;repeat++) {
        if (repeat) await page.locator('.eq-footer-wordmark').scrollIntoViewIfNeeded();
        if (width<769) await page.getByRole('button',{name:'Open menu',exact:true}).click();
        await page.locator('.eq-header nav').getByRole('link',{name:label,exact:true}).click(); await pause();
        const position = await page.locator('#'+id).evaluate(el=>el.getBoundingClientRect().top);
        check(`Header ${label} ${width} ${repeat?'repeat':'first'}`, Math.abs(position)<110,{position});
      }
    }
    await ready();
    await page.locator('.eq-footer-wordmark').scrollIntoViewIfNeeded();
    await page.locator('.eq-footer-wordmark').click(); await pause();
    check(`Footer home link resets same-page scroll ${width}`, await page.evaluate(()=>scrollY<5));
    await page.locator('#capabilities').scrollIntoViewIfNeeded();
    await page.locator('.eq-wordmark').click(); await pause();
    check(`Header home link resets same-page scroll ${width}`, await page.evaluate(()=>scrollY<5));
    for(let i=0;i<8;i++) {
      await ready();
      const program=page.locator('.eq-program').nth(i);
      await program.locator('button').click();
      const label=await program.locator('h3').innerText();
      await routeClick(program.getByRole('link',{name:'Explore',exact:true}),`Program Explore: ${label} ${width}`);
    }
    for(let i=0;i<4;i++) {
      await ready();
      const card=page.locator('.eq-story-card').nth(i);
      await card.locator('button').click();
      await routeClick(card.getByRole('link'),`Community Learn more ${i+1} ${width}`);
    }
    await ready();
    await routeClick(page.locator('.eq-team-link'),`Meet the executive board ${width}`);
    check(`Join CTA opens membership form ${width}`, (await page.locator(".eq-cta").getByRole("link",{name:"Join UBLDA",exact:true}).getAttribute("href"))?.includes("1FAIpQLSdC4ZFjdoCPnydqAI2ctdHK1AbWfXlVfNbrSiC_Z5ZB9cyTrg/viewform"));
    check(`Footer Join opens membership form ${width}`, (await page.locator(".eq-footer-nav").getByRole("link",{name:"Join",exact:true}).getAttribute("href"))?.includes("1FAIpQLSdC4ZFjdoCPnydqAI2ctdHK1AbWfXlVfNbrSiC_Z5ZB9cyTrg/viewform"));
    await ready();
    await routeClick(page.locator('.eq-cta').getByRole('link',{name:'Come to an event',exact:true}),`Events CTA ${width}`);
    await ready();
    await routeClick(page.getByRole('link',{name:'Event details',exact:true}),`Upcoming event details ${width}`);
    check(`Event detail anchor visible ${width}`, await page.locator('.eq-event-feature').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<130));
    await routeClick(page.getByRole('link',{name:'Explore past events',exact:true}),`Past events anchor ${width}`);
    await page.locator('.eq-event-recap summary').first().click();
    check(`Event recap expands ${width}`, await page.locator('.eq-event-recap').first().evaluate(el=>el.open));
    for(const href of ['/about','/events','/team','/consulting','/brand','/links','/unsubscribe']) {
      await ready();
      await routeClick(page.locator(`.eq-footer-nav a[href="${href}"]`),`Footer ${href} ${width}`);
    }
    await ready('/about');
    if(width<769) await page.getByRole('button',{name:'Open menu',exact:true}).click();
    await routeClick(page.locator('.eq-header nav').getByRole('link',{name:'What we stand for',exact:true}),`Cross-page values link ${width}`);
    check(`Cross-page values anchor ${width}`, await page.locator('#what-we-stand-for').evaluate(el=>Math.abs(el.getBoundingClientRect().top)<110));
    await ready('/consulting');
    await page.locator('.st-footer').scrollIntoViewIfNeeded();
    await page.locator('.st-logo').click(); await pause();
    check(`Consulting home link resets same-page scroll ${width}`,await page.evaluate(()=>scrollY<5));
  }
  // Repeat navigation with the full motion/ScrollTrigger lifecycle active.
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900}); await ready();
    await page.getByRole('link',{name:'Scroll to introduction',exact:true}).click();
    for(const [label,id] of [['Our Story','our-story'],['What we stand for','what-we-stand-for'],['What we do','capabilities'],['Our Community','our-work'],['Team','team']]) {
      for(let repeat=0;repeat<2;repeat++) {
        if(repeat) await page.locator('.eq-footer-wordmark').scrollIntoViewIfNeeded();
        if(width<769) await page.getByRole('button',{name:'Open menu',exact:true}).click();
        await page.locator('.eq-header nav').getByRole('link',{name:label,exact:true}).click(); await pause();
        const result=await page.locator('#'+id).evaluate(el=>({top:el.getBoundingClientRect().top,focused:el.contains(document.activeElement)}));
        check(`Full motion ${label} ${width} ${repeat?'repeat':'first'}`,Math.abs(result.top)<110 && result.focused,result);
      }
    }
    await page.locator('.eq-wordmark').click(); await pause();
    await page.locator('.eq-footer-wordmark').scrollIntoViewIfNeeded(); await page.locator('.eq-footer-wordmark').click(); await pause();
    check(`Full motion home link ${width}`,await page.evaluate(()=>scrollY<5));
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  // Inventory every public route, including references that only appear in disclosures.
  const routes=['/','/about','/events','/team','/join','/brand','/links','/unsubscribe','/consulting','/consulting/work','/consulting/practice','/consulting/leadership','/consulting/partners','/consulting/contact','/consulting/services','/consulting/services/strategy','/consulting/services/accessibility','/consulting/services/workplace','/consulting/insights','/consulting/insights/disability-is-not-a-niche','/consulting/insights/the-business-case','/consulting/insights/employment-and-access'];
  for(const route of routes) {
    await ready(route);
    for(const link of await page.locator('a').evaluateAll(anchors=>anchors.map(a=>({href:a.getAttribute('href'),label:a.getAttribute('aria-label')||a.textContent.trim(),download:a.hasAttribute('download')})))) {
      if(!link.href) {check(`Link destination on ${route}`,false,link);continue;}
      links.set(link.href,{...link,source:route});
    }
  }
  for(const [href,link] of links) {
    const url=new URL(href,base+link.source);
    if(url.origin!==new URL(base).origin) continue;
    if(url.hash) {
      await ready(url.pathname);
      const found=await page.evaluate(id=>Boolean(document.getElementById(id)),decodeURIComponent(url.hash.slice(1)));
      check(`Anchor exists ${url.pathname+url.hash}`,found);
    } else if(link.download) {
      const response=await page.request.get(url.href);
      check(`Download ${url.pathname}`,response.ok() && /image\//.test(response.headers()['content-type']||''),{status:response.status(),type:response.headers()['content-type']});
    } else if(url.pathname==='/workspace') {
      await page.goto(url.href); await page.getByRole('heading').first().waitFor();
      check('Leadership login destination renders',!await page.getByText('Opening page…',{exact:true}).isVisible(),{title:await page.title()});
    } else {
      check(`Route exists ${url.pathname}`,routes.includes(url.pathname));
    }
  }
  const forms=[...links.keys()].filter(h=>/^https:\/\/(forms\.gle|docs\.google\.com\/forms)/.test(h));
  for(const href of forms) {
    const response=await page.request.get(href);const html=await response.text();
    check(`Public form opens ${links.get(href).label}`,response.ok() && /<title>/.test(html) && !/file you have requested does not exist/i.test(html),{url:href,status:response.status(),title:html.match(/<title>(.*?)<\/title>/s)?.[1],closed:/no longer accepting responses/i.test(html)});
  }
  await ready('/brand');
  for(const kind of ['SVG','PNG']) {
    const downloadEvent=page.waitForEvent('download');
    await page.getByRole('link',{name:`Download ${kind}`,exact:true}).click();
    const download=await downloadEvent;
    check(`Download button ${kind}`,!(await download.failure()),{filename:download.suggestedFilename()});
  }
  await page.setViewportSize({width:1440,height:1000});
  await ready('/#intro');
  await page.screenshot({path:output+'/homepage.png'});
} finally {
  await writeFile(output+'/navigation.json',JSON.stringify({base,checkedAt:new Date().toISOString(),checks,errors,links:[...links.values()]},null,2));
  // Some desktop Chrome instances retain teardown handles; results are already saved.
  await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,5000))]);
}
process.exit(checks.some(c=>!c.pass)||errors.length?1:0);
