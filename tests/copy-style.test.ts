import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const copyRoots = [
  path.join(process.cwd(), 'src'),
]

const copyStores = [
  path.join(process.cwd(), 'server', 'operationsStore.ts'),
  path.join(process.cwd(), 'server', 'speakerOpsStore.ts'),
]

const bannedCopy = [
  'delve', 'tapestry', 'landscape', 'testament', 'vibrant', 'pivotal', 'crucial', 'intricate',
  'meticulous', 'bolster', 'garner', 'underscore', 'interplay', 'multifaceted', 'leverage',
  'utilize', 'commence', 'facilitate', 'encompass', 'paramount', 'groundbreaking',
  'cutting-edge', 'game-changing', 'transformative', 'revolutionize', 'seamless',
  'robust', 'comprehensive', 'aforementioned', 'harnessing', 'spearheading',
  'showcasing', 'highlighting', 'emphasizing', 'enhancing', 'unprecedented',
  'remarkable', 'stunning', 'profound', 'synergy', 'synergies', 'empower',
  'empowering', 'streamline', 'supercharge',
]

const bannedPhrases = [
  "it's worth noting", "it's important to note", "let's dive", 'at its core',
  'in the realm of', 'at the end of the day', 'in a nutshell', 'moving forward',
  'touch base', 'circle back', 'rest assured', "please don't hesitate",
  'unlock the power', 'take it to the next level',
]

const sourceFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name)
    if (entry.isDirectory()) return sourceFiles(target)
    return /\.(ts|tsx)$/.test(entry.name) ? [target] : []
  }))
  return nested.flat()
}

test('platform copy avoids the installed anti-slop vocabulary', async () => {
  const files = [...(await Promise.all(copyRoots.map(sourceFiles))).flat(), ...copyStores]
  const violations: string[] = []
  for (const file of files) {
    const text = (await readFile(file, 'utf8')).toLowerCase()
    for (const word of bannedCopy) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(text)) violations.push(`${path.relative(process.cwd(), file)}: ${word}`)
    }
    for (const phrase of bannedPhrases) {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) violations.push(`${path.relative(process.cwd(), file)}: ${phrase}`)
    }
  }
  assert.deepEqual(violations, [])
})
