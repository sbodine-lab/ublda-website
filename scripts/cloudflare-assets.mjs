import { readFile, writeFile } from 'node:fs/promises'

// Keep hosting rules sourced from the current Vercel configuration for rollback.
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
const headers = config.headers.map(({ source, headers }) => {
  const pattern = source === '/(.*)' ? '/*' : source.replace('(.*)', '*')
  return `${pattern}\n${headers.map(({ key, value }) => `  ${key}: ${value}`).join('\n')}`
}).join('\n\n')
// Workers Assets only accepts relative source paths. The www host redirect
// belongs to the separate, tiny canonical-host Worker.
const redirects = config.redirects.filter(({ has }) => !has).map(({ source, destination, permanent }) => {
  const pattern = source.replace(':path*', ':splat')
  const target = destination.replace(':path*', ':splat')
  return `${pattern.replace(':splat', '*')} ${target} ${permanent ? 308 : 307}`
}).join('\n')
await writeFile(new URL('../dist/_headers', import.meta.url), `${headers}\n`)
await writeFile(new URL('../dist/_redirects', import.meta.url), `${redirects}\n`)
