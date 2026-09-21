import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.argv[2]||'http://127.0.0.1:5184';
const output=process.argv[3]||'outputs/brand-motion';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const checks=[],errors=[];
const check=(name,pass,detail)=>{checks.push({name,pass,detail});console.log(JSON.stringify(checks.at(-1)));};
const settle=page=>page.waitForTimeout(450);
const show=async(page,index,blend=0)=>{
 await page.locator('.eq-value-zone').nth(index).evaluate((el,blend)=>{
  const section=el.closest('.eq-values'),compact=section.dataset.static==='true';
  const height=section.querySelector('.eq-ribbon-rail').getBoundingClientRect().height;
  const line=compact?68+height+48:170;
  const transition=compact?Math.min(220,innerHeight*.28):innerHeight*.7-170;
  scrollTo({top:el.getBoundingClientRect().top+scrollY-line-transition*blend+1,behavior:'instant'});
 },blend);
 await settle(page);
};
try{
 for(const [width,height] of [[320,568],[390,844],[844,390],[1024,768],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<1100});
  await context.addInitScript(()=>{
   window.__paints=new WeakMap();
   for(const [type,methods] of [[CanvasRenderingContext2D,['stroke']],[WebGLRenderingContext,['drawElements']],[WebGL2RenderingContext,['drawElements']]]){
    for(const method of methods){const original=type.prototype[method];type.prototype[method]=function(...args){window.__paints.set(this.canvas,(window.__paints.get(this.canvas)||0)+1);return original.apply(this,args);};}
   }
  });
  await context.addInitScript({path:'node_modules/axe-core/axe.min.js'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push({width,message:e.stack}));
  await page.goto(base);await page.locator('main h1').waitFor();await page.evaluate(()=>document.fonts.ready);await settle(page);
  const canvas=page.locator('.eq-ribbon-flight');
  const paints=locator=>locator.evaluate(el=>window.__paints.get(el)||0);
  let positions=[];
  for(let i=0;i<5;i++){
   await show(page,i);await page.waitForFunction(()=>Number(document.querySelector('.eq-ribbon-flight')?.dataset.progress)>=0);await settle(page);
   const state=await canvas.evaluate(el=>({progress:Number(el.dataset.progress),opacity:getComputedStyle(el).opacity,rect:el.getBoundingClientRect().toJSON()}));
   check(`Value ${i+1} matches its sculpture ${width}x${height}`,Math.abs(state.progress-i)<.04&&state.opacity==='1',state.progress);
   if(i>0)positions.push(state.rect);
   check(`Value ${i+1} heading fits ${width}x${height}`,await page.locator('.eq-value h2').nth(i).evaluate(el=>el.scrollWidth<=el.clientWidth+1));
   if(width===390||width===1440)await page.screenshot({path:`${output}/verified-${width}-${i}.png`});
  }
  check(`Sculpture remains on one rail ${width}x${height}`,Math.max(...positions.map(p=>p.x))-Math.min(...positions.map(p=>p.x))<1&&Math.max(...positions.map(p=>p.y))-Math.min(...positions.map(p=>p.y))<1,positions.map(p=>[p.x,p.y]));
  await show(page,2,.5);await settle(page);
  check(`Reverse scrolling morphs continuously ${width}`,await canvas.evaluate(el=>Math.abs(Number(el.dataset.progress)-1.5)<.04));
  const active=await paints(canvas);await settle(page);check(`3D artwork changes frames ${width}`,(await paints(canvas))>active);
  await page.locator('footer').scrollIntoViewIfNeeded();await settle(page);const offscreen=await paints(canvas);await settle(page);check(`Offscreen 3D stops ${width}`,(await paints(canvas))===offscreen);
  await page.locator('#intro').evaluate(el=>scrollTo({top:el.getBoundingClientRect().top+scrollY-68,behavior:'instant'}));await settle(page);
  const current=page.locator('.eq-brand-current');const ambient=await paints(current);await settle(page);check(`Hero background animates ${width}`,(await paints(current))>ambient);
  await page.locator('footer').scrollIntoViewIfNeeded();await settle(page);const still=await paints(current);await settle(page);check(`Offscreen background stops ${width}`,(await paints(current))===still);
  await show(page,1);await page.locator('.eq-motion-toggle').click();await settle(page);
  check(`Pause restores all five static sculptures ${width}`,await page.locator('.eq-values').evaluate(el=>[...el.querySelectorAll('.eq-value-zone .eq-ribbon-anchor svg')].every(svg=>getComputedStyle(svg).opacity==='1')));
  await page.locator('#intro').scrollIntoViewIfNeeded();await settle(page);const paused=await paints(current);await settle(page);check(`Pause stops background ${width}`,(await paints(current))===paused);
  await page.emulateMedia({reducedMotion:'reduce'});await settle(page);
  check(`Reduced motion respected ${width}`,await page.locator('.eq-motion-toggle').isDisabled());
  check(`No horizontal overflow ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id));
  check(`Accessibility ${width}`,violations.length===0,violations);
  await context.close();
 }
 // Failure boundary: mobile retains the same meaningful SVG artwork without GPU support.
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl'||type==='webgl2'?null:get.call(this,type,...rest);};});
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);await settle(page);
 for(let i=0;i<5;i++){
  await show(page,i);check(`No WebGL fallback matches value ${i+1}`,await page.locator('.eq-ribbon-rail > .eq-ribbon-anchor').nth(i).evaluate(el=>getComputedStyle(el).opacity==='1'));
 }
 await page.screenshot({path:`${output}/no-webgl.png`});
 await page.close();
}catch(error){errors.push({message:error.stack});console.error(error);}
finally{await browser.close();await writeFile(`${output}/audit.json`,JSON.stringify({base,checks,errors},null,2));}
if(errors.length||checks.some(c=>!c.pass))process.exitCode=1;
