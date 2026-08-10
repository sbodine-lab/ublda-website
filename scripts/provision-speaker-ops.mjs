import { randomBytes } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSpeakerOpsStore } from '../server/speakerOpsStore.js'
import { SPEAKER_OPS_MEMBERS } from '../src/lib/speakerOps.ts'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const production = process.argv.includes('--production')
const outputFlag = process.argv.indexOf('--output')
const outputPath = outputFlag >= 0 && process.argv[outputFlag + 1]
  ? path.resolve(process.argv[outputFlag + 1])
  : path.join(projectRoot, '.ublda-local-data', 'speaker-ops-credentials.csv')

if (production && !process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error('Production provisioning requires BLOB_READ_WRITE_TOKEN.')
}

const temporaryPassword = () => `Ublda-${randomBytes(12).toString('base64url')}!7`
const credentials = SPEAKER_OPS_MEMBERS.map((member) => ({ ...member, password: temporaryPassword() }))
const passwords = Object.fromEntries(credentials.map((credential) => [credential.email, credential.password]))
const store = createSpeakerOpsStore(undefined, { forceLocal: !production })
const result = await store.provisionAccounts(passwords)

const quoteCsv = (value) => `"${String(value).replaceAll('"', '""')}"`
const csv = [
  ['Name', 'Title', 'Email', 'Temporary password', 'First login'],
  ...credentials.map((credential) => [
    credential.name,
    credential.title,
    credential.email,
    credential.password,
    'Password change required',
  ]),
].map((row) => row.map(quoteCsv).join(',')).join('\n') + '\n'

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, csv, { mode: 0o600 })
await chmod(outputPath, 0o600)

process.stdout.write(JSON.stringify({
  provisioned: result.count,
  target: production ? 'private Vercel Blob' : 'local preview storage',
  credentialsFile: outputPath,
  credentialsMode: '0600',
}) + '\n')
