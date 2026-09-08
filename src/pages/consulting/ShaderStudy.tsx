import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedMark, RossHalftone, type LogoEffect, type RossSource } from './BrandShaders'
import './ShaderStudy.css'

const sources: { id: RossSource; name: string; detail: string }[] = [
  { id: 'photo', name: 'Ross photograph', detail: 'A recognizable Michigan setting with the texture of a printed poster.' },
  { id: 'detail', name: 'Architecture crop', detail: 'Windows and brick become a quieter geometric texture.' },
  { id: 'illustration', name: 'Ross illustration', detail: 'The existing site artwork with a printed finish.' },
]
const effects: { id: LogoEffect; name: string; detail: string }[] = [
  { id: 'heatmap', name: 'Heatmap', detail: 'Navy and teal moving through the mark with a small gold accent.' },
  { id: 'metal', name: 'Liquid Metal', detail: 'A teal metallic surface. More reflective and less faithful to the original colors.' },
  { id: 'smoke', name: 'Gem Smoke', detail: 'A soft halo around the mark. Best viewed large enough to preserve its shape.' },
]
export default function ShaderStudy() {
  const [source,setSource] = useState<RossSource>('photo')
  const [gold,setGold] = useState(false)
  const [size,setSize] = useState(0.3)
  const [overlay,setOverlay] = useState(false)
  const [effect,setEffect] = useState<LogoEffect>('heatmap')
  const [paused,setPaused] = useState(false)
  const [retainColors,setRetainColors] = useState(true)
  const [reduced,setReduced] = useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)')
    const update=()=>setReduced(media.matches)
    media.addEventListener('change',update)
    const before=document.title
    document.title='UBLDA · Shader studies'
    return ()=>{media.removeEventListener('change',update);document.title=before}
  },[])
  return <main className="shader-study" id="main-content">
    <header className="shader-study__header"><Link to="/consulting">UBLDA Consulting</Link><a href="https://shaders.paper.design/" target="_blank" rel="noreferrer">Paper shader library ↗</a></header>
    <h1>Ross in print.<br />UBLDA in motion.</h1>
    <p className="shader-study__intro">Try the actual Ross assets and UBLDA logo with Paper’s shaders. These are local design studies.</p>
    <section aria-labelledby="ross-study-title">
      <div className="shader-study__heading"><h2 id="ross-study-title">01 / Halftone CMYK</h2><a href={`/consulting?art=halftone&source=${source}&gold=${gold ? '1':'0'}&dots=${size}`}>See it in the full page ↗</a></div>
      <div className="shader-study__controls">
        <div className="shader-study__choices" aria-label="Ross source">{sources.map(s=><button key={s.id} aria-pressed={source===s.id} onClick={()=>setSource(s.id)}>{s.name}</button>)}</div>
        <label><input type="checkbox" checked={gold} onChange={e=>setGold(e.target.checked)} /> Include gold ink</label>
        <label>Dot size <input aria-label="Dot size" type="range" min="0.1" max="0.65" step="0.05" value={size} onChange={e=>setSize(Number(e.target.value))}/></label>
        <label><input type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)} /> Show headline</label>
      </div>
      <div className={`shader-study__ross ${overlay ? 'shader-study__ross--hero':''}`}>
        <RossHalftone source={source} size={size} gold={gold}/>
        {overlay && <div className="shader-study__hero-copy"><h3>We consult for disability-focused organizations and accessibility teams.</h3></div>}
      </div>
      <p>{sources.find(s=>s.id===source)?.detail}</p>
    </section>
    <section aria-labelledby="logo-study-title">
      <div className="shader-study__heading"><h2 id="logo-study-title">02 / The UBLDA mark</h2><button onClick={()=>setPaused(v=>!v)} aria-pressed={paused}>{paused ? 'Play animation':'Pause animation'}</button></div>
      <div className="shader-study__choices">{effects.map(e=><button key={e.id} aria-pressed={effect===e.id} onClick={()=>setEffect(e.id)}>{e.name}</button>)}</div>
      <label className="shader-study__retain"><input type="checkbox" checked={retainColors} onChange={e=>setRetainColors(e.target.checked)} /> Retain the original logo colors</label>
      <div className="shader-study__logos"><figure><div className="shader-study__original"><img src="/logo-mark.svg" alt="Original UBLDA logo"/></div><figcaption>Original mark</figcaption></figure><figure><div className="shader-study__animation" role="img" aria-label={`UBLDA logo with ${effect} animation`}><AnimatedMark effect={effect} paused={paused || reduced}/>{retainColors && <img className="shader-study__logo-overlay" src="/logo-mark.svg" alt="" aria-hidden="true"/>}</div><figcaption>{effects.find(e=>e.id===effect)?.name}</figcaption></figure></div>
      <p>{effects.find(e=>e.id===effect)?.detail}</p>
    </section>
  </main>
}
