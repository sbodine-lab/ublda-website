import { useState } from 'react'
import './Brand.css'

function CopyHex({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className="brand-copy" onClick={copy} title="Copy hex">
      {copied ? 'Copied!' : hex}
    </button>
  )
}

function ColorSwatch({ name, hex, token, usage, light }: { name: string; hex: string; token: string; usage: string; light?: boolean }) {
  return (
    <div className="brand-swatch">
      <div className="brand-swatch__preview" style={{ background: hex }}>
        <span className={`brand-swatch__label ${light ? 'brand-swatch__label--dark' : ''}`}>{name}</span>
      </div>
      <div className="brand-swatch__info">
        <CopyHex hex={hex} />
        <span className="brand-swatch__token">{token}</span>
        <span className="brand-swatch__usage">{usage}</span>
      </div>
    </div>
  )
}

export default function Brand() {
  return (
    <main className="brand" id="main-content">
      {/* ── Hero ── */}
      <section className="brand-hero">
        <div className="brand-container">
          <span className="brand-hero__label">Internal Resource</span>
          <h1 className="brand-hero__title">Brand Guide</h1>
          <p className="brand-hero__sub">
            Everything you need to create consistent, on-brand materials for UBLDA -
            from social media posts to slide decks.
          </p>
        </div>
      </section>

      {/* ── Table of Contents ── */}
      <nav className="brand-toc">
        <div className="brand-container">
          <div className="brand-toc__grid">
            {[
              ['#colors', 'Colors'],
              ['#typography', 'Typography'],
              ['#logo', 'Logo'],
              ['#buttons', 'Buttons & Components'],
              ['#instagram', 'Instagram Posts'],
              ['#social', 'Social Media'],
              ['#slides', 'Slide Decks'],
              ['#voice', 'Brand Voice'],
              ['#downloads', 'Quick Reference'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="brand-toc__link">{label}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Colors ── */}
      <section className="brand-section" id="colors">
        <div className="brand-container">
          <h2 className="brand-section__title">Color Palette</h2>
          <p className="brand-section__desc">Click any hex code to copy it. Use these exact colors across all materials.</p>

          <h3 className="brand-subsection">Primary Colors</h3>
          <div className="brand-swatch-grid">
            <ColorSwatch name="Navy" hex="#0F2B3C" token="--color-navy" usage="Headings, text, backgrounds, primary buttons" />
            <ColorSwatch name="Teal" hex="#2BBAB0" token="--color-teal" usage="Accent, CTAs, highlights, italic emphasis" />
            <ColorSwatch name="Gold" hex="#D4A034" token="--color-gold" usage="Tertiary accent, sparingly for warmth" />
            <ColorSwatch name="Cream" hex="#FAF9F6" token="--color-cream" usage="Page background, light sections" light />
          </div>

          <h3 className="brand-subsection">Extended Palette</h3>
          <div className="brand-swatch-grid">
            <ColorSwatch name="Navy Deep" hex="#091E2A" token="--color-navy-deep" usage="Footer, dark sections" />
            <ColorSwatch name="Navy Light" hex="#1A3D52" token="--color-navy-light" usage="Button hover, lighter dark" />
            <ColorSwatch name="Teal Soft" hex="#2BBAB018" token="--color-teal-soft" usage="Subtle teal tints (10% opacity)" />
            <ColorSwatch name="Gold Soft" hex="#D4A03415" token="--color-gold-soft" usage="Subtle gold tints (8% opacity)" />
          </div>

          <h3 className="brand-subsection">Neutrals</h3>
          <div className="brand-swatch-grid brand-swatch-grid--sm">
            <ColorSwatch name="White" hex="#FFFFFF" token="--color-white" usage="Backgrounds, text on dark" light />
            <ColorSwatch name="Gray 50" hex="#F5F4F1" token="--color-gray-50" usage="Subtle backgrounds" light />
            <ColorSwatch name="Gray 100" hex="#EDECE8" token="--color-gray-100" usage="Borders, dividers" light />
            <ColorSwatch name="Gray 200" hex="#D8D6D0" token="--color-gray-200" usage="Secondary text on dark" light />
            <ColorSwatch name="Gray 400" hex="#706D65" token="--color-gray-400" usage="Muted text" />
            <ColorSwatch name="Gray 600" hex="#6B6860" token="--color-gray-600" usage="Body text" />
            <ColorSwatch name="Gray 800" hex="#3A3832" token="--color-gray-800" usage="Heavy body text" />
            <ColorSwatch name="Gray 900" hex="#1E1D1A" token="--color-gray-900" usage="Near-black text" />
          </div>

          <div className="brand-tip">
            <strong>Accessibility note:</strong> Always maintain a 4.5:1 contrast ratio for body text, 3:1 for large text.
            Navy on cream and white on navy both pass WCAG AA.
          </div>
        </div>
      </section>

      {/* ── Typography ── */}
      <section className="brand-section brand-section--alt" id="typography">
        <div className="brand-container">
          <h2 className="brand-section__title">Typography</h2>
          <p className="brand-section__desc">Two fonts. Use them consistently and never substitute.</p>

          <div className="brand-type-pair">
            <div className="brand-type-card">
              <span className="brand-type-card__label">Display Font</span>
              <h3 className="brand-type-card__sample brand-type-card__sample--display">
                Instrument Serif
              </h3>
              <p className="brand-type-card__meta">
                Google Fonts &middot; Regular 400 &middot; Italic for accents
              </p>
              <p className="brand-type-card__use">
                Headlines, hero text, section titles, pull quotes, event titles
              </p>
              <div className="brand-type-card__specimen">
                <span style={{ fontSize: '3rem' }}>Aa</span>
                <span style={{ fontSize: '3rem', fontStyle: 'italic' }}>Aa</span>
                <span className="brand-type-card__chars">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789</span>
              </div>
            </div>

            <div className="brand-type-card">
              <span className="brand-type-card__label">Body Font</span>
              <h3 className="brand-type-card__sample brand-type-card__sample--body">
                Plus Jakarta Sans
              </h3>
              <p className="brand-type-card__meta">
                Google Fonts &middot; Weights: 400, 500, 600, 700
              </p>
              <p className="brand-type-card__use">
                Body text, navigation, buttons, labels, captions, form fields
              </p>
              <div className="brand-type-card__specimen">
                <span style={{ fontSize: '2rem', fontWeight: 400 }}>Aa</span>
                <span style={{ fontSize: '2rem', fontWeight: 500 }}>Aa</span>
                <span style={{ fontSize: '2rem', fontWeight: 600 }}>Aa</span>
                <span style={{ fontSize: '2rem', fontWeight: 700 }}>Aa</span>
                <span className="brand-type-card__chars">ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789</span>
              </div>
            </div>
          </div>

          <h3 className="brand-subsection">Type Scale</h3>
          <div className="brand-type-scale">
            {[
              ['7xl', '6rem / 96px', 'Hero headlines (web only)'],
              ['6xl', '4.5rem / 72px', 'Large hero text'],
              ['5xl', '3.5rem / 56px', 'Page titles'],
              ['4xl', '2.75rem / 44px', 'Section headings'],
              ['3xl', '2rem / 32px', 'Sub-headings'],
              ['2xl', '1.5rem / 24px', 'Card titles, large body'],
              ['xl', '1.25rem / 20px', 'Lead paragraphs'],
              ['lg', '1.125rem / 18px', 'Body large'],
              ['base', '1rem / 16px', 'Default body text'],
              ['sm', '0.9375rem / 15px', 'Secondary text'],
              ['xs', '0.875rem / 14px', 'Labels, captions, fine print'],
            ].map(([name, size, use]) => (
              <div key={name} className="brand-type-scale__row">
                <span className="brand-type-scale__name">{name}</span>
                <span className="brand-type-scale__size">{size}</span>
                <span className="brand-type-scale__preview" style={{ fontSize: name === '7xl' ? '3rem' : name === '6xl' ? '2.5rem' : name === '5xl' ? '2rem' : undefined }}>
                  {name === 'xs' || name === 'sm' || name === 'base' || name === 'lg' || name === 'xl' ? (
                    <span style={{ fontFamily: 'var(--font-body)' }}>The quick brown fox</span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-display)' }}>The quick brown fox</span>
                  )}
                </span>
                <span className="brand-type-scale__use">{use}</span>
              </div>
            ))}
          </div>

          <div className="brand-tip">
            <strong>Teal italic pattern:</strong> On the website, we style select words in <em style={{ color: '#2BBAB0', fontFamily: 'var(--font-display)' }}>teal italic</em> using Instrument Serif
            to add emphasis. Use this same pattern in social posts and slides for key words like
            <em style={{ color: '#2BBAB0', fontFamily: 'var(--font-display)' }}> inclusion</em>,
            <em style={{ color: '#2BBAB0', fontFamily: 'var(--font-display)' }}> belonging</em>,
            <em style={{ color: '#2BBAB0', fontFamily: 'var(--font-display)' }}> for everyone</em>.
          </div>
        </div>
      </section>

      {/* ── Logo ── */}
      <section className="brand-section" id="logo">
        <div className="brand-container">
          <h2 className="brand-section__title">Logo</h2>
          <p className="brand-section__desc">Our logo is a custom mark. Always use the official PNG files - never recreate it.</p>

          <div className="brand-logo-grid">
            <div className="brand-logo-card">
              <div className="brand-logo-card__preview">
                <img src="/logo.png" alt="UBLDA logo" className="brand-logo-card__img" />
              </div>
              <span className="brand-logo-card__label">Primary - on light backgrounds</span>
            </div>
            <div className="brand-logo-card brand-logo-card--dark">
              <div className="brand-logo-card__preview brand-logo-card__preview--dark">
                <img src="/logo.png" alt="UBLDA logo on dark" className="brand-logo-card__img" />
              </div>
              <span className="brand-logo-card__label">On dark backgrounds</span>
            </div>
          </div>

          <h3 className="brand-subsection">Logo + Wordmark</h3>
          <div className="brand-logo-lockup">
            <div className="brand-logo-lockup__preview">
              <img src="/logo.png" alt="UBLDA logo" className="brand-logo-lockup__img" />
              <span className="brand-logo-lockup__text">UBLDA</span>
            </div>
            <p className="brand-logo-lockup__note">
              When using the logo with text, use Plus Jakarta Sans Bold, uppercase, with 0.1em letter-spacing.
            </p>
          </div>

          <h3 className="brand-subsection">Logo Usage Rules</h3>
          <div className="brand-rules-grid">
            <div className="brand-rule brand-rule--do">
              <span className="brand-rule__badge">Do</span>
              <ul>
                <li>Use the original PNG with transparent background</li>
                <li>Maintain proportions when scaling</li>
                <li>Give the logo adequate breathing room (min 16px)</li>
                <li>Use on solid cream, white, or navy backgrounds</li>
              </ul>
            </div>
            <div className="brand-rule brand-rule--dont">
              <span className="brand-rule__badge">Don't</span>
              <ul>
                <li>Recreate or redraw the logo as SVG or vector</li>
                <li>Stretch, rotate, or skew the logo</li>
                <li>Place on busy photos without overlay</li>
                <li>Change the logo colors</li>
                <li>Add effects (drop shadow, glow, bevel)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Buttons & Components ── */}
      <section className="brand-section brand-section--alt" id="buttons">
        <div className="brand-container">
          <h2 className="brand-section__title">Buttons & Components</h2>
          <p className="brand-section__desc">Reusable patterns for the website and graphic materials.</p>

          <h3 className="brand-subsection">Button Styles</h3>
          <div className="brand-buttons-showcase">
            <div className="brand-button-demo">
              <button className="brand-btn brand-btn--primary">Primary Navy</button>
              <code>Navy bg, white text, rounded-full, 600 weight</code>
            </div>
            <div className="brand-button-demo">
              <button className="brand-btn brand-btn--teal">Teal CTA</button>
              <code>Teal bg, navy text, rounded-full, 600 weight</code>
            </div>
            <div className="brand-button-demo">
              <button className="brand-btn brand-btn--ghost">Ghost Button</button>
              <code>Transparent, gray-600 border, hover to navy</code>
            </div>
            <div className="brand-button-demo">
              <button className="brand-btn brand-btn--ghost-white">Ghost White</button>
              <code>On dark bg, white border, white text</code>
            </div>
          </div>

          <h3 className="brand-subsection">Card Styles</h3>
          <div className="brand-cards-showcase">
            <div className="brand-card-demo brand-card-demo--glass">
              <h4>Glass Card</h4>
              <p>Frosted glass with blur + saturation backdrop-filter. Used for pillars, features, value cards.</p>
              <code>background: rgba(255,255,255,0.6), backdrop-filter: blur(20px) saturate(180%), border: 1px solid rgba(255,255,255,0.3)</code>
            </div>
            <div className="brand-card-demo brand-card-demo--navy">
              <h4>Navy Card</h4>
              <p>Dark navy background with white/teal text. Used for CTAs, featured events, program cards.</p>
              <code>background: #0F2B3C, color: white, border-radius: 1rem</code>
            </div>
            <div className="brand-card-demo brand-card-demo--outline">
              <h4>Outlined Card</h4>
              <p>Clean white card with subtle border. Used for team members, FAQ items.</p>
              <code>background: white, border: 1px solid #EDECE8, border-radius: 0.75rem</code>
            </div>
          </div>

          <h3 className="brand-subsection">Section Labels</h3>
          <div className="brand-label-demo">
            <span className="brand-section-label">Section Label</span>
            <code>Uppercase, Plus Jakarta Sans 600, xs size, tracking-wider, teal left border (3px)</code>
          </div>

          <h3 className="brand-subsection">Teal Italic Accent</h3>
          <div className="brand-accent-demo">
            <h3 className="brand-accent-demo__text">
              Business gets better when more people are{' '}
              <em>in the room</em>.
            </h3>
            <code>Instrument Serif italic in teal (#2BBAB0) for emphasized words within navy headlines</code>
          </div>
        </div>
      </section>

      {/* ── Instagram Posts ── */}
      <section className="brand-section" id="instagram">
        <div className="brand-container">
          <h2 className="brand-section__title">Instagram Posts</h2>
          <p className="brand-section__desc">
            Templates and guidelines for creating on-brand Instagram content. All posts should feel
            clean, editorial, and mission-driven - like our website.
          </p>

          <h3 className="brand-subsection">Post Dimensions</h3>
          <div className="brand-dimensions-grid">
            <div className="brand-dimension">
              <div className="brand-dimension__preview brand-dimension__preview--square">
                <span>1:1</span>
              </div>
              <strong>Square Post</strong>
              <span>1080 &times; 1080px</span>
              <span className="brand-dimension__use">Feed posts, announcements</span>
            </div>
            <div className="brand-dimension">
              <div className="brand-dimension__preview brand-dimension__preview--portrait">
                <span>4:5</span>
              </div>
              <strong>Portrait Post</strong>
              <span>1080 &times; 1350px</span>
              <span className="brand-dimension__use">Tall feed posts, max visibility</span>
            </div>
            <div className="brand-dimension">
              <div className="brand-dimension__preview brand-dimension__preview--story">
                <span>9:16</span>
              </div>
              <strong>Story / Reel</strong>
              <span>1080 &times; 1920px</span>
              <span className="brand-dimension__use">Stories, reels, vertical video</span>
            </div>
            <div className="brand-dimension">
              <div className="brand-dimension__preview brand-dimension__preview--carousel">
                <span>1:1</span>
              </div>
              <strong>Carousel Slide</strong>
              <span>1080 &times; 1080px</span>
              <span className="brand-dimension__use">Multi-slide educational content</span>
            </div>
          </div>

          <h3 className="brand-subsection">Post Type Templates</h3>
          <div className="brand-ig-templates">
            {/* Event Announcement */}
            <div className="brand-ig-template">
              <div className="brand-ig-mock brand-ig-mock--event">
                <div className="brand-ig-mock__top">
                  <span className="brand-ig-mock__label">Upcoming Event</span>
                </div>
                <div className="brand-ig-mock__body">
                  <h3>Fireside Chat<br /><em>with Andrew Parker</em></h3>
                  <div className="brand-ig-mock__details">
                    <span>Mar 11, 2026</span>
                    <span>Ross R1230</span>
                  </div>
                </div>
                <div className="brand-ig-mock__footer">
                  <img src="/logo.png" alt="" className="brand-ig-mock__logo" />
                  <span>UBLDA</span>
                </div>
              </div>
              <div className="brand-ig-template__info">
                <h4>Event Announcement</h4>
                <ul>
                  <li>Navy background (#0F2B3C)</li>
                  <li>Instrument Serif headline, teal italic for speaker/topic</li>
                  <li>Date + location in Plus Jakarta Sans</li>
                  <li>Logo + wordmark in bottom corner</li>
                  <li>Keep it minimal - one event per post</li>
                </ul>
              </div>
            </div>

            {/* Quote / Mission */}
            <div className="brand-ig-template">
              <div className="brand-ig-mock brand-ig-mock--quote">
                <div className="brand-ig-mock__body">
                  <h3>"Disability inclusion should be built into business - <em>not bolted on</em>."</h3>
                </div>
                <div className="brand-ig-mock__footer">
                  <img src="/logo.png" alt="" className="brand-ig-mock__logo" />
                  <span>UBLDA</span>
                </div>
              </div>
              <div className="brand-ig-template__info">
                <h4>Quote / Mission Post</h4>
                <ul>
                  <li>Cream background (#FAF9F6)</li>
                  <li>Navy Instrument Serif text, centered</li>
                  <li>Teal italic for key phrase</li>
                  <li>Logo at bottom</li>
                  <li>Great for quotes, stats, mission statements</li>
                </ul>
              </div>
            </div>

            {/* Member Spotlight */}
            <div className="brand-ig-template">
              <div className="brand-ig-mock brand-ig-mock--spotlight">
                <div className="brand-ig-mock__top">
                  <span className="brand-ig-mock__label brand-ig-mock__label--teal">Member Spotlight</span>
                </div>
                <div className="brand-ig-mock__body">
                  <div className="brand-ig-mock__avatar">SB</div>
                  <h3>Sam Bodine</h3>
                  <p>Co-President</p>
                </div>
                <div className="brand-ig-mock__footer">
                  <img src="/logo.png" alt="" className="brand-ig-mock__logo" />
                  <span>UBLDA</span>
                </div>
              </div>
              <div className="brand-ig-template__info">
                <h4>Member Spotlight</h4>
                <ul>
                  <li>Navy background with teal accents</li>
                  <li>Initials avatar circle (matching website)</li>
                  <li>Name in Instrument Serif, role in Jakarta Sans</li>
                  <li>Optionally include a photo instead of initials</li>
                  <li>Add a quote or fun fact in the caption</li>
                </ul>
              </div>
            </div>

            {/* Carousel Cover */}
            <div className="brand-ig-template">
              <div className="brand-ig-mock brand-ig-mock--carousel-cover">
                <div className="brand-ig-mock__body">
                  <h3>3 Ways to Make Your Business <em>More Accessible</em></h3>
                  <p className="brand-ig-mock__swipe">Swipe &rarr;</p>
                </div>
                <div className="brand-ig-mock__footer">
                  <img src="/logo.png" alt="" className="brand-ig-mock__logo" />
                  <span>UBLDA</span>
                </div>
              </div>
              <div className="brand-ig-template__info">
                <h4>Carousel Cover Slide</h4>
                <ul>
                  <li>Cream or navy background</li>
                  <li>Bold Instrument Serif headline</li>
                  <li>Teal italic for key phrase</li>
                  <li>"Swipe" indicator in Plus Jakarta Sans</li>
                  <li>Interior slides: one idea per slide, numbered</li>
                  <li>Final slide: CTA ("Follow @ublda for more")</li>
                </ul>
              </div>
            </div>
          </div>

          <h3 className="brand-subsection">Instagram Color Combos</h3>
          <div className="brand-combos">
            <div className="brand-combo">
              <div className="brand-combo__preview" style={{ background: '#0F2B3C', color: '#fff' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>
                  Navy + <span style={{ color: '#2BBAB0', fontStyle: 'italic' }}>Teal</span>
                </span>
              </div>
              <span>Primary combo - most posts</span>
            </div>
            <div className="brand-combo">
              <div className="brand-combo__preview" style={{ background: '#FAF9F6', color: '#0F2B3C' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>
                  Cream + <span style={{ color: '#2BBAB0', fontStyle: 'italic' }}>Teal</span>
                </span>
              </div>
              <span>Light/clean - quotes, stats</span>
            </div>
            <div className="brand-combo">
              <div className="brand-combo__preview" style={{ background: '#2BBAB0', color: '#0F2B3C' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>
                  Teal + Navy
                </span>
              </div>
              <span>Bold accent - special announcements</span>
            </div>
            <div className="brand-combo">
              <div className="brand-combo__preview" style={{ background: '#0F2B3C', color: '#D4A034' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>
                  Navy + Gold
                </span>
              </div>
              <span>Premium feel - awards, milestones</span>
            </div>
          </div>

          <div className="brand-tip">
            <strong>Photo posts:</strong> When using photos, add a semi-transparent navy overlay
            (rgba(15, 43, 60, 0.7)) so text remains readable. Keep text minimal on photo posts.
          </div>
        </div>
      </section>

      {/* ── Social Media ── */}
      <section className="brand-section brand-section--alt" id="social">
        <div className="brand-container">
          <h2 className="brand-section__title">Social Media Guidelines</h2>
          <p className="brand-section__desc">Consistent presence across all platforms.</p>

          <h3 className="brand-subsection">Profile & Cover Images</h3>
          <div className="brand-social-sizes">
            <div className="brand-social-size">
              <h4>Instagram Profile</h4>
              <span className="brand-social-size__dim">320 &times; 320px</span>
              <p>Use the logo mark on a navy circle background. No text - it's too small to read.</p>
            </div>
            <div className="brand-social-size">
              <h4>LinkedIn Banner</h4>
              <span className="brand-social-size__dim">1584 &times; 396px</span>
              <p>Navy background, logo + "Undergraduate Business Leaders for Diverse Abilities" in cream. Optional teal accent line.</p>
            </div>
            <div className="brand-social-size">
              <h4>LinkedIn Profile</h4>
              <span className="brand-social-size__dim">400 &times; 400px</span>
              <p>Same as Instagram - logo mark on navy circle.</p>
            </div>
            <div className="brand-social-size">
              <h4>Email Header</h4>
              <span className="brand-social-size__dim">600 &times; 200px</span>
              <p>Logo + wordmark centered on cream or navy background.</p>
            </div>
          </div>

          <h3 className="brand-subsection">Caption Style</h3>
          <div className="brand-caption-guide">
            <div className="brand-caption-example">
              <div className="brand-caption-example__mock">
                <p>
                  <strong>Join us this Tuesday for a conversation on accessible design in business.</strong>
                </p>
                <p>
                  Our Fireside Chat series brings industry leaders to Ross to share how they're making their organizations more inclusive.
                </p>
                <p>
                  RSVP at the link in bio.
                </p>
                <p className="brand-caption-example__tags">
                  #DisabilityInclusion #AccessibleBusiness #RossSchool #UBLDA #UMich
                </p>
              </div>
              <ul className="brand-caption-example__rules">
                <li><strong>Tone:</strong> Warm, confident, mission-driven. Not corporate, not overly casual.</li>
                <li><strong>Structure:</strong> Hook line (bold if possible) → Context → CTA</li>
                <li><strong>Length:</strong> 2-4 short paragraphs. Break up walls of text.</li>
                <li><strong>Hashtags:</strong> 5-8 relevant tags. Always include #UBLDA #UMich</li>
                <li><strong>Emojis:</strong> Sparingly - 1-2 max. Never in place of words.</li>
                <li><strong>CTA:</strong> Always include a clear call to action</li>
              </ul>
            </div>
          </div>

          <h3 className="brand-subsection">Story Highlights</h3>
          <div className="brand-highlights">
            <p>Story highlight covers use teal icons on a navy circle. Right-click any cover below to save it.</p>
            <div className="brand-highlights__grid">
              {['Events', 'Team', 'Resources', 'Join', 'About'].map(name => (
                <div key={name} className="brand-highlight-icon">
                  <a href={`/highlights/${name.toLowerCase()}.svg`} download={`ublda-highlight-${name.toLowerCase()}.svg`} className="brand-highlight-icon__link">
                    <img
                      src={`/highlights/${name.toLowerCase()}.svg`}
                      alt={`${name} highlight cover`}
                      className="brand-highlight-icon__img"
                    />
                  </a>
                  <span>{name}</span>
                  <a href={`/highlights/${name.toLowerCase()}.svg`} download={`ublda-highlight-${name.toLowerCase()}.svg`} className="brand-highlight-icon__download">
                    Download SVG
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Slide Decks ── */}
      <section className="brand-section" id="slides">
        <div className="brand-container">
          <h2 className="brand-section__title">Slide Decks & Presentations</h2>
          <p className="brand-section__desc">Guidelines for meetings, GBMs, and external presentations.</p>

          <h3 className="brand-subsection">Slide Templates</h3>
          <div className="brand-slides-grid">
            <div className="brand-slide-mock brand-slide-mock--title">
              <div className="brand-slide-mock__content">
                <img src="/logo.png" alt="" className="brand-slide-mock__logo" />
                <h3>Presentation Title</h3>
                <p>Subtitle or date goes here</p>
              </div>
              <span className="brand-slide-mock__label">Title Slide</span>
              <div className="brand-slide-mock__spec">
                Navy bg, logo centered, Instrument Serif title, Jakarta Sans subtitle
              </div>
            </div>

            <div className="brand-slide-mock brand-slide-mock--content">
              <div className="brand-slide-mock__content">
                <h3>Section Heading</h3>
                <ul>
                  <li>Key point one</li>
                  <li>Key point two</li>
                  <li>Key point three</li>
                </ul>
              </div>
              <span className="brand-slide-mock__label">Content Slide</span>
              <div className="brand-slide-mock__spec">
                Cream bg, navy text, Instrument Serif heading, Jakarta Sans body, teal accents
              </div>
            </div>

            <div className="brand-slide-mock brand-slide-mock--section">
              <div className="brand-slide-mock__content">
                <h3><em>Advocacy</em><br />& Community</h3>
              </div>
              <span className="brand-slide-mock__label">Section Divider</span>
              <div className="brand-slide-mock__spec">
                Navy bg, large Instrument Serif text, teal italic accent word
              </div>
            </div>

            <div className="brand-slide-mock brand-slide-mock--closing">
              <div className="brand-slide-mock__content">
                <h3>Thank You</h3>
                <p>ublda@umich.edu</p>
                <img src="/logo.png" alt="" className="brand-slide-mock__logo" />
              </div>
              <span className="brand-slide-mock__label">Closing Slide</span>
              <div className="brand-slide-mock__spec">
                Navy bg, centered, contact info, logo
              </div>
            </div>
          </div>

          <h3 className="brand-subsection">Slide Design Rules</h3>
          <div className="brand-rules-grid">
            <div className="brand-rule brand-rule--do">
              <span className="brand-rule__badge">Do</span>
              <ul>
                <li>Use 16:9 aspect ratio (1920 &times; 1080px)</li>
                <li>Limit text - aim for 6 words per line, 6 lines per slide max</li>
                <li>Use large type (min 24px body, 48px+ headings)</li>
                <li>Use plenty of white space</li>
                <li>Add the UBLDA logo on the first and last slide</li>
                <li>Use teal italic for emphasis words</li>
              </ul>
            </div>
            <div className="brand-rule brand-rule--dont">
              <span className="brand-rule__badge">Don't</span>
              <ul>
                <li>Overload slides with text</li>
                <li>Use templates from other orgs</li>
                <li>Use fonts other than Instrument Serif / Jakarta Sans</li>
                <li>Use colors outside the palette</li>
                <li>Add unnecessary clip art or stock icons</li>
                <li>Use gradients except subtle navy-to-navy-deep</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Brand Voice ── */}
      <section className="brand-section brand-section--alt" id="voice">
        <div className="brand-container">
          <h2 className="brand-section__title">Brand Voice</h2>
          <p className="brand-section__desc">How UBLDA sounds across all communications.</p>

          <div className="brand-voice-grid">
            <div className="brand-voice-card">
              <h4>Confident, Not Aggressive</h4>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__yes">Yes:</span> "We're building a business world where disability inclusion is the standard."
              </div>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__no">No:</span> "It's time to DEMAND that business includes disabled people!!!"
              </div>
            </div>

            <div className="brand-voice-card">
              <h4>Warm, Not Casual</h4>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__yes">Yes:</span> "Join our community of students working toward inclusive business practices."
              </div>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__no">No:</span> "Come hang!! We're super chill and love having a good time lol"
              </div>
            </div>

            <div className="brand-voice-card">
              <h4>Mission-Driven, Not Preachy</h4>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__yes">Yes:</span> "Disability inclusion should be built into business - not bolted on."
              </div>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__no">No:</span> "If you don't think about disability inclusion, you're part of the problem."
              </div>
            </div>

            <div className="brand-voice-card">
              <h4>Professional, Not Corporate</h4>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__yes">Yes:</span> "We partner with organizations to create actionable accessibility solutions."
              </div>
              <div className="brand-voice-card__example">
                <span className="brand-voice-card__no">No:</span> "We leverage synergistic paradigms to optimize stakeholder engagement."
              </div>
            </div>
          </div>

          <h3 className="brand-subsection">Key Phrases</h3>
          <div className="brand-phrases">
            {[
              'Disability inclusion in business',
              'Built into business - not bolted on',
              'Business gets better when more people are in the room',
              'Undergraduate Business Leaders for Diverse Abilities',
              'Advocacy, consulting, and professional development',
              'Ross School of Business, University of Michigan',
            ].map(phrase => (
              <span key={phrase} className="brand-phrase">{phrase}</span>
            ))}
          </div>

          <h3 className="brand-subsection">Language Guidelines</h3>
          <div className="brand-language">
            <div className="brand-language__item">
              <h4>Identity-First vs. Person-First</h4>
              <p>
                We respect individual preferences. Default to "disabled people" (identity-first) which is
                preferred by many in the disability community, but honor individual preferences when known.
                Never say "differently abled," "special needs," or "handicapped."
              </p>
            </div>
            <div className="brand-language__item">
              <h4>Organization Name</h4>
              <p>
                Full name on first reference: "Undergraduate Business Leaders for Diverse Abilities (UBLDA)."
                After that, "UBLDA" is fine. Never "U.B.L.D.A." with periods.
              </p>
            </div>
            <div className="brand-language__item">
              <h4>University References</h4>
              <p>
                "Ross School of Business" or "Michigan Ross" - never just "Ross" without context.
                "University of Michigan" or "UMich" - never "U of M" or "UM."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quick Reference ── */}
      <section className="brand-section" id="downloads">
        <div className="brand-container">
          <h2 className="brand-section__title">Quick Reference</h2>
          <p className="brand-section__desc">Copy-paste cheat sheet for common design tasks.</p>

          <div className="brand-cheatsheet">
            <div className="brand-cheat">
              <h4>Figma / Canva Setup</h4>
              <table>
                <tbody>
                  <tr><td>Display Font</td><td>Instrument Serif (Google Fonts)</td></tr>
                  <tr><td>Body Font</td><td>Plus Jakarta Sans (Google Fonts)</td></tr>
                  <tr><td>Navy</td><td>#0F2B3C</td></tr>
                  <tr><td>Teal</td><td>#2BBAB0</td></tr>
                  <tr><td>Gold</td><td>#D4A034</td></tr>
                  <tr><td>Cream</td><td>#FAF9F6</td></tr>
                  <tr><td>IG Post</td><td>1080 &times; 1080px</td></tr>
                  <tr><td>IG Story</td><td>1080 &times; 1920px</td></tr>
                  <tr><td>Slides</td><td>1920 &times; 1080px (16:9)</td></tr>
                </tbody>
              </table>
            </div>

            <div className="brand-cheat">
              <h4>CSS Variables</h4>
              <pre className="brand-code">{`/* Colors */
--color-navy:      #0F2B3C
--color-teal:      #2BBAB0
--color-gold:      #D4A034
--color-cream:     #FAF9F6

/* Fonts */
--font-display: 'Instrument Serif'
--font-body:    'Plus Jakarta Sans'

/* Radius */
--radius-md:   0.75rem
--radius-lg:   1rem
--radius-full: 9999px`}</pre>
            </div>

            <div className="brand-cheat">
              <h4>Contact</h4>
              <table>
                <tbody>
                  <tr><td>General</td><td>ublda@umich.edu</td></tr>
                  <tr><td>Sam Bodine</td><td>sbodine@umich.edu</td></tr>
                  <tr><td>Alexa Chiang</td><td>achiang@umich.edu</td></tr>
                  <tr><td>Instagram</td><td>@ublda</td></tr>
                  <tr><td>LinkedIn</td><td>/company/ublda</td></tr>
                  <tr><td>Website</td><td>ublda.org</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="brand-page-footer">
        <div className="brand-container">
          <p>
            This guide is an internal resource for UBLDA members creating branded materials.
            Questions? Reach out to the exec team.
          </p>
        </div>
      </div>
    </main>
  )
}
