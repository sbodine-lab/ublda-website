import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest } from '../server/portalApi.ts'
import type { PortalAnnouncement } from '../src/lib/portalAnnouncements.ts'
import type { PortalResource } from '../src/lib/portalResources.ts'

/**
 * Spec §9, T3 row: `admin.announcement.upsert` forces `draft` on create; publish is
 * publisher-gated; `admin.resource.upsert` rejects an empty `formatNote`;
 * `admin.resource.reorder` rewrites `order` for exactly the ids given.
 *
 * Test files never import each other (spec §9), so the env harness below is a
 * deliberate duplicate rather than a shared module.
 */

/**
 * Mandatory env discipline: without deleting BLOB_READ_WRITE_TOKEN the store talks to
 * real Vercel Blob, and without UBLDA_LOCAL_DATA_FILE it writes the developer's own data.
 */
const withPortalEnv = async (
  run: (store: ReturnType<typeof createLocalRecruitingStore>) => Promise<void>,
) => {
  const keys = ['BLOB_READ_WRITE_TOKEN', 'UBLDA_LOCAL_DATA_FILE']
  const original = new Map<string, string | undefined>(keys.map((key) => [key, process.env[key]]))

  delete process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-broadcast-'))
  process.env.UBLDA_LOCAL_DATA_FILE = path.join(dir, 'recruiting.json')

  try {
    await run(createLocalRecruitingStore(process.env.UBLDA_LOCAL_DATA_FILE))
  } finally {
    original.forEach((value, key) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    })
    await rm(dir, { recursive: true, force: true })
  }
}

type Store = ReturnType<typeof createLocalRecruitingStore>

/** Alexa Chiang: exec, holds `announcements` and `resources`, AND publishes. */
const publisherSession = async (store: Store) => (
  (await store.upsertAccount({
    firstName: 'Alexa',
    lastName: 'Chiang',
    uniqname: 'atchiang',
    email: 'atchiang@umich.edu',
    role: 'exec',
    verifiedVia: 'google',
  })).sessionToken
)

/** Andrew Sackett: exec, holds `events` and `announcements`, and does NOT publish. */
const nonPublisherSession = async (store: Store) => (
  (await store.upsertAccount({
    firstName: 'Andrew',
    lastName: 'Sackett',
    uniqname: 'andsack',
    email: 'andsack@umich.edu',
    role: 'exec',
    verifiedVia: 'google',
  })).sessionToken
)

const call = (action: string, sessionToken: string, payload: Record<string, unknown> = {}) => (
  handlePortalRequest({ method: 'POST', body: { action, sessionToken, payload } })
)

const dataOf = <T>(body: Record<string, unknown>): T => body.data as T

test('admin.announcement.upsert forces draft on create and cannot be talked out of it', async () => {
  await withPortalEnv(async (store) => {
    const sessionToken = await nonPublisherSession(store)

    const created = await call('admin.announcement.upsert', sessionToken, {
      title: 'Festifall table, September 2',
      body: 'We are tabling on the Diag from 11 to 4. Two-hour shifts, sit-down table, water provided.',
      audience: 'all-members',
      // A client insisting on `status` and stamping its own approval changes nothing.
      status: 'published',
      approvedBy: 'someone@umich.edu',
      publishedAt: '2026-08-01T00:00:00.000Z',
    })

    assert.equal(created.status, 200)
    const announcement = dataOf<{ announcement: PortalAnnouncement }>(created.body).announcement
    assert.equal(announcement.status, 'draft')
    assert.equal(announcement.publishedAt, '')
    assert.equal(announcement.approvedBy, '')
    assert.equal(announcement.authorEmail, 'andsack@umich.edu')

    // Editing an existing draft leaves the status alone too.
    const edited = await call('admin.announcement.upsert', sessionToken, {
      id: announcement.id,
      title: 'Festifall table, September 2',
      body: 'Updated: three-hour shifts.',
      audience: 'all-members',
      status: 'published',
    })
    assert.equal(edited.status, 200)
    assert.equal(dataOf<{ announcement: PortalAnnouncement }>(edited.body).announcement.status, 'draft')
  })
})

