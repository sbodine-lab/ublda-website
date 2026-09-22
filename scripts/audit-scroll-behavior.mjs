import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const output = process.argv[3] || 'outputs/scroll-behavior';
const routes = process.argv[4] ? [process.argv[4]] : ['/', '/consulting'];
if (routes.some(route => !['/', '/consulting'].includes(route))) throw new Error('Expected / or /consulting');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
const checks=[], errors=[];
const check=(name,pass,detail)=>{checks.push({name,pass,detail});console.log(JSON.stringify(checks.at(-1)));};
try {
  for(const width of [1440,390]) {
    for(const route of routes) {
      const context = await browser.newContext({viewport:{width,height:900},hasTouch:width<769,reducedMotion:'no-preference'});
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
        const drawArrays = WebGL2RenderingContext.prototype.drawArrays;
        WebGL2RenderingContext.prototype.drawArrays = function(...args) {
          window.__canvasPaints.set(this.canvas,(window.__canvasPaints.get(this.canvas)||0)+1);
          return drawArrays.apply(this,args);
        };
      });
      // Install audit instrumentation through the browser before navigation;
      // production keeps its script-src policy intact for page scripts.
      await page.addInitScript({path:'node_modules/axe-core/axe.min.js'});
      await page.goto(base+route); await page.locator('main h1').waitFor(); await page.evaluate(()=>document.fonts.ready);
      check(`Local fonts only ${route} ${width}`,await page.evaluate(()=>!performance.getEntriesByType('resource').some(e=>e.name.includes('fonts.googleapis.com')||e.name.includes('fonts.gstatic.com'))));
      check(`No recruiting shader download ${route} ${width}`,await page.evaluate(()=>!performance.getEntriesByType('resource').some(e=>/\/Table-|\/shaders-|\/Halftone/.test(e.name))));
      if (route === '/consulting') {
        await page.locator('.st-hero .st-actions .st-button:not(.st-button--solid)').hover();
        await page.waitForTimeout(350);
        const heroHoverViolations = await page.evaluate(async()=> (await window.axe.run('.st-hero .st-actions',{runOnly:{type:'rule',values:['color-contrast']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
        check(`Hero CTA hover contrast ${width}`,!heroHoverViolations.length,heroHoverViolations);
        await page.mouse.move(0,0);
        const glass = page.locator('.st-ross-shader');
        const heroCanvas = glass.locator('canvas');
        await page.waitForFunction(()=>document.querySelector('.st-ross-shader')?.dataset.ready==='true');
        const heroPaints = ()=>heroCanvas.evaluate(el=>window.__canvasPaints.get(el)||0);
        const gridPosition = () => heroCanvas.evaluate(el => {
          const gl = el.getContext('webgl2');
          const program = gl.getParameter(gl.CURRENT_PROGRAM);
          return Array.from(gl.getUniform(program, gl.getUniformLocation(program, 'u_ubldaGridDrift')));
        });
        const sceneClock = () => heroCanvas.evaluate(el => {
          const gl = el.getContext('webgl2');
          return gl.getUniform(gl.getParameter(gl.CURRENT_PROGRAM), gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM), 'u_sceneTime'));
        });
        const initialScene = await sceneClock();
        const initialGrid = await gridPosition();
        const moving = await heroPaints(); await page.waitForTimeout(300);
        const movedGrid = await gridPosition();
        check(`Ross halftone grid coordinates animate ${width}`,
          JSON.stringify(initialGrid)!==JSON.stringify(movedGrid) && movedGrid.every(Number.isFinite), {initialGrid,movedGrid});
        check(`Ross shader renders live motion ${width}`,(await heroPaints())>moving);
        check(`Ross scene time advances ${width}`,(await sceneClock())>initialScene);
        await page.evaluate(()=>window.scrollTo({top:document.querySelector('.st-hero').offsetHeight*.55,behavior:'instant'}));
        await page.waitForTimeout(1400);
        const fastSpeed = Number(await glass.getAttribute('data-scene-speed'));
        const fastStart = await sceneClock(); await page.waitForTimeout(400);
        const fastDelta = await sceneClock()-fastStart;
        check(`Scrolling accelerates the visible Ross scene ${width}`,fastSpeed>2 && fastSpeed<=4 && fastDelta>.6,{fastSpeed,fastDelta});
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
        await page.waitForTimeout(1800);
        const slowSpeed = Number(await glass.getAttribute('data-scene-speed'));
        check(`Returning to the hero slows the scene ${width}`,slowSpeed<1.2,{slowSpeed});
        await page.locator('.st-motion-toggle').click(); await page.waitForTimeout(150);
        const frozenScene = await sceneClock();
        const frozenGrid = await gridPosition();
        const frozen = await heroPaints(); await page.waitForTimeout(300);
        check(`Pause freezes Ross shader ${width}`,(await heroPaints())===frozen && JSON.stringify(await gridPosition())===JSON.stringify(frozenGrid) && await sceneClock()===frozenScene);
        await page.locator('.st-motion-toggle').click(); await page.waitForTimeout(150);
        check(`Resume restarts Ross shader ${width}`,(await heroPaints())>frozen);
        await page.locator('footer').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
        const offscreen = await heroPaints(); await page.waitForTimeout(250);
        check(`Offscreen Ross shader stops rendering ${width}`,(await heroPaints())===offscreen);
        await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
        await page.emulateMedia({reducedMotion:'reduce'}); await page.waitForTimeout(200);
        const reducedScene = await sceneClock();
        const reduced = await heroPaints(); await page.waitForTimeout(250);
        check(`Device reduced motion freezes Ross shader ${width}`,(await heroPaints())===reduced && await sceneClock()===reducedScene);
        await page.emulateMedia({reducedMotion:'no-preference'});
        const menu = page.locator('.st-navlinks');
        const about = page.getByRole('button', {name:'About us',exact:true});
        if (width < 1025) {
          const toggle = page.getByRole('button', {name:'Open menu',exact:true});
          await toggle.focus(); await page.keyboard.press('Space');
          await page.waitForFunction(()=>document.querySelector('.st-navlinks > a')===document.activeElement);
          check('Phone navigation isolates the page and moves focus inside',await page.locator('main').evaluate(el=>el.inert));
          await page.keyboard.press('Shift+Tab');
          check('Phone navigation wraps backward to its close control',await page.locator('.st-menu-toggle').evaluate(el=>el===document.activeElement));
          await page.keyboard.press('Tab');
          check('Phone navigation wraps forward to the first link',await menu.locator('a').first().evaluate(el=>el===document.activeElement));
        }
        await about.focus(); await page.keyboard.press('Space');
        check(`About disclosure opens from the keyboard ${width}`,await about.getAttribute('aria-expanded')==='true');
        const navigationViolations = await page.evaluate(async()=> (await window.axe.run('.st-header',{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
        check(`Expanded navigation accessibility scan ${width}`,!navigationViolations.length,navigationViolations);
        const smallTargets = await page.locator('.st-header').evaluate(el=>[...el.querySelectorAll('a,button')].filter(node=>node.getClientRects().length && !node.closest('[inert]') && node.getBoundingClientRect().height<44).map(node=>node.textContent));
        check(`Navigation targets remain at least 44px high ${width}`,!smallTargets.length,smallTargets);
        await page.keyboard.press('Tab');
        check(`About disclosure links are in tab order ${width}`,await page.locator('#consulting-about a').first().evaluate(el=>el===document.activeElement));
        await page.keyboard.press('Escape');
        check(`Escape closes the disclosure and restores focus ${width}`,await about.getAttribute('aria-expanded')==='false' && await about.evaluate(el=>el===document.activeElement));
        if (width < 1025) {
          check('Closing the submenu keeps the phone navigation open',await menu.evaluate(el=>el.classList.contains('st-navlinks--open')));
          await page.keyboard.press('Escape');
          check('Escape closes phone navigation and restores its trigger',await page.locator('.st-menu-toggle').evaluate(el=>el===document.activeElement && el.getAttribute('aria-expanded')==='false'));
          await page.setViewportSize({width:844,height:390});
          await page.getByRole('button',{name:'Open menu',exact:true}).click();
          const panel = await menu.boundingBox();
          check('Landscape menu stays within the viewport and can scroll',panel.y+panel.height<=390 && await menu.evaluate(el=>getComputedStyle(el).overflowY==='auto'));
          await page.setViewportSize({width:1440,height:900});
          await page.waitForFunction(()=>!document.querySelector('main').inert);
          check('Phone-to-desktop resize releases background scrolling',await page.evaluate(()=>!document.documentElement.classList.contains('st-menu-open')));
          await page.setViewportSize({width,height:900});
        } else {
          await about.click(); await page.locator('main h1').click();
          check('Clicking outside the desktop disclosure dismisses it',await about.getAttribute('aria-expanded')==='false');
        }
      }
      if (route === '/' && width === 1440) {
        await page.setViewportSize({width:390,height:900});
        await page.getByRole('button', {name:'Open menu',exact:true}).click();
        await page.setViewportSize({width:1440,height:900});
        await page.waitForFunction(() => !document.querySelector('main').inert);
        check('Resizing an open phone menu restores page scrolling', await page.evaluate(() => document.body.style.overflow !== 'hidden'));
      }
      if (route === '/' && width < 769) {
        check('Phone menu is available before scrolling', await page.getByRole('button', {name:'Open menu',exact:true}).isVisible());
        await page.setViewportSize({width:844,height:390});
        await page.getByRole('button', {name:'Open menu',exact:true}).click();
        check('Landscape phone menu opens and locks its background', await page.locator('main').evaluate(el => el.inert));
        await page.getByRole('button', {name:'Close menu',exact:true}).click();
        await page.setViewportSize({width,height:900});
        await page.locator('.eq-value-zone').first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        await page.waitForFunction(() => document.querySelector('.eq-ribbon-flight').dataset.progress !== undefined);
        check('Phone values use a stable sticky sculpture shelf', await page.locator('.eq-ribbon-rail').evaluate(el => getComputedStyle(el).position === 'sticky'));
        check('Phone scroll loads the morphing WebGL artwork', await page.locator('.eq-ribbon-flight').evaluate(el => getComputedStyle(el).opacity === '1'));
        for (const value of await page.locator('.eq-value-zone').all()) {
          await value.scrollIntoViewIfNeeded();
          check('Phone value text remains readable after scrolling', await value.locator('article').evaluate(el => getComputedStyle(el).opacity === '1'));
        }
      }
      const canvas=page.locator(route==='/'?'.eq-logo-stage canvas':'.st-bands').first();
      await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      const paints=()=>canvas.evaluate(el=>window.__canvasPaints.get(el)||0);
      const active=await paints(); await page.waitForTimeout(300);
      check(`Visible artwork animates ${route} ${width}`,(await paints())>active);
      await page.locator(route==='/'?'footer':'.st-hero h1').scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
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
      const violations=await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));
      check(`Accessibility scan ${route} ${width}`,!violations.length,violations);
      check(`No horizontal overflow ${route} ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:`${output}/${route==='/'?'club':'consulting'}-${width}.png`});
      if (route === '/consulting') {
        await page.locator('.st-ross-shader canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
        await page.waitForFunction(()=>document.querySelector('.st-ross-shader').dataset.ready==='false');
        check(`WebGL context loss reveals the Ross image fallback ${width}`,await page.locator('.st-ross-hero').evaluate(el=>{
          const image=el.querySelector('img');
          return image.complete && image.naturalWidth>0 && getComputedStyle(el.querySelector('.st-ross-shader')).opacity==='0';
        }));
      }
      await context.close();
    }
  }
} catch(error) {errors.push({message:error.stack});}
finally {
  await writeFile(`${output}/behavior.json`,JSON.stringify({base,checkedAt:new Date().toISOString(),checks,errors},null,2));
  await browser.close();
}
if(errors.length||checks.some(c=>!c.pass)) process.exitCode=1;
