import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const output = process.argv[3] || 'outputs/scroll-behavior';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
const checks=[], errors=[];
const check=(name,pass,detail)=>{checks.push({name,pass,detail});console.log(JSON.stringify(checks.at(-1)));};
try {
  for(const width of [1440,390]) {
    for(const route of ['/', '/consulting']) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push({route,width,message:e.message}));
      await page.addInitScript(()=>{
        window.__canvasPaints=new WeakMap();
        for(const method of ['fill','fillRect','drawImage']) {
          const original=CanvasRenderingContext2D.prototype[method];
          CanvasRenderingContext2D.prototype[method]=function(...args) {
            window.__canvasPaints.set(this.canvas,(window.__canvasPaints.get(this.canvas)||0)+1);
            return original.apply(this,args);
          };
        }
      });
      await page.goto(base+route); await page.locator('main h1').waitFor(); await page.evaluate(()=>document.fonts.ready);
      check(`Local fonts only ${route} ${width}`,await page.evaluate(()=>!performance.getEntriesByType('resource').some(e=>e.name.includes('fonts.googleapis.com')||e.name.includes('fonts.gstatic.com'))));
      check(`No recruiting shader download ${route} ${width}`,await page.evaluate(()=>!performance.getEntriesByType('resource').some(e=>/\/Table-|\/shaders-|\/Halftone/.test(e.name))));
      const canvas=page.locator(route==='/'?'.eq-brand-particles canvas':'.st-bands').first();
      await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      const paints=()=>canvas.evaluate(el=>window.__canvasPaints.get(el)||0);
      const active=await paints(); await page.waitForTimeout(300);
      check(`Visible artwork animates ${route} ${width}`,(await paints())>active);
      await page.locator('footer').scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
      const stopped=await paints(); await page.waitForTimeout(300);
      check(`Offscreen artwork stops painting ${route} ${width}`,(await paints())===stopped);
      await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
      const resumed=await paints(); await page.waitForTimeout(250);
      check(`Artwork resumes ${route} ${width}`,(await paints())>resumed);
      // Native section navigation should show intermediate positions and settle
      // exactly, while a newer destination cancels the older scroll.
      if(route==='/') {
        await page.getByRole('link',{name:'UBLDA home',exact:true}).click();
        await page.waitForFunction(()=>scrollY<2);
        await page.getByRole('link',{name:'Scroll to introduction',exact:true}).click();
        await page.waitForTimeout(100);
        const intermediate=await page.evaluate(()=>({y:scrollY,target:document.getElementById('intro').getBoundingClientRect().top+scrollY-68}));
        check(`Same-page scroll eases ${width}`,intermediate.y>0 && intermediate.y<intermediate.target-10,intermediate);
        await page.waitForFunction(()=>Math.abs(document.getElementById('intro').getBoundingClientRect().top-68)<2);
        if(width<769) await page.getByRole('button',{name:'Open menu',exact:true}).click();
        await page.locator('.eq-header nav').getByRole('link',{name:'Team',exact:true}).click();
        await page.waitForTimeout(120);
        if(width<769) await page.getByRole('button',{name:'Open menu',exact:true}).click();
        await page.locator('.eq-header nav').getByRole('link',{name:'Our Story',exact:true}).click();
        await page.waitForFunction(()=>Math.abs(document.getElementById('our-story').getBoundingClientRect().top-68)<2);
        await page.waitForTimeout(300);
        check(`Newest navigation wins ${width}`,await page.locator('#our-story').evaluate(el=>Math.abs(el.getBoundingClientRect().top-68)<2 && el.contains(document.activeElement)));
      }
      const toggle=page.locator(route==='/'?'.eq-motion-toggle':'.st-motion-toggle');
      await toggle.click(); await page.waitForTimeout(250);
      check(`Pause preference saved ${route} ${width}`,await page.evaluate(()=>localStorage.getItem('ublda-motion-paused')==='true'));
      await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      const paused=await paints(); await page.waitForTimeout(350);
      check(`Paused artwork stays still ${route} ${width}`,(await paints())===paused);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(100);
      check(`Device reduced motion respected ${route} ${width}`,await toggle.isDisabled());
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
      const violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
      check(`Accessibility scan ${route} ${width}`,!violations.length,violations);
      check(`No horizontal overflow ${route} ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`${output}/${route==='/'?'club':'consulting'}-${width}.png`});
      await context.close();
    }
  }
} catch(error) {errors.push({message:error.stack});}
finally {
  await writeFile(`${output}/behavior.json`,JSON.stringify({base,checkedAt:new Date().toISOString(),checks,errors},null,2));
  await browser.close();
}
if(errors.length||checks.some(c=>!c.pass)) process.exitCode=1;
