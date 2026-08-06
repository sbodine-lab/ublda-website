import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createLocalRecruitingStore } from '../server/localRecruitingStore.js'
import { handlePortalRequest } from '../server/portalApi.ts'
import type { AuditEntry } from '../src/lib/portalAudit.ts'

/**
 * Track 1 — the roster and console API surface (spec §9).
 *
 * Every test here runs against a throwaway data file. Environment discipline is
 * mandatory: without deleting BLOB_READ_WRITE_TOKEN the store talks to real Vercel
 * Blob, and without UBLDA_LOCAL_DATA_FILE it writes into the developer's own data.
 */
const withPortalEnv = async (
  run: (store: ReturnType<typeof createLocalRecruitingStore>) => Promise<void>,
) => {
  const keys = ['BLOB_READ_WRITE_TOKEN', 'UBLDA_LOCAL_DATA_FILE']
  const original = new Map<string, string | undefined>(keys.map((key) => [key, process.env[key]]))

  delete process.env.BLOB_READ_WRITE_TOKEN
  const dir = await mkdtemp(path.join(tmpdir(), 'ublda-portal-roster-'))
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

type PortalResponse = { status: number; body: Record<string, unknown> }

const call = async (action: string, sessionToken: string, payload: Record<string, unknown> = {}) => (
  handlePortalRequest({ method: 'POST', body: { action, sessionToken, payload } }) as Promise<PortalResponse>
)

const dataOf = (response: PortalResponse) => {
  assert.equal(response.status, 200, `expected 200, got ${response.status}: ${JSON.stringify(response.body)}`)
  return response.body.data as Record<string, unknown>
}

/** A Google-verified officer session, which is the only way a role elevates. */
const officerSession = async (
  store: ReturnType<typeof createLocalRecruitingStore>,
  input: { firstName: string; lastName: string; uniqname: string; email: string; role: 'exec' | 'super-admin' },
) => {
  const created = await store.upsertAccount({
    firstName: input.firstName,
    lastName: input.lastName,
    uniqname: input.uniqname,
    email: input.email,
    role: input.role,
    verifiedVia: 'google',
  })
  return created.sessionToken
}

const memberSession = async (
  store: ReturnType<typeof createLocalRecruitingStore>,
  input: { firstName: string; lastName: string; uniqname: string; email: string },
) => {
  const created = await store.upsertAccount(input, 'a-real-password')
  return created.sessionToken
}

const auditFor = (entries: AuditEntry[], action: string) => entries.filter((entry) => entry.action === action)

test('admin.member.upsert writes only the admin-editable fields and ignores an access key', async () => {
  await withPortalEnv(async (store) => {
    const admin = await officerSession(store, {
      firstName: 'Lindsey', lastName: 'Ye', uniqname: 'ylindsey', email: 'ylindsey@umich.edu', role: 'exec',
    })
    await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    const response = await call('admin.member.upsert', admin, {
      email: 'thartnet@umich.edu',
      firstName: 'Tommy',
      lastName: 'Hartnett',
      status: 'active',
      source: 'festifall',
      notes: 'Met at Festifall, wants the consulting track.',
      // None of the rest is admin-writable. All of it must be dropped on the floor.
      access: {
        needs: [{ id: 'live-captioning', priority: 'required', detail: 'FORBIDDEN_ACCESS_WRITE' }],
        scope: 'shared-with-leads',
        generalNote: 'FORBIDDEN_ACCESS_WRITE',
      },
      phone: '734-555-0114',
      preferredName: 'FORBIDDEN_PREFERRED',
      major: 'FORBIDDEN_MAJOR',
    })

    const member = dataOf(response).member as Record<string, unknown>
    assert.equal(member.status, 'active')
    assert.equal(member.source, 'festifall')
    assert.equal(member.notes, 'Met at Festifall, wants the consulting track.')

    // The response row carries `access` only when consent resolves. It never does here.
    assert.equal('access' in member, false)
    assert.equal(member.phone, '')
    assert.equal(member.preferredName, '')
    assert.equal(member.major, '')

    // And nothing reached the stored record either.
    const workspace = await store.listPortalWorkspace()
    const stored = workspace.memberProfiles.find((profile) => profile.email === 'thartnet@umich.edu')
    assert.ok(stored)
    assert.equal(stored.access.scope, 'private')
    assert.deepEqual(stored.access.needs, [])
    assert.equal(stored.access.generalNote, '')
    assert.equal(stored.phone, '')
    assert.equal(JSON.stringify(workspace).includes('FORBIDDEN_ACCESS_WRITE'), false)
    assert.equal(JSON.stringify(workspace).includes('FORBIDDEN_PREFERRED'), false)
    assert.equal(JSON.stringify(workspace).includes('FORBIDDEN_MAJOR'), false)
  })
})

test('admin.member.bulkAdmit is idempotent when the same batch runs twice', async () => {
  await withPortalEnv(async (store) => {
    const admin = await officerSession(store, {
      firstName: 'Lindsey', lastName: 'Ye', uniqname: 'ylindsey', email: 'ylindsey@umich.edu', role: 'exec',
    })
    await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })
    await memberSession(store, {
      firstName: 'Priya', lastName: 'Raman', uniqname: 'praman', email: 'praman@umich.edu',
    })

    const payload = {
      emails: ['thartnet@umich.edu', 'praman@umich.edu'],
      status: 'active',
      source: 'festifall',
      year: 'Sophomore',
      school: 'Ross',
    }

    const first = dataOf(await call('admin.member.bulkAdmit', admin, payload))
    assert.equal((first.members as unknown[]).length, 2)

    const firstWorkspace = await store.listPortalWorkspace()
    const firstJoined = firstWorkspace.memberProfiles.map((profile) => `${profile.email}:${profile.joinedAt}`).sort()

    const second = dataOf(await call('admin.member.bulkAdmit', admin, payload))
    assert.equal((second.members as unknown[]).length, 2)

    const secondWorkspace = await store.listPortalWorkspace()
    assert.equal(secondWorkspace.memberProfiles.length, 2)
    assert.deepEqual(
      secondWorkspace.memberProfiles.map((profile) => `${profile.email}:${profile.joinedAt}`).sort(),
      firstJoined,
    )

    // A rerun that creates nobody writes no second audit entry either.
    const entries = await store.readAuditLog(100)
    assert.equal(auditFor(entries, 'admin.member.bulkAdmit').length, 1)
  })
})

