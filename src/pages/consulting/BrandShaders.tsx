import { FlutedGlass, HalftoneCmyk, Heatmap, LiquidMetal, GemSmoke } from '@paper-design/shaders-react'

export type RossSource = 'photo' | 'detail' | 'illustration'
export type LogoEffect = 'heatmap' | 'metal' | 'smoke'

export function RossGlass() {
  return <FlutedGlass
    image="/ross-front-entrance.jpg"
    colorBack="#FAF9F6" colorShadow="#0F2B3C" colorHighlight="#FAF9F6"
    shape="lines" distortionShape="prism" angle={0}
    size={0.64} distortion={0.22} stretch={0} shift={0}
    blur={0} shadows={0.04} highlights={0.06} edges={0}
    grainMixer={0} grainOverlay={0}
    speed={0} fit="cover" minPixelRatio={1} maxPixelCount={1400000}
    style={{ width: '100%', height: '100%' }}
  />
}

export function RossHalftone({ source = 'photo', size = 0.3, gold = true, speed = 0 }: { source?: RossSource; size?: number; gold?: boolean; speed?: number }) {
  return <HalftoneCmyk
    image={source === 'illustration' ? '/ross-illustration.png' : '/ross-modern-exterior.jpg'}
    colorBack="#FAF9F6" colorC="#2BBAB0" colorM="#0F2B3C" colorY={gold ? '#D4A034' : '#2BBAB0'} colorK="#0F2B3C"
    size={size} type="ink" softness={0.5} contrast={1.05} gridNoise={0.08}
    floodC={0} gainC={0.12} gainM={-0.25} gainY={gold ? -0.4 : -0.65} gainK={-0.12}
    grainMixer={0.04} grainOverlay={0.015} grainSize={0.25}
    speed={speed}
    scale={source === 'detail' ? 1.8 : 1} fit="cover" minPixelRatio={1} maxPixelCount={1400000}
    style={{width:'100%',height:'100%'}}
  />
}

export function AnimatedMark({ effect, paused = false, background = '#FAF9F6' }: { effect: LogoEffect; paused?: boolean; background?: string }) {
  const common = { image: '/logo-mark.svg', colorBack: background, scale: 1.65, fit: 'contain' as const, minPixelRatio: 1, maxPixelCount: 650000, style: { width: '100%', height: '100%' }, speed: paused ? 0 : 0.45, frame: 8000 }
  if (effect === 'heatmap') return <Heatmap {...common} colors={['#0F2B3C','#0B6F68','#2BBAB0','#D4A034','#FAF9F6']} contour={0.55} innerGlow={0.38} outerGlow={0.12} noise={0.015} angle={135} />
  if (effect === 'metal') return <LiquidMetal {...common} colorTint="#8ECBC2" repetition={2} softness={0.3} shiftRed={0} shiftBlue={0} distortion={0.05} contour={0.35} angle={60} />
  return <GemSmoke {...common} colors={['#0F2B3C','#2BBAB0','#D4A034']} colorInner="#0F2B3C" innerDistortion={0.3} outerDistortion={0.3} outerGlow={0.18} innerGlow={0.65} size={0.7} />
}