test('admin.announcement.upsert reports every validation error at once', async () => {
  await withPortalEnv(async (store) => {
    const sessionToken = await nonPublisherSession(store)

    const rejected = await call('admin.announcement.upsert', sessionToken, {
      title: '',
      body: '',
      audience: 'everyone',
      ctaLabel: 'Sign up',
      ctaHref: 'javascript:alert(1)',
    })

    assert.equal(rejected.status, 400)
    const errors = rejected.body.errors as string[]
    assert.ok(errors.length >= 4, `expected several errors, got ${JSON.stringify(errors)}`)
    assert.ok(errors.some((entry) => /title is required/i.test(entry)))
    assert.ok(errors.some((entry) => /body is required/i.test(entry)))
    assert.ok(errors.some((entry) => /audience/i.test(entry)))
    assert.ok(errors.some((entry) => /https:\/\//i.test(entry)))
  })
})

test('publishing an announcement is publisher-gated, not merely scope-gated', async () => {
  await withPortalEnv(async (store) => {
    const nonPublisher = await nonPublisherSession(store)
    const publisher = await publisherSession(store)

    const created = await call('admin.announcement.upsert', nonPublisher, {
      title: 'First general meeting',
      body: 'Ross R1240, step-free route via the east doors on Tappan.',
      audience: 'all-members',
    })
    const id = dataOf<{ announcement: PortalAnnouncement }>(created.body).announcement.id

    // Andrew holds `announcements` and still cannot publish — the button being
    // forced in the DOM buys a 403, not a publish (spec §4.2).
    const refused = await call('admin.announcement.publish', nonPublisher, { id, status: 'published' })
    assert.equal(refused.status, 403)
    assert.equal(refused.body.success, undefined)

    const published = await call('admin.announcement.publish', publisher, { id, status: 'published' })
    assert.equal(published.status, 200)
    const announcement = dataOf<{ announcement: PortalAnnouncement }>(published.body).announcement
    assert.equal(announcement.status, 'published')
    assert.equal(announcement.approvedBy, 'atchiang@umich.edu')
    assert.notEqual(announcement.publishedAt, '')

    const archived = await call('admin.announcement.publish', publisher, { id, status: 'archived' })
    assert.equal(dataOf<{ announcement: PortalAnnouncement }>(archived.body).announcement.status, 'archived')

    // Neither "delete" nor a made-up status is a publish target.
    const bogus = await call('admin.announcement.publish', publisher, { id, status: 'deleted' })
    assert.equal(bogus.status, 400)
  })
})

test('admin.resource.upsert rejects an empty formatNote and keeps the reason human', async () => {
  await withPortalEnv(async (store) => {
    const sessionToken = await publisherSession(store)

    const rejected = await call('admin.resource.upsert', sessionToken, {
      title: 'Accessibility commitments',
      description: 'What we promise about every room we book.',
      href: 'https://ublda.org/accessibility',
      category: 'accessibility',
      formatNote: '   ',
      audience: 'all-members',
      published: true,
    })

    assert.equal(rejected.status, 400)
    const errors = rejected.body.errors as string[]
    assert.ok(
      errors.some((entry) => /format/i.test(entry) && /before they open it/i.test(entry)),
      `expected the format-note error, got ${JSON.stringify(errors)}`,
    )

    const accepted = await call('admin.resource.upsert', sessionToken, {
      title: 'Accessibility commitments',
      description: 'What we promise about every room we book.',
      href: 'https://ublda.org/accessibility',
      category: 'accessibility',
      formatNote: 'Tagged PDF, screen-reader tested',
      audience: 'all-members',
      published: true,
    })

    assert.equal(accepted.status, 200)
    const resource = dataOf<{ resource: PortalResource }>(accepted.body).resource
    assert.equal(resource.formatNote, 'Tagged PDF, screen-reader tested')
    assert.equal(resource.order, 0)
    assert.equal(resource.addedBy, 'atchiang@umich.edu')
  })
})

test('admin.resource.reorder rewrites order for exactly the ids given', async () => {
  await withPortalEnv(async (store) => {
    const sessionToken = await publisherSession(store)

    const add = async (title: string) => {
      const response = await call('admin.resource.upsert', sessionToken, {
        title,
        description: '',
        href: `/members/resources#${title.toLowerCase().replace(/\W+/g, '-')}`,
        category: 'onboarding',
        formatNote: 'Web page, no download',
        audience: 'all-members',
        published: true,
      })
      assert.equal(response.status, 200)
      return dataOf<{ resource: PortalResource }>(response.body).resource
    }

    const first = await add('How the club works')
    const second = await add('Who to ask')
    const third = await add('Access commitments')
    const untouched = await add('BLDA national network')

    assert.deepEqual([first.order, second.order, third.order, untouched.order], [0, 1, 2, 3])

    // Move the third to the front, leaving the fourth out of the payload entirely.
    const reordered = await call('admin.resource.reorder', sessionToken, {
      ids: [third.id, first.id, second.id],
    })
    assert.equal(reordered.status, 200)

    const rows = dataOf<{ resources: PortalResource[] }>(reordered.body).resources
    const orderOf = (id: string) => rows.find((row) => row.id === id)?.order
    assert.equal(orderOf(third.id), 0)
    assert.equal(orderOf(first.id), 1)
    assert.equal(orderOf(second.id), 2)
    // Not in `ids`, so its order is left exactly where it was.
    assert.equal(orderOf(untouched.id), 3)

    // An id that no longer exists is skipped, not fatal.
    const withGhost = await call('admin.resource.reorder', sessionToken, {
      ids: ['resource_does_not_exist', second.id, first.id, third.id],
    })
    assert.equal(withGhost.status, 200)
    const afterGhost = dataOf<{ resources: PortalResource[] }>(withGhost.body).resources
    assert.equal(afterGhost.find((row) => row.id === second.id)?.order, 1)
    assert.equal(afterGhost.find((row) => row.id === first.id)?.order, 2)
    assert.equal(afterGhost.find((row) => row.id === third.id)?.order, 3)

    const empty = await call('admin.resource.reorder', sessionToken, { ids: [] })
    assert.equal(empty.status, 400)
  })
})

test('a member gets 403 on every broadcast write, whatever the client would have sent', async () => {
  await withPortalEnv(async (store) => {
    const member = await store.upsertAccount({
      firstName: 'Tommy',
      lastName: 'Hartnett',
      uniqname: 'thartnet',
      email: 'thartnet@umich.edu',
    }, 'a-real-password')

    for (const action of [
      'admin.announcement.upsert',
      'admin.announcement.publish',
      'admin.resource.upsert',
      'admin.resource.reorder',
    ]) {
      const response = await call(action, member.sessionToken, { title: 'x', id: 'y', ids: ['y'] })
      assert.equal(response.status, 403, `${action} should be 403 for a member`)
    }
  })
})

test('every broadcast mutation appends exactly one audit entry', async () => {
  await withPortalEnv(async (store) => {
    const sessionToken = await publisherSession(store)

    const created = await call('admin.announcement.upsert', sessionToken, {
      title: 'Room change for Thursday',
      body: 'We moved to R1240. Step-free route via the east doors.',
      audience: 'all-members',
    })
    const id = dataOf<{ announcement: PortalAnnouncement }>(created.body).announcement.id
    await call('admin.announcement.publish', sessionToken, { id, status: 'published' })
    await call('admin.resource.upsert', sessionToken, {
      title: 'Access commitments',
      description: '',
      href: 'https://ublda.org/accessibility',
      category: 'accessibility',
      formatNote: 'Web page, no download',
      audience: 'all-members',
      published: true,
    })

    const log = await store.readAuditLog(100)
    const actions = log.map((entry) => entry.action)

    assert.equal(actions.filter((action) => action === 'admin.announcement.upsert').length, 1)
    assert.equal(actions.filter((action) => action === 'admin.announcement.publish').length, 1)
    assert.equal(actions.filter((action) => action === 'admin.resource.upsert').length, 1)
    log.forEach((entry) => {
      assert.equal(entry.actorEmail, 'atchiang@umich.edu')
      assert.ok(entry.summary.length > 0)
      // Audit summaries carry a human sentence, never a before/after diff (spec §3.7).
      assert.equal('before' in entry, false)
      assert.equal('after' in entry, false)
    })
  })
})