test('the roster export carries no access, accommodation, phone or notes column', async () => {
  await withPortalEnv(async (store) => {
    const superAdmin = await officerSession(store, {
      firstName: 'Sam', lastName: 'Bodine', uniqname: 'sbodine', email: 'sbodine@umich.edu', role: 'super-admin',
    })
    await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    // A member with a real phone number, a real officer note, and a consented access
    // profile — the three things the export must never carry.
    await call('member.saveProfile', await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    }), { phone: '734-555-0114' })
    await call('admin.member.upsert', superAdmin, {
      email: 'thartnet@umich.edu', status: 'active', notes: 'FORBIDDEN_OFFICER_NOTE',
    })
    await store.saveMemberAccess('thartnet@umich.edu', {
      needs: [{ id: 'live-captioning', priority: 'required', detail: 'FORBIDDEN_ACCESS_DETAIL' }],
      generalNote: 'FORBIDDEN_ACCESS_NOTE',
      followUpPreference: 'email',
      scope: 'shared-with-leads',
      appliesTo: 'all-events',
      consentText: 'Our events are small.',
    }, { email: 'thartnet@umich.edu', role: 'member' })

    const data = dataOf(await call('admin.export', superAdmin, { kind: 'roster' }))
    const csv = String(data.csv)
    const header = csv.split('\n')[0].toLowerCase()

    assert.match(String(data.filename), /^ublda-roster-\d{4}-\d{2}-\d{2}\.csv$/)
    assert.equal(header.includes('access'), false, header)
    assert.equal(header.includes('accommodation'), false, header)
    assert.equal(header.includes('phone'), false, header)
    assert.equal(header.includes('notes'), false, header)

    // Not just the header — none of the values leak into a row either.
    assert.equal(csv.includes('FORBIDDEN_OFFICER_NOTE'), false)
    assert.equal(csv.includes('FORBIDDEN_ACCESS_DETAIL'), false)
    assert.equal(csv.includes('FORBIDDEN_ACCESS_NOTE'), false)
    assert.equal(csv.includes('734-555-0114'), false)

    // The columns that should be there are there.
    assert.ok(header.includes('email'))
    assert.ok(header.includes('status'))
    assert.ok(csv.includes('thartnet@umich.edu'))
  })
})

test('admin.export and admin.grantRole refuse an exec who is not the super admin', async () => {
  await withPortalEnv(async (store) => {
    const exec = await officerSession(store, {
      firstName: 'Alexa', lastName: 'Chiang', uniqname: 'atchiang', email: 'atchiang@umich.edu', role: 'exec',
    })
    const member = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    const grantAsExec = await call('admin.grantRole', exec, {
      email: 'thartnet@umich.edu', role: 'exec', scopes: ['members'],
    })
    assert.equal(grantAsExec.status, 403)
    assert.equal(grantAsExec.body.success, undefined)

    const grantAsMember = await call('admin.grantRole', member, {
      email: 'thartnet@umich.edu', role: 'super-admin', scopes: ['system'],
    })
    assert.equal(grantAsMember.status, 403)

    assert.equal((await call('admin.export', exec, { kind: 'roster' })).status, 403)
    assert.equal((await call('admin.export', member, { kind: 'roster' })).status, 403)

    // A refused call writes nothing, so the audit log stays empty.
    assert.deepEqual(await store.readAuditLog(100), [])
  })
})

