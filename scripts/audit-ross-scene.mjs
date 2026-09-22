// Pixel-level regression for scenery occlusion and activity on both sides of Ross.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5184';
const output = process.argv[3] || 'outputs/ross-paths/pixels';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
const frames=[];
try {
  const pages=[];
  for(const baseline of [true,false]) {
    const page=await browser.newPage({viewport:{width:1672,height:1000},deviceScaleFactor:1});
    await page.addInitScript(baseline=>{
      localStorage.setItem('ublda-motion-paused','true');
      const original=WebGL2RenderingContext.prototype.shaderSource;
      WebGL2RenderingContext.prototype.shaderSource=function(shader,source){
        const composite='fragColor = vec4(rossStreetLife(scene, sceneUV), 1.);';
        if(baseline && source.includes(composite)) {
          source=source.replace(composite,'fragColor = vec4(scene, 1.);');
          window.__rossBaseline=true;
        }
        return original.call(this,shader,source);
      };
    },baseline);
    await page.goto(base+'/consulting');
    await page.waitForFunction(()=>document.querySelector('.st-ross-shader')?.dataset.ready==='true');
    if(baseline && !await page.evaluate(()=>window.__rossBaseline)) throw new Error('Baseline shader was not installed');
    await page.locator('.st-ross-hero').evaluate(el=>Object.assign(el.style,{position:'fixed',top:'0',left:'0',width:'1672px',height:'941px'}));
    await page.waitForTimeout(250);
    pages.push(page);
  }
  const capture=(page,time)=>page.locator('.st-ross-shader').evaluate((host,time)=>{
    host.paperShaderMount.setUniforms({u_sceneTime:time,u_sceneBlend:0,u_cropShift:0,u_ubldaGridDrift:[0,0]});
    const gl=host.querySelector('canvas').getContext('webgl2');
    if(gl.drawingBufferWidth!==1672 || gl.drawingBufferHeight!==941) throw new Error('Unexpected scene scale');
    const regions={east:[1440,0,232,941],west:[70,320,650,400],roof:[800,350,100,100]};
    return Object.fromEntries(Object.entries(regions).map(([name,[x,y,w,h]])=>{
      const pixels=new Uint8Array(w*h*4);gl.readPixels(x,941-y-h,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      return [name,Array.from(pixels)];
    }));
  },time);
  // Sample the full vehicle loop, including turns and several canopy crossings.
  for(const time of [0,12,24,36,48,60,72]) {
    const [baseline,active]=await Promise.all(pages.map(page=>capture(page,time)));
    const result={time,foliagePixels:0,foliageOverpaint:0,eastActivity:0,westActivity:0,roofChanges:0};
    for(const [region,pixels] of Object.entries(baseline)) {
      for(let i=0;i<pixels.length;i+=4) {
        const [r,g,b]=pixels.slice(i,i+3);
        const changed=Math.max(...[0,1,2].map(c=>Math.abs(pixels[i+c]-active[region][i+c])))>1;
        if(region==='east') {
          // Unambiguous leaf pixels in the source image, including gold leaves.
          const leaf=g>b*1.25 && g>r*.9 && g-b>8;
          if(leaf) {result.foliagePixels++; if(changed)result.foliageOverpaint++;}
          if(changed)result.eastActivity++;
        } else if(changed) result[region==='west'?'westActivity':'roofChanges']++;
      }
    }
    result.pass=result.foliagePixels>1000 && result.foliageOverpaint===0 && result.eastActivity>100 && result.westActivity>100 && result.roofChanges===0;
    frames.push(result);console.log(JSON.stringify(result));
  }
  await pages[1].locator('.st-ross-shader canvas').screenshot({path:output+'/scene.png'});
  await writeFile(output+'/pixels.json',JSON.stringify(frames,null,2));
  if(frames.some(frame=>!frame.pass))process.exitCode=1;
} finally {await browser.close();}
