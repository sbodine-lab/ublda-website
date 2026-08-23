import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import { verifySpeakerOpsIdentity } from './speakerOpsService.ts'
import {
  CRAFT_NIGHT_NOTE_MAX,
  CRAFT_NIGHT_OPTION_IDS,
  CRAFT_NIGHT_ROSTER,
  type CraftNightPollState,
  type CraftNightPollStatus,
  type CraftNightResponse,
} from '../src/lib/craftNight.ts'

type StoredData = {
  version: 1
  status: CraftNightPollStatus
  finalOptionId: string | null
  responses: Record<string, CraftNightResponse>
}

type ServiceResult = { status: number; body: Record<string, unknown> }

const BLOB_PATH = 'craft-night/state.json'
const WRITE_ATTEMPTS = 5
const queues = new Map<string, Promise<unknown>>()
const optionIds = new Set<string>(CRAFT_NIGHT_OPTION_IDS)
const rosterByEmail = new Map(CRAFT_NIGHT_ROSTER.map((member) => [member.email, member]))

const dataPath = () => process.env.UBLDA_CRAFT_NIGHT_DATA_FILE
  ? path.resolve(process.env.UBLDA_CRAFT_NIGHT_DATA_FILE)
  : path.join(process.cwd(), '.ublda-local-data', 'craft-night.json')

const canUseBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)

const emptyData = (): StoredData => ({ version: 1, status: 'open', finalOptionId: null, responses: {} })

const normalizeData = (raw: unknown): StoredData => {
  const data = raw && typeof raw === 'object' ? raw as Partial<StoredData> : {}
  const responses: StoredData['responses'] = {}
  for (const [email, response] of Object.entries(data.responses || {})) {
    const member = rosterByEmail.get(email as never)
    if (!member || !response || typeof response !== 'object') continue
    const available = Array.isArray(response.available)
      ? response.available.filter((id): id is string => typeof id === 'string' && optionIds.has(id))
      : []
    responses[email] = {
      name: member.name,
      email: member.email,
      available: [...new Set(available)],
      note: typeof response.note === 'string' ? response.note.slice(0, CRAFT_NIGHT_NOTE_MAX) : '',
      updatedAt: typeof response.updatedAt === 'string' ? response.updatedAt : new Date(0).toISOString(),
    }
  }
  return {
    version: 1,
    status: data.status === 'closed' ? 'closed' : 'open',
    finalOptionId: typeof data.finalOptionId === 'string' && optionIds.has(data.finalOptionId)
      ? data.finalOptionId
      : null,
    responses,
  }
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

const rejected = (result: ServiceResult) => result.status >= 400

const updateData = async (mutation: (data: StoredData) => ServiceResult): Promise<ServiceResult> => {
  const key = canUseBlob() ? BLOB_PATH : dataPath()
  const previous = queues.get(key) || Promise.resolve()
  const task = previous.catch(() => undefined).then(async () => {
    if (!canUseBlob()) {
      const data = await readLocal()
      const result = mutation(data)
      if (!rejected(result)) await writeLocal(data)
      return result
    }
    for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
      const { data, etag } = await readBlob()
      const result = mutation(data)
      if (rejected(result)) return result
      try {
        await writeBlob(data, etag)
        return result
      } catch (error) {
        if (!(error instanceof BlobPreconditionFailedError) || attempt === WRITE_ATTEMPTS - 1) throw error
      }
    }
    throw new Error('Craft night storage could not be updated.')
  })
  queues.set(key, task)
  try {
    return await task as ServiceResult
  } finally {
    if (queues.get(key) === task) queues.delete(key)
  }
}

const readData = async (): Promise<StoredData> => (
  canUseBlob() ? (await readBlob()).data : await readLocal()
)

const publicState = (data: StoredData): CraftNightPollState => ({
  status: data.status,
  finalOptionId: data.finalOptionId,
  responses: Object.values(data.responses).sort((a, b) => a.name.localeCompare(b.name)),
})

export type CraftNightIdentityVerifier = (idToken: string) => Promise<{ email: string }>

export type CraftNightServiceOptions = {
  verifyIdentity?: CraftNightIdentityVerifier
}

const cleanNote = (value: unknown) => (
  typeof value === 'string' ? value.replace(/[<>]/g, '').trim().slice(0, CRAFT_NIGHT_NOTE_MAX) : ''
)

export const getCraftNightState = async (): Promise<ServiceResult> => (
  { status: 200, body: { poll: publicState(await readData()) } }
)

export const handleCraftNightAction = async (
  body: Record<string, unknown>,
  options: CraftNightServiceOptions = {},
  now: () => Date = () => new Date(),
): Promise<ServiceResult> => {
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'respond') {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const member = rosterByEmail.get(email as never)
    if (!member) return { status: 400, body: { error: 'Pick your name from the board list.' } }
    const rawAvailable = Array.isArray(body.available) ? body.available : null
    if (!rawAvailable) return { status: 400, body: { error: 'Availability must be a list of option ids.' } }
    const available = [...new Set(rawAvailable.filter(
      (id): id is string => typeof id === 'string' && optionIds.has(id),
    ))]
    if (available.length !== rawAvailable.length) {
      return { status: 400, body: { error: 'One of those time options does not exist.' } }
    }
    const note = cleanNote(body.note)
    return updateData((data) => {
      if (data.status !== 'open') {
        return { status: 409, body: { error: 'This poll is closed.' } }
      }
      data.responses[member.email] = {
        name: member.name,
        email: member.email,
        available,
        note,
        updatedAt: now().toISOString(),
      }
      return { status: 200, body: { success: true, poll: publicState(data) } }
    })
  }

  if (action !== 'set-status' && action !== 'clear-response' && action !== 'set-final') {
    return { status: 400, body: { error: 'Unknown action.' } }
  }

  const verifyIdentity = options.verifyIdentity || verifySpeakerOpsIdentity
  const idToken = typeof body.idToken === 'string' ? body.idToken : ''
  try {
    await verifyIdentity(idToken)
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 401
    const message = error instanceof Error && error.message
      ? error.message
      : 'Sign in with your UBLDA leadership account.'
    return { status, body: { error: message } }
  }

  if (action === 'set-status') {
    const status = body.status === 'closed' ? 'closed' : body.status === 'open' ? 'open' : null
    if (!status) return { status: 400, body: { error: 'Status must be open or closed.' } }
    return updateData((data) => {
      data.status = status
      if (status === 'open') data.finalOptionId = null
      return { status: 200, body: { success: true, poll: publicState(data) } }
    })
  }

  if (action === 'set-final') {
    const finalOptionId = typeof body.optionId === 'string' && optionIds.has(body.optionId)
      ? body.optionId
      : null
    if (!finalOptionId) return { status: 400, body: { error: 'Pick a real time option to lock in.' } }
    return updateData((data) => {
      data.status = 'closed'
      data.finalOptionId = finalOptionId
      return { status: 200, body: { success: true, poll: publicState(data) } }
    })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  return updateData((data) => {
    if (!data.responses[email]) return { status: 404, body: { error: 'No response found for that member.' } }
    delete data.responses[email]
    return { status: 200, body: { success: true, poll: publicState(data) } }
  })
}