test('admin.grantRole writes the role for a super admin and refuses an unknown account', async () => {
  await withPortalEnv(async (store) => {
    const superAdmin = await officerSession(store, {
      firstName: 'Sam', lastName: 'Bodine', uniqname: 'sbodine', email: 'sbodine@umich.edu', role: 'super-admin',
    })
    await memberSession(store, {
      firstName: 'Andrew', lastName: 'Sackett', uniqname: 'andsack', email: 'andsack@umich.edu',
    })

    const granted = dataOf(await call('admin.grantRole', superAdmin, {
      email: 'andsack@umich.edu', role: 'exec', scopes: ['events', 'announcements'],
    })).account as Record<string, unknown>

    assert.equal(granted.role, 'exec')
    assert.deepEqual(granted.adminScopes, ['events', 'announcements'])

    const missing = await call('admin.grantRole', superAdmin, {
      email: 'nobody@umich.edu', role: 'exec', scopes: ['events'],
    })
    assert.equal(missing.status, 400)
    assert.match(String(missing.body.error), /signed in/i)

    // Locking yourself out of your own console is the one change this refuses.
    const self = await call('admin.grantRole', superAdmin, {
      email: 'sbodine@umich.edu', role: 'member', scopes: [],
    })
    assert.equal(self.status, 400)
  })
})

test('every roster mutation appends exactly one audit entry, and reads append none', async () => {
  await withPortalEnv(async (store) => {
    const superAdmin = await officerSession(store, {
      firstName: 'Sam', lastName: 'Bodine', uniqname: 'sbodine', email: 'sbodine@umich.edu', role: 'super-admin',
    })
    await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    assert.deepEqual(await store.readAuditLog(100), [])

    // A read changes nothing.
    dataOf(await call('portal.bootstrap', superAdmin))
    assert.deepEqual(await store.readAuditLog(100), [])

    dataOf(await call('admin.member.bulkAdmit', superAdmin, {
      emails: ['thartnet@umich.edu'], status: 'active', source: 'festifall',
    }))
    dataOf(await call('admin.member.upsert', superAdmin, {
      email: 'thartnet@umich.edu', status: 'inactive',
    }))
    dataOf(await call('admin.export', superAdmin, { kind: 'roster' }))

    const entries = await store.readAuditLog(100)
    assert.equal(entries.length, 3)
    assert.equal(auditFor(entries, 'admin.member.bulkAdmit').length, 1)
    assert.equal(auditFor(entries, 'admin.member.upsert').length, 1)
    assert.equal(auditFor(entries, 'admin.export').length, 1)

    // Newest first, actor stamped, and the summary is a human sentence.
    assert.equal(entries[0].action, 'admin.export')
    entries.forEach((entry) => {
      assert.equal(entry.actorEmail, 'sbodine@umich.edu')
      assert.equal(entry.actorRole, 'super-admin')
      assert.ok(entry.at)
      assert.ok(entry.summary.length > 0)
    })

    // An audit summary must never carry a before/after diff of member content.
    assert.equal(JSON.stringify(entries).includes('FORBIDDEN'), false)
  })
})

test('a member editing their own profile writes no audit entry', async () => {
  await withPortalEnv(async (store) => {
    const member = await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    dataOf(await call('member.saveProfile', member, { preferredName: 'Tom', major: 'BBA' }))

    assert.deepEqual(await store.readAuditLog(100), [])
  })
})

test('the intake queue never lists the force-injected super-admin account', async () => {
  await withPortalEnv(async (store) => {
    const admin = await officerSession(store, {
      firstName: 'Lindsey', lastName: 'Ye', uniqname: 'ylindsey', email: 'ylindsey@umich.edu', role: 'exec',
    })
    await memberSession(store, {
      firstName: 'Tommy', lastName: 'Hartnett', uniqname: 'thartnet', email: 'thartnet@umich.edu',
    })

    const admin1 = dataOf(await call('portal.bootstrap', admin)).admin as Record<string, unknown>
    const intake = admin1.unprocessedIntake as { email: string }[]

    // withPreviewAdmin injects sbodine into `accounts` on every read in every
    // environment. It is not a Festifall signup and must never sit in the queue.
    assert.equal(intake.some((row) => row.email === 'sbodine@umich.edu'), false)
    assert.equal(intake.some((row) => row.email === 'thartnet@umich.edu'), true)

    dataOf(await call('admin.member.bulkAdmit', admin, {
      emails: ['thartnet@umich.edu'], status: 'active', source: 'festifall',
    }))

    // Admitted, so it leaves intake and becomes a roster row — the whole flow.
    const admin2 = dataOf(await call('portal.bootstrap', admin)).admin as Record<string, unknown>
    assert.equal((admin2.unprocessedIntake as { email: string }[]).some((row) => row.email === 'thartnet@umich.edu'), false)
    assert.equal((admin2.members as { email: string }[]).some((row) => row.email === 'thartnet@umich.edu'), true)
  })
})
