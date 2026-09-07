import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import {
  BBA_MTC_ROSTER,
  BBA_MTC_SHIFT_IDS,
  type BbaMtcPollState,
  type BbaMtcResponse,
} from '../src/lib/bbaMtcShifts.ts'

type StoredData = {
  version: 1
  responses: Record<string, BbaMtcResponse>
}

type ServiceResult = { status: number; body: Record<string, unknown> }

const BLOB_PATH = 'bba-mtc-2026/shifts.json'
const WRITE_ATTEMPTS = 5
const queues = new Map<string, Promise<unknown>>()
const shiftIds = new Set<string>(BBA_MTC_SHIFT_IDS)
const rosterByEmail = new Map(BBA_MTC_ROSTER.map((member) => [member.email, member]))

const dataPath = () => process.env.UBLDA_BBA_MTC_DATA_FILE
  ? path.resolve(process.env.UBLDA_BBA_MTC_DATA_FILE)
  : path.join(process.cwd(), '.ublda-local-data', 'bba-mtc-2026.json')

const canUseBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const emptyData = (): StoredData => ({ version: 1, responses: {} })

const normalizeData = (raw: unknown): StoredData => {
  const data = raw && typeof raw === 'object' ? raw as Partial<StoredData> : {}
  const responses: StoredData['responses'] = {}
  for (const [email, response] of Object.entries(data.responses || {})) {
    const member = rosterByEmail.get(email as never)
    if (!member || !response || typeof response !== 'object') continue
    responses[email] = {
      name: member.name,
      email: member.email,
      shifts: Array.isArray(response.shifts)
        ? [...new Set(response.shifts.filter((id): id is string => typeof id === 'string' && shiftIds.has(id)))]
        : [],
      updatedAt: typeof response.updatedAt === 'string' ? response.updatedAt : new Date(0).toISOString(),
    }
  }
  return { version: 1, responses }
}

const readLocal = async (): Promise<StoredData> => {
  try {
    return normalizeData(JSON.parse(await readFile(dataPath(), 'utf8')))
  } catch {
    return emptyData()
  }
}

const writeLocal = async (data: StoredData) => {
  const target = dataPath()
  await mkdir(path.dirname(target), { recursive: true })
  const tempPath = `${target}.${process.pid}.${randomBytes(5).toString('base64url')}.tmp`
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
  await rename(tempPath, target)
}

const readBlob = async () => {
  const blob = await get(BLOB_PATH, { access: 'private', useCache: false })
  if (!blob || blob.statusCode !== 200) return { data: emptyData(), etag: null as string | null }
  const raw = await new Response(blob.stream).text()
  const etag = blob.blob.etag?.replace(/^W\//, '') || null
  try {
    return { data: normalizeData(JSON.parse(raw)), etag }
  } catch {
    return { data: emptyData(), etag }
  }
}

const writeBlob = async (data: StoredData, etag: string | null) => {
  await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}\n`, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: Boolean(etag),
    contentType: 'application/json',
    ...(etag ? { ifMatch: etag } : {}),
  })
}

const publicState = (data: StoredData): BbaMtcPollState => ({
  responses: Object.values(data.responses).sort((a, b) => a.name.localeCompare(b.name)),
})

const readData = async () => (canUseBlob() ? (await readBlob()).data : await readLocal())

const updateData = async (email: string, shifts: string[], now: () => Date): Promise<ServiceResult> => {
  const key = canUseBlob() ? BLOB_PATH : dataPath()
  const previous = queues.get(key) || Promise.resolve()
  const task = previous.catch(() => undefined).then(async () => {
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
      const current = canUseBlob() ? await readBlob() : { data: await readLocal(), etag: null }
      const member = rosterByEmail.get(email as never)!
      current.data.responses[email] = {
        name: member.name,
        email: member.email,
        shifts,
        updatedAt: now().toISOString(),
      }
      try {
        if (canUseBlob()) await writeBlob(current.data, current.etag)
        else await writeLocal(current.data)
        return { status: 200, body: { success: true, poll: publicState(current.data) } }
      } catch (error) {
        if (!(error instanceof BlobPreconditionFailedError) || attempt === WRITE_ATTEMPTS - 1) throw error
      }
    }
    throw new Error('Shift signup could not be updated.')
  })
  queues.set(key, task)
  try {
    return await task as ServiceResult
  } finally {
    if (queues.get(key) === task) queues.delete(key)
  }
}

export const getBbaMtcShiftState = async (): Promise<ServiceResult> => (
  { status: 200, body: { poll: publicState(await readData()) } }
)

export const handleBbaMtcShiftAction = async (
  body: Record<string, unknown>,
  now: () => Date = () => new Date(),
): Promise<ServiceResult> => {
  if (body.action !== 'respond') return { status: 400, body: { error: 'Unknown action.' } }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!rosterByEmail.has(email as never)) {
    return { status: 400, body: { error: 'Pick your name from the list.' } }
  }
  const rawShifts = Array.isArray(body.shifts) ? body.shifts : null
  if (!rawShifts) return { status: 400, body: { error: 'Shifts must be a list.' } }
  const shifts = [...new Set(rawShifts.filter((id): id is string => typeof id === 'string' && shiftIds.has(id)))]
  if (shifts.length !== rawShifts.length) {
    return { status: 400, body: { error: 'One of those shifts does not exist.' } }
  }
  if (shifts.length === 0) {
    return { status: 400, body: { error: 'Pick at least one 30-minute shift.' } }
  }
  return updateData(email, shifts, now)
}
