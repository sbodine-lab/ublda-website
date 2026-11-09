// Prepares the Vite build in dist/ for GitHub Pages, which only serves static files.
//
// GitHub Pages has no rewrites or custom headers, so this script:
// 1. Copies the CSP and Referrer-Policy from vercel.json into <meta> tags, so the
//    browser still enforces them. (frame-ancestors is ignored in a meta CSP, so it is dropped.)
// 2. Writes dist/404.html so any unknown path still loads the single-page app.
// 3. Writes a copy of index.html for each known route (for example dist/about.html)
//    so those pages return HTTP 200 instead of 404 for visitors, link previews, and search engines.
// 4. Checks that dist/CNAME (copied from public/CNAME) names the ublda.org custom domain.
//
// Usage: node --experimental-strip-types scripts/prepare-github-pages.mjs  (run after `npm run build`)
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AREAS, RESEARCH } from '../src/pages/consulting/research.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const indexPath = path.join(dist, 'index.html')

if (!existsSync(indexPath)) {
  console.error('dist/index.html not found. Run `npm run build` first.')
  process.exit(1)
}

const CUSTOM_DOMAIN = 'ublda.org'

// Routes from src/App.tsx (public pages) plus the entry points of the leadership
// Decision Center. Any other path is still served through 404.html.
const STATIC_ROUTES = [
  'about',
  'events',
  'team',
  'join',
  'brand',
  'links',
  'apply',
  'advisory',
  'unsubscribe',
  'consulting',
  'consulting/apply',
  'consulting/practice',
  'consulting/leadership',
  'consulting/work',
  'consulting/services',
  'consulting/insights',
  'consulting/partners',
  'consulting/contact',
  'housing',
  'housing-intelligence',
  'craft-night',
  'mtc',
  'table',
  'auth/callback',
  'signin',
  'workspace',
  'dashboard',
  'decisions',
  'operations',
  'speaker-ops',
]
const ROUTES = [
  ...STATIC_ROUTES,
  ...AREAS.map((area) => `consulting/services/${area.id}`),
  ...RESEARCH.map((item) => `consulting/insights/${item.id}`),
]

const vercelConfig = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const globalHeaders = vercelConfig.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? []
const headerValue = (key) => globalHeaders.find((header) => header.key === key)?.value

const escapeAttr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

const metaTags = []
const csp = headerValue('Content-Security-Policy')
if (csp) {
  const metaCsp = csp
    .split(';')
    .map((directive) => directive.trim())
    .filter((directive) => directive && !directive.startsWith('frame-ancestors'))
    .join('; ')
  metaTags.push(`<meta http-equiv="Content-Security-Policy" content="${escapeAttr(metaCsp)}" />`)
}
const referrer = headerValue('Referrer-Policy')
if (referrer) metaTags.push(`<meta name="referrer" content="${escapeAttr(referrer)}" />`)

let html = readFileSync(indexPath, 'utf8')
if (metaTags.length && !html.includes('http-equiv="Content-Security-Policy"')) {
  html = html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${metaTags.join('\n    ')}`)
}
// Fail the build rather than ship pages without the security policy.
if (csp && !html.includes('http-equiv="Content-Security-Policy"')) {
  console.error('Could not add the Content-Security-Policy meta tag: <meta charset="UTF-8" /> not found in dist/index.html.')
  process.exit(1)
}
writeFileSync(indexPath, html)
writeFileSync(path.join(dist, '404.html'), html)

for (const route of ROUTES) {
  const target = path.join(dist, `${route}.html`)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, html)
}
// If a route is also a folder (for example /consulting, which has public/consulting/ assets),
// GitHub Pages may redirect /consulting to /consulting/. Give that folder an index.html too;
// the app then drops the trailing slash on its own.
for (const route of ROUTES) {
  const folder = path.join(dist, route)
  if (existsSync(folder) && statSync(folder).isDirectory() && !existsSync(path.join(folder, 'index.html'))) {
    writeFileSync(path.join(folder, 'index.html'), html)
  }
}

const cnamePath = path.join(dist, 'CNAME')
if (!existsSync(cnamePath) || readFileSync(cnamePath, 'utf8').trim() !== CUSTOM_DOMAIN) {
  console.error(`dist/CNAME must contain ${CUSTOM_DOMAIN}. Check public/CNAME.`)
  process.exit(1)
}
writeFileSync(path.join(dist, '.nojekyll'), '')

console.log(`GitHub Pages files ready: 404.html, ${ROUTES.length} route pages, CNAME (${CUSTOM_DOMAIN}).`)
