// server/operationsStore.js
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
var FIXED_ADMIN_EMAILS = [
  "sbodine@umich.edu",
  "atchiang@umich.edu",
  "cooperry@umich.edu"
];
var OPERATIONS_SUPER_ADMINS = FIXED_ADMIN_EMAILS;
var ATTENDANCE_STATUS_LABELS = {
  not_invited: "Not on invite",
  unrecorded: "Not recorded",
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused"
};
var STRIKE_REASON_LABELS = {
  meeting_absence: "Meeting absence",
  notice: "Notice requirement",
  deliverable: "Missed deliverable",
  communication: "Communication"
};
var STRIKE_STATUS_LABELS = {
  active: "Active",
  excused: "Excused",
  voided: "Voided"
};
var DOCUMENT_CATEGORY_LABELS = {
  constitution: "Constitution",
  meeting_notes: "Meeting notes",
  archive: "Archive"
};
var DOCUMENT_STATUS_LABELS = {
  current: "Current",
  draft: "Draft",
  superseded: "Superseded",
  archived: "Archived",
  unverified: "Unverified"
};
var REVIEW_STAGE_LABELS = {
  draft: "Draft",
  ready_for_review: "Ready for review",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved"
};
var BLOB_PATH = "operations/state.json";
var WRITE_ATTEMPTS = 5;
var queues = /* @__PURE__ */ new Map();
var defaultDataPath = () => process.env.UBLDA_OPERATIONS_DATA_FILE ? path.resolve(process.env.UBLDA_OPERATIONS_DATA_FILE) : path.join(process.cwd(), ".ublda-local-data", "operations.json");
var cleanText = (value, max = 500) => typeof value === "string" ? value.replace(/[<>]/g, "").trim().slice(0, max) : "";
var randomId = (prefix) => `${prefix}_${randomBytes(10).toString("base64url")}`;
var canUseBlob = (forceLocal) => !forceLocal && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
var mutationRejected = (result) => Boolean(
  result && typeof result === "object" && "ok" in result && result.ok === false
);
var isOperationsSuperAdmin = (email) => OPERATIONS_SUPER_ADMINS.includes(email.trim().toLowerCase());
var validDocumentDriveUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    const validPath = url.hostname === "drive.google.com" ? /^\/file\/d\/[A-Za-z0-9_-]+\/view\/?$/.test(url.pathname) : url.hostname === "docs.google.com" ? /^\/(?:document|spreadsheets|presentation)\/d\/[A-Za-z0-9_-]+(?:\/(?:edit|view))?\/?$/.test(url.pathname) : false;
    if (!validPath) return "";
    url.hash = "";
    return url.toString().slice(0, 500);
  } catch {
    return "";
  }
};
var accountSeeds = (updatedAt) => [
  { name: "Sam Bodine", email: "sbodine@umich.edu", title: "Co-President", role: "super_admin", updatedAt, updatedBy: "system" },
  { name: "Alexa Chiang", email: "atchiang@umich.edu", title: "Co-President", role: "super_admin", updatedAt, updatedBy: "system" },
  { name: "Cooper Perry", email: "cooperry@umich.edu", title: "Executive Vice President", role: "super_admin", updatedAt, updatedBy: "system" },
  { name: "Alex Forstner", email: "alexfors@umich.edu", title: "VP Education", role: "officer", updatedAt, updatedBy: "system" },
  { name: "Andrew Sackett", email: "andsack@umich.edu", title: "VP Events", role: "officer", updatedAt, updatedBy: "system" },
  { name: "Landon Miller", email: "landonem@umich.edu", title: "VP Finance", role: "officer", updatedAt, updatedBy: "system" },
  { name: "Lindsey Ye", email: "ylindsey@umich.edu", title: "VP Operations", role: "officer", updatedAt, updatedBy: "system" },
  { name: "Samantha Naber", email: "snaber@umich.edu", title: "Leadership Team", role: "officer", updatedAt, updatedBy: "system" },
  { name: "Solomon Deyoung", email: "sdeyoun@umich.edu", title: "Leadership Team", role: "officer", updatedAt, updatedBy: "system" }
];
var eventSeeds = () => [{
  id: "team-meeting-2026-08-14",
  title: "UBLDA Team Meeting",
  startsAt: "2026-08-14T15:45:00-04:00",
  endsAt: "2026-08-14T16:15:00-04:00",
  timezone: "America/Detroit",
  location: "Location / Meet link not yet verified",
  sourceNote: "The user confirmed the live Calendar window of 3:45\u20134:15 PM ET. The location or Google Meet link has not yet been verified.",
  sourceStatus: "user_confirmed",
  calendarStartsAt: "2026-08-14T15:45:00-04:00",
  calendarEndsAt: "2026-08-14T16:15:00-04:00",
  calendarUrl: "",
  lastVerifiedAt: "2026-08-14T00:00:00-04:00"
}];
var documentSeeds = (updatedAt) => [
  {
    id: "constitution",
    title: "UBLDA - Constitution.docx",
    category: "constitution",
    driveUrl: "https://drive.google.com/file/d/1OQM2b62K93_uKrNVAh0iTSRHtBAP8bDD/view",
    sourceStatus: "verified",
    currentStatus: "current",
    sourceNote: "Verified in Drive under Core Documents (DOCX). Governance review is still required: named roles conflict with current responsibilities, and the advisor, weekly-meeting, and 75% participation requirements need confirmation.",
    ownerEmail: "cooperry@umich.edu",
    lastVerifiedAt: "2026-08-14T00:00:00-04:00",
    updatedAt,
    updatedBy: "system"
  },
  {
    id: "team-meeting-notes-2026-08-14",
    title: "UBLDA Team Meeting Notes \u2014 August 14, 2026",
    category: "meeting_notes",
    driveUrl: "https://docs.google.com/document/d/1TKPrLVm80gsmUnNn5g2iwfmAwIWIlsTMiHJJlL3bx8M/edit",
    sourceStatus: "verified",
    currentStatus: "current",
    sourceNote: "Verified shared notes document for today's team meeting. A canonical Meeting Notes folder link was not supplied, so this record links directly to the verified file.",
    ownerEmail: "ylindsey@umich.edu",
    lastVerifiedAt: "2026-08-14T00:00:00-04:00",
    updatedAt,
    updatedBy: "system"
  },
  {
    id: "founding-notes-2026-06-28",
    title: "Founding Team Meeting Notes \u2014 June 28, 2026",
    category: "meeting_notes",
    driveUrl: "https://docs.google.com/document/d/1FS__OHUyk2ryLXH7LN8Ii06JAtr_SNcBcChK91fn0vI",
    sourceStatus: "verified",
    currentStatus: "current",
    sourceNote: "Brain document #14; source of the current three-strike operating rule.",
    ownerEmail: "cooperry@umich.edu",
    lastVerifiedAt: "2026-08-14T00:00:00-04:00",
    updatedAt,
    updatedBy: "system"
  },
  {
    id: "meeting-notes-2026-07-29",
    title: "Full E-Board Meeting Notes \u2014 July 29, 2026",
    category: "archive",
    driveUrl: "https://docs.google.com/document/d/1SRRQmmC0yx271dYn6tmrSudjmsfTO6c9HAhjL_myNck/edit",
    sourceStatus: "verified",
    currentStatus: "archived",
    sourceNote: "Public notes link recorded in the Brain July 29 artifact handoff.",
    ownerEmail: "ylindsey@umich.edu",
    lastVerifiedAt: "2026-07-29T00:00:00-04:00",
    updatedAt,
    updatedBy: "system"
  }
];
var emptyData = () => {
  const seededAt = "2026-08-14T00:00:00-04:00";
  const accounts = Object.fromEntries(accountSeeds(seededAt).map((account) => [account.email, account]));
  const events = Object.fromEntries(eventSeeds().map((event) => [event.id, event]));
  const attendance = Object.fromEntries(accountSeeds(seededAt).map((account) => {
    const invited = account.email !== "atchiang@umich.edu";
    const record = {
      id: `attendance-team-meeting-2026-08-14-${account.email.split("@")[0]}`,
      eventId: "team-meeting-2026-08-14",
      memberEmail: account.email,
      invited,
      inviteSourceNote: invited ? "Included on the live Google Calendar invite snapshot." : "Not listed among the eight invitees on the live Google Calendar snapshot; do not infer an absence.",
      status: invited ? "unrecorded" : "not_invited",
      noticeAt: "",
      notes: "",
      updatedAt: seededAt,
      updatedBy: "system"
    };
    return [record.id, record];
  }));
  const documents = Object.fromEntries(documentSeeds(seededAt).map((document) => [document.id, document]));
  const review = {
    id: "review-constitution",
    title: "Constitution independent review",
    artifactType: "document",
    artifactId: "constitution",
    ownerEmail: "sbodine@umich.edu",
    reviewerEmail: "cooperry@umich.edu",
    stage: "draft",
    independentReviewer: true,
    reviewNotes: [],
    history: [],
    updatedAt: seededAt
  };
  return {
    version: 1,
    accounts,
    events,
    attendance,
    strikes: {},
    escalations: {},
    documents,
    reviews: { [review.id]: review },
    activity: []
  };
};
var normalizeAccount = (seed, raw) => {
  const email = seed.email.toLowerCase();
  const requestedRole = raw?.role;
  const allowedRole = requestedRole && ["officer", "member", "inactive"].includes(requestedRole) ? requestedRole : seed.role;
  return {
    ...seed,
    ...raw,
    email,
    name: cleanText(raw?.name || seed.name, 120) || seed.name,
    title: cleanText(raw?.title || seed.title, 120) || seed.title,
    role: isOperationsSuperAdmin(email) ? "super_admin" : allowedRole,
    updatedAt: cleanText(raw?.updatedAt || seed.updatedAt, 80),
    updatedBy: cleanText(raw?.updatedBy || seed.updatedBy, 160)
  };
};
var normalizeData = (raw) => {
  const seed = emptyData();
  const accounts = Object.fromEntries(Object.values(seed.accounts).map((account) => [
    account.email,
    normalizeAccount(account, raw.accounts?.[account.email])
  ]));
  const attendance = Object.fromEntries(Object.values(seed.attendance).map((record) => {
    const stored = raw.attendance?.[record.id];
    if (!record.invited) return [record.id, { ...record, ...stored || {}, invited: false, status: "not_invited", inviteSourceNote: record.inviteSourceNote }];
    return [record.id, { ...record, ...stored || {}, invited: true, inviteSourceNote: record.inviteSourceNote }];
  }));
  const documents = Object.fromEntries(Object.values(seed.documents).map((document) => {
    const merged = { ...document, ...raw.documents?.[document.id] || {} };
    const driveUrl = validDocumentDriveUrl(merged.driveUrl);
    const sourceStatus = merged.sourceStatus === "verified" && driveUrl ? "verified" : "unverified";
    return [document.id, {
      ...merged,
      driveUrl,
      sourceStatus,
      lastVerifiedAt: sourceStatus === "verified" ? cleanText(merged.lastVerifiedAt, 80) : ""
    }];
  }));
  return {
    version: 1,
    accounts,
    events: { ...seed.events, ...raw.events || {} },
    attendance,
    strikes: raw.strikes || {},
    escalations: raw.escalations || {},
    documents,
    reviews: { ...seed.reviews, ...raw.reviews || {} },
    activity: Array.isArray(raw.activity) ? raw.activity.slice(0, 250) : []
  };
};
var operationsEventStatus = (event, now = /* @__PURE__ */ new Date()) => {
  const current = now.getTime();
  const starts = new Date(event.startsAt).getTime();
  const ends = new Date(event.endsAt).getTime();
  if (current < starts) return "upcoming";
  if (current < ends) return "active";
  return "inactive";
};
var policy = {
  escalationAt: 3,
  source: "Brain document #14 \u2014 UBLDA Founding Team Meeting Notes, June 28, 2026",
  sourceUrl: "https://docs.google.com/document/d/1FS__OHUyk2ryLXH7LN8Ii06JAtr_SNcBcChK91fn0vI",
  rules: [
    "More than one missed meeting in a month may earn a strike, with exceptions for illness and genuine academic, club, or career conflicts.",
    "No notice at least 24 hours before a general team meeting may earn a strike.",
    "No notice at least 72 hours before a club event may earn a strike.",
    "A missed deliverable without notice may earn a strike.",
    "Not responding within a reasonable time may earn a communication strike.",
    "Three active strikes trigger a standing review with Sam, Alexa, and Cooper."
  ]
};
var accountRoleFor = (data, actor) => {
  if (isOperationsSuperAdmin(actor.email)) return "super_admin";
  return data.accounts[actor.email.toLowerCase()]?.role || "member";
};
var OperationsAccessError = class extends Error {
  status = 403;
  constructor(message) {
    super(message);
    this.name = "OperationsAccessError";
  }
};
var OperationsStore = class {
  dataPath;
  forceLocal;
  now;
  constructor(dataPath = defaultDataPath(), options = {}) {
    this.dataPath = dataPath;
    this.forceLocal = Boolean(options.forceLocal);
    this.now = options.now || (() => /* @__PURE__ */ new Date());
  }
  storageKey() {
    return canUseBlob(this.forceLocal) ? BLOB_PATH : this.dataPath;
  }
  async readLocal() {
    try {
      return JSON.parse(await readFile(this.dataPath, "utf8"));
    } catch {
      return emptyData();
    }
  }
  async writeLocal(data) {
    await mkdir(path.dirname(this.dataPath), { recursive: true });
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes(5).toString("base64url")}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}
`, { mode: 384 });
    await rename(tempPath, this.dataPath);
  }
  async readBlob() {
    const blob = await get(BLOB_PATH, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200) return { data: emptyData(), etag: null };
    const raw = await new Response(blob.stream).text();
    const etag = blob.blob.etag?.replace(/^W\//, "") || null;
    return { data: JSON.parse(raw), etag };
  }
  async writeBlob(data, etag) {
    await put(BLOB_PATH, `${JSON.stringify(data, null, 2)}
`, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      contentType: "application/json",
      ...etag ? { ifMatch: etag } : {}
    });
  }
  async readData() {
    const raw = canUseBlob(this.forceLocal) ? (await this.readBlob()).data : await this.readLocal();
    return normalizeData(raw);
  }
  async updateData(mutation) {
    const key = this.storageKey();
    const previous = queues.get(key) || Promise.resolve();
    const task = previous.catch(() => void 0).then(async () => {
      if (!canUseBlob(this.forceLocal)) {
        const data = normalizeData(await this.readLocal());
        const result = await mutation(data);
        if (mutationRejected(result)) return result;
        await this.writeLocal(data);
        return result;
      }
      for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
        const { data: raw, etag } = await this.readBlob();
        const data = normalizeData(raw);
        const result = await mutation(data);
        if (mutationRejected(result)) return result;
        try {
          await this.writeBlob(data, etag);
          return result;
        } catch (error) {
          if (!(error instanceof BlobPreconditionFailedError) || attempt === WRITE_ATTEMPTS - 1) throw error;
        }
      }
      throw new Error("Operations storage could not be updated.");
    });
    queues.set(key, task);
    try {
      return await task;
    } finally {
      if (queues.get(key) === task) queues.delete(key);
    }
  }
  requireWrite(actor) {
    return isOperationsSuperAdmin(actor.email) ? { ok: true } : { ok: false, error: "Only the three Operations super admins can change this workspace." };
  }
  appendActivity(data, actorEmail, action, detail) {
    data.activity.unshift({
      id: randomId("activity"),
      actorEmail: actorEmail.toLowerCase(),
      action: cleanText(action, 100),
      detail: cleanText(detail, 500),
      createdAt: this.now().toISOString()
    });
    data.activity = data.activity.slice(0, 250);
  }
  syncEscalation(data, memberEmail, actorEmail) {
    const activeCount = Object.values(data.strikes).filter((strike) => strike.memberEmail === memberEmail && strike.status === "active").length;
    const open = Object.values(data.escalations).find((escalation) => escalation.memberEmail === memberEmail && escalation.status === "open");
    const createdAt = this.now().toISOString();
    if (activeCount >= policy.escalationAt && !open) {
      const due = new Date(this.now());
      due.setUTCDate(due.getUTCDate() + 7);
      const escalation = {
        id: randomId("escalation"),
        memberEmail,
        ownerEmail: "sbodine@umich.edu",
        dueAt: due.toISOString(),
        status: "open",
        openedAt: createdAt,
        resolvedAt: "",
        resolutionNote: "",
        history: [{
          id: randomId("escalation-history"),
          action: "opened",
          activeStrikeCount: activeCount,
          actorEmail: actorEmail.toLowerCase(),
          note: "Three active strikes triggered a standing review with Sam, Alexa, and Cooper.",
          createdAt
        }],
        updatedAt: createdAt
      };
      data.escalations[escalation.id] = escalation;
      return;
    }
    if (activeCount < policy.escalationAt && open) {
      open.status = "resolved";
      open.resolvedAt = createdAt;
      open.resolutionNote = "Automatically resolved when the active strike count dropped below three.";
      open.updatedAt = createdAt;
      open.history.unshift({
        id: randomId("escalation-history"),
        action: "resolved",
        activeStrikeCount: activeCount,
        actorEmail: actorEmail.toLowerCase(),
        note: open.resolutionNote,
        createdAt
      });
    }
  }
  async workspace(actor) {
    const data = await this.readData();
    const email = actor.email.toLowerCase();
    const role = accountRoleFor(data, actor);
    if (role === "inactive") {
      throw new OperationsAccessError("This Operations account is inactive.");
    }
    const activeStrikes = Object.values(data.strikes).filter((strike) => strike.status === "active");
    return {
      viewer: {
        memberId: actor.memberId,
        name: actor.displayName || data.accounts[email]?.name || email,
        email,
        role,
        canWrite: isOperationsSuperAdmin(email)
      },
      accounts: Object.values(data.accounts),
      events: Object.values(data.events).map((event) => ({
        ...event,
        status: operationsEventStatus(event, this.now())
      })),
      attendance: Object.values(data.attendance),
      strikes: Object.values(data.strikes),
      strikeSummary: Object.values(data.accounts).map((account) => {
        const activeCount = activeStrikes.filter((strike) => strike.memberEmail === account.email).length;
        return { memberEmail: account.email, activeCount, escalationRequired: activeCount >= policy.escalationAt };
      }),
      escalations: Object.values(data.escalations),
      documents: Object.values(data.documents),
      reviews: Object.values(data.reviews),
      activity: data.activity,
      policy
    };
  }
  async updateAttendance(actor, input) {
    const authorized = this.requireWrite(actor);
    if (!authorized.ok) return authorized;
    return this.updateData((data) => {
      if (!data.events[input.eventId]) return { ok: false, error: "Event was not found." };
      const memberEmail = input.memberEmail.toLowerCase();
      if (!data.accounts[memberEmail]) return { ok: false, error: "Member was not found." };
      const existing = Object.values(data.attendance).find((record) => record.eventId === input.eventId && record.memberEmail === memberEmail);
      if (!existing) return { ok: false, error: "Attendance record was not found." };
      if (!existing.invited) {
        return { ok: false, error: "This person was not on the meeting invite; attendance cannot imply an absence." };
      }
      if (input.status && Object.keys(ATTENDANCE_STATUS_LABELS).includes(input.status)) {
        existing.status = input.status;
      }
      if (typeof input.noticeAt === "string") existing.noticeAt = cleanText(input.noticeAt, 80);
      if (typeof input.notes === "string") existing.notes = cleanText(input.notes, 800);
      existing.updatedAt = this.now().toISOString();
      existing.updatedBy = actor.email.toLowerCase();
      this.appendActivity(data, actor.email, "Attendance updated", `${memberEmail}: ${existing.status}`);
      return { ok: true, attendance: { ...existing } };
    });
  }
  async createStrike(actor, input) {
    const authorized = this.requireWrite(actor);
    if (!authorized.ok) return authorized;
    return this.updateData((data) => {
      const memberEmail = input.memberEmail.toLowerCase();
      if (!data.accounts[memberEmail]) return { ok: false, error: "Member was not found." };
      if (!Object.keys(STRIKE_REASON_LABELS).includes(input.reason)) return { ok: false, error: "Choose a valid strike reason." };
      const detail = cleanText(input.detail, 800);
      if (!detail) return { ok: false, error: "Document the evidence before adding a strike." };
      if (input.eventId && !data.events[input.eventId]) return { ok: false, error: "Event was not found." };
      const createdAt = this.now().toISOString();
      const strike = {
        id: randomId("strike"),
        memberEmail,
        reason: input.reason,
        detail,
        eventId: cleanText(input.eventId, 120),
        status: "active",
        issuedAt: createdAt,
        issuedBy: actor.email.toLowerCase(),
        updatedAt: createdAt,
        audit: [{
          id: randomId("audit"),
          action: "created",
          fromStatus: "",
          toStatus: "active",
          note: detail,
          actorEmail: actor.email.toLowerCase(),
          createdAt
        }]
      };
      data.strikes[strike.id] = strike;
      this.syncEscalation(data, memberEmail, actor.email);
      this.appendActivity(data, actor.email, "Strike added", `${memberEmail}: ${STRIKE_REASON_LABELS[strike.reason]}`);
      return { ok: true, strike };
    });
  }
  async updateStrikeStatus(actor, input) {
    const authorized = this.requireWrite(actor);
    if (!authorized.ok) return authorized;
    return this.updateData((data) => {
      const strike = data.strikes[input.id];
      if (!strike) return { ok: false, error: "Strike was not found." };
      if (!Object.keys(STRIKE_STATUS_LABELS).includes(input.status)) return { ok: false, error: "Choose a valid strike status." };
      const note = cleanText(input.note, 800);
      if (!note) return { ok: false, error: "Add an audit note for this status change." };
      const previous = strike.status;
      const createdAt = this.now().toISOString();
      strike.status = input.status;
      strike.updatedAt = createdAt;
      strike.audit.unshift({
        id: randomId("audit"),
        action: previous === input.status ? "note_added" : "status_changed",
        fromStatus: previous,
        toStatus: input.status,
        note,
        actorEmail: actor.email.toLowerCase(),
        createdAt
      });
      this.syncEscalation(data, strike.memberEmail, actor.email);
      this.appendActivity(data, actor.email, "Strike reviewed", `${strike.memberEmail}: ${STRIKE_STATUS_LABELS[input.status]}`);
      return { ok: true, strike: { ...strike } };
    });
  }
  async updateAccount(actor, input) {
    const authorized = this.requireWrite(actor);
    if (!authorized.ok) return authorized;
    return this.updateData((data) => {
      const email = input.email.toLowerCase();
      const account = data.accounts[email];
      if (!account) return { ok: false, error: "Account was not found." };
      if (isOperationsSuperAdmin(email)) {
        if (input.role !== "super_admin") return { ok: false, error: "The three fixed super-admin accounts cannot be demoted here." };
      } else if (!["officer", "member", "inactive"].includes(input.role)) {
        return { ok: false, error: "Only the fixed allowlist can hold the super-admin role." };
      }
      account.role = isOperationsSuperAdmin(email) ? "super_admin" : input.role;
      account.updatedAt = this.now().toISOString();
      account.updatedBy = actor.email.toLowerCase();
      this.appendActivity(data, actor.email, "Account role updated", `${email}: ${account.role}`);
      return { ok: true, account: { ...account } };
    });
  }
  async updateDocument(actor, input) {
    const authorized = this.requireWrite(actor);
    if (!authorized.ok) return authorized;
    return this.updateData((data) => {
      const document = data.documents[input.id];
      if (!document) return { ok: false, error: "Document was not found." };
      if (input.category && Object.keys(DOCUMENT_CATEGORY_LABELS).includes(input.category)) document.category = input.category;
      if (input.currentStatus && Object.keys(DOCUMENT_STATUS_LABELS).includes(input.currentStatus)) {
        document.currentStatus = input.currentStatus;
      }
      if (input.sourceStatus && ["verified", "unverified"].includes(input.sourceStatus)) {
        document.sourceStatus = input.sourceStatus;
      }
      if (typeof input.driveUrl === "string") document.driveUrl = validDocumentDriveUrl(input.driveUrl);
      if (typeof input.sourceNote === "string") document.sourceNote = cleanText(input.sourceNote, 1e3);
      if (input.ownerEmail && data.accounts[input.ownerEmail.toLowerCase()]) document.ownerEmail = input.ownerEmail.toLowerCase();
      if (document.sourceStatus === "verified" && !document.driveUrl) {
        return { ok: false, error: "A verified document needs a valid Drive link." };
      }
      document.lastVerifiedAt = document.sourceStatus === "verified" ? this.now().toISOString() : "";
      document.updatedAt = this.now().toISOString();
      document.updatedBy = actor.email.toLowerCase();
      this.appendActivity(data, actor.email, "Document updated", `${document.title}: ${document.currentStatus}`);
      return { ok: true, document: { ...document } };
    });
  }
  async updateReview(actor, input) {
    const authorized = this.requireWrite(actor);
    if (!authorized.ok) return authorized;
    return this.updateData((data) => {
      const review = data.reviews[input.id];
      if (!review) return { ok: false, error: "Review was not found." };
      const note = cleanText(input.note, 1200);
      const createdAt = this.now().toISOString();
      if (input.reviewerEmail) {
        const reviewerEmail = input.reviewerEmail.toLowerCase();
        if (!["draft", "changes_requested"].includes(review.stage)) {
          return { ok: false, error: "Reviewer assignment is frozen after the artifact is submitted for review." };
        }
        if (actor.email.toLowerCase() === review.ownerEmail) {
          return { ok: false, error: "The artifact owner cannot assign or replace the independent reviewer." };
        }
        if (!isOperationsSuperAdmin(reviewerEmail)) {
          return { ok: false, error: "The assigned reviewer must be one of the three privileged reviewers." };
        }
        if (reviewerEmail === review.ownerEmail) {
          return { ok: false, error: "The reviewer must be independent from the artifact owner." };
        }
        const previousReviewer = review.reviewerEmail;
        review.reviewerEmail = reviewerEmail;
        review.independentReviewer = true;
        review.history.unshift({
          id: randomId("review-history"),
          action: "assigned",
          fromStage: review.stage,
          toStage: review.stage,
          actorEmail: actor.email.toLowerCase(),
          note: note || `Reviewer changed from ${previousReviewer} to ${reviewerEmail}.`,
          createdAt
        });
      }
      if (input.decision) {
        const transitions = {
          submit: { from: ["draft", "changes_requested"], to: "ready_for_review" },
          start_review: { from: ["ready_for_review"], to: "in_review", reviewerOnly: true },
          approve: { from: ["in_review"], to: "approved", reviewerOnly: true },
          request_changes: { from: ["in_review"], to: "changes_requested", reviewerOnly: true },
          reopen: { from: ["approved"], to: "draft" }
        };
        const transition = transitions[input.decision];
        if (!transition.from.includes(review.stage)) return { ok: false, error: `This review cannot ${input.decision.replaceAll("_", " ")} from ${REVIEW_STAGE_LABELS[review.stage]}.` };
        if (transition.reviewerOnly && actor.email.toLowerCase() !== review.reviewerEmail) {
          return { ok: false, error: "Only the assigned independent reviewer can take that action." };
        }
        if (["approve", "request_changes"].includes(input.decision) && !note) {
          return { ok: false, error: "The reviewer must record a review note with the decision." };
        }
        if (review.ownerEmail === review.reviewerEmail) {
          return { ok: false, error: "Independent review requires a reviewer other than the artifact owner." };
        }
        const fromStage = review.stage;
        review.stage = transition.to;
        review.independentReviewer = review.ownerEmail !== review.reviewerEmail;
        review.history.unshift({
          id: randomId("review-history"),
          action: input.decision,
          fromStage,
          toStage: review.stage,
          actorEmail: actor.email.toLowerCase(),
          note,
          createdAt
        });
      }
      if (note) {
        review.reviewNotes.unshift({
          id: randomId("review-note"),
          authorEmail: actor.email.toLowerCase(),
          note,
          createdAt
        });
      }
      review.updatedAt = createdAt;
      this.appendActivity(data, actor.email, "Review updated", `${review.title}: ${REVIEW_STAGE_LABELS[review.stage]}`);
      return { ok: true, review: { ...review } };
    });
  }
};
var createOperationsStore = (dataPath, options) => new OperationsStore(dataPath, options);

// server/speakerOpsService.js
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import {
  SignJWT,
  createRemoteJWKSet,
  exportJWK,
  importPKCS8,
  jwtVerify
} from "jose";
import { randomBytes as randomBytes2 } from "node:crypto";
import { mkdir as mkdir2, readFile as readFile2, rename as rename2, writeFile as writeFile2 } from "node:fs/promises";
import path2 from "node:path";
import { BlobPreconditionFailedError as BlobPreconditionFailedError2, get as get2, put as put2 } from "@vercel/blob";
var CONVEX_TOKEN_TTL_SECONDS = 5 * 60;
var LOGTO_CLOCK_TOLERANCE_SECONDS = 10;
var LOGTO_MAX_TOKEN_AGE_SECONDS = 2 * 60 * 60;
var LOGTO_JWKS_TIMEOUT_MS = 5e3;
var LOGTO_JWKS_COOLDOWN_MS = 3e4;
var LOGTO_JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1e3;
var MAX_CONVEX_PUBLIC_KEYS = 3;
var acceptedLogtoAlgorithms = ["ES384", "RS256"];
var AuthBridgeTokenError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthBridgeTokenError";
  }
};
var required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
};
var privateJwkParameters = ["d", "p", "q", "dp", "dq", "qi", "oth", "k"];
var parsePublicJwks = (raw) => {
  const parsed = JSON.parse(raw);
  const keys = Array.isArray(parsed.keys) ? parsed.keys : [];
  if (keys.length < 1 || keys.length > MAX_CONVEX_PUBLIC_KEYS) {
    throw new Error(`CONVEX_AUTH_PUBLIC_JWKS must contain 1-${MAX_CONVEX_PUBLIC_KEYS} public RS256 signing keys.`);
  }
  const publicKeys = keys.map((key) => {
    const valid = key?.kty === "RSA" && key?.alg === "RS256" && key?.use === "sig" && typeof key?.kid === "string" && Boolean(key.kid.trim()) && typeof key?.n === "string" && Boolean(key.n) && typeof key?.e === "string" && Boolean(key.e) && privateJwkParameters.every((parameter) => !(parameter in key));
    if (!valid) {
      throw new Error("CONVEX_AUTH_PUBLIC_JWKS contains an invalid or private signing key.");
    }
    return {
      kty: "RSA",
      use: "sig",
      alg: "RS256",
      kid: String(key.kid).trim(),
      n: String(key.n),
      e: String(key.e)
    };
  });
  if (new Set(publicKeys.map(({ kid }) => kid)).size !== publicKeys.length) {
    throw new Error("CONVEX_AUTH_PUBLIC_JWKS signing key IDs must be unique.");
  }
  return { keys: publicKeys };
};
var normalizedAllowedOrigin = (raw) => {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("CONVEX_AUTH_ALLOWED_ORIGINS contains an invalid origin.");
  }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp || url.username || url.password || url.pathname !== "/" && url.pathname !== "" || url.search || url.hash) {
    throw new Error("CONVEX_AUTH_ALLOWED_ORIGINS must contain exact HTTPS origins.");
  }
  return url.origin;
};
var authBridgeConfig = (environment = process.env) => {
  const logtoIssuer = required(environment, "LOGTO_ISSUER").replace(/\/$/, "");
  return {
    logtoIssuer,
    logtoAppId: required(environment, "LOGTO_APP_ID"),
    logtoJwksUrl: `${logtoIssuer}/jwks`,
    bridgeIssuer: required(environment, "CONVEX_AUTH_ISSUER").replace(/\/$/, ""),
    bridgeAppId: required(environment, "CONVEX_AUTH_APP_ID"),
    signingPrivateKey: required(environment, "CONVEX_AUTH_SIGNING_PRIVATE_KEY"),
    publicJwks: parsePublicJwks(required(environment, "CONVEX_AUTH_PUBLIC_JWKS")),
    allowedOrigins: new Set(
      required(environment, "CONVEX_AUTH_ALLOWED_ORIGINS").split(",").map((origin) => origin.trim()).filter(Boolean).map(normalizedAllowedOrigin)
    )
  };
};
var stringClaim = (payload, name) => {
  const value = payload[name];
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
};
var verifiedLogtoIdentity = (payload) => {
  const subject = stringClaim(payload, "sub");
  const email = stringClaim(payload, "email")?.toLowerCase();
  if (!subject || !email || payload.email_verified !== true) {
    throw new AuthBridgeTokenError("The Logto identity must contain a verified email address.");
  }
  return {
    subject,
    email,
    emailVerified: true,
    name: stringClaim(payload, "name"),
    picture: stringClaim(payload, "picture")
  };
};
var remoteKeySets = /* @__PURE__ */ new Map();
var remoteKeySet = (url) => {
  const existing = remoteKeySets.get(url);
  if (existing) return existing;
  const created = createRemoteJWKSet(new URL(url), {
    timeoutDuration: LOGTO_JWKS_TIMEOUT_MS,
    cooldownDuration: LOGTO_JWKS_COOLDOWN_MS,
    cacheMaxAge: LOGTO_JWKS_CACHE_MAX_AGE_MS
  });
  remoteKeySets.set(url, created);
  return created;
};
var validateLogtoTokenClaims = (payload, logtoAppId) => {
  const audiences = Array.isArray(payload.aud) ? payload.aud : typeof payload.aud === "string" ? [payload.aud] : [];
  const authorizedParty = stringClaim(payload, "azp");
  if (audiences.length > 1 && !authorizedParty) {
    throw new AuthBridgeTokenError("A multi-audience Logto ID token must identify its authorized party.");
  }
  if (authorizedParty && authorizedParty !== logtoAppId) {
    throw new AuthBridgeTokenError("The Logto ID token authorized party does not match this application.");
  }
  if (typeof payload.iat !== "number" || typeof payload.exp !== "number" || payload.exp <= payload.iat || payload.exp - payload.iat > LOGTO_MAX_TOKEN_AGE_SECONDS) {
    throw new AuthBridgeTokenError("The Logto ID token has an invalid validity window.");
  }
};
var cachedPrivateKeySource = "";
var cachedPrivateKey = null;
var cachedPublicKeyFingerprint = "";
var cachedSigningKeyMatch = null;
var signingKey = async (privateKey, publicJwks) => {
  const publicKeyFingerprint = publicJwks.keys.map((key) => `${key.kid || ""}:${key.n || ""}:${key.e || ""}`).join("|");
  if (!cachedPrivateKey || cachedPrivateKeySource !== privateKey) {
    cachedPrivateKey = await importPKCS8(privateKey, "RS256", { extractable: true });
    cachedPrivateKeySource = privateKey;
    cachedSigningKeyMatch = null;
  }
  if (cachedPublicKeyFingerprint !== publicKeyFingerprint) {
    cachedPublicKeyFingerprint = publicKeyFingerprint;
    cachedSigningKeyMatch = null;
  }
  cachedSigningKeyMatch ||= (async () => {
    const derived = await exportJWK(cachedPrivateKey);
    const matches = publicJwks.keys.filter((published) => derived.kty === "RSA" && derived.n === published.n && derived.e === published.e);
    if (matches.length !== 1 || !matches[0]?.kid) {
      throw new Error("The auth bridge signing key must match exactly one public JWKS key.");
    }
    return { key: cachedPrivateKey, kid: matches[0].kid };
  })();
  return await cachedSigningKeyMatch;
};
var exchangeLogtoIdTokenWithIdentity = async (idToken, config, keySet = remoteKeySet(config.logtoJwksUrl)) => {
  const { payload } = await jwtVerify(idToken, keySet, {
    issuer: config.logtoIssuer,
    audience: config.logtoAppId,
    algorithms: [...acceptedLogtoAlgorithms],
    requiredClaims: ["sub", "iat", "exp"],
    clockTolerance: LOGTO_CLOCK_TOLERANCE_SECONDS,
    maxTokenAge: LOGTO_MAX_TOKEN_AGE_SECONDS
  });
  validateLogtoTokenClaims(payload, config.logtoAppId);
  const identity = verifiedLogtoIdentity(payload);
  const activeSigningKey = await signingKey(config.signingPrivateKey, config.publicJwks);
  const token = await new SignJWT({
    email: identity.email,
    email_verified: identity.emailVerified,
    ...identity.name ? { name: identity.name } : {},
    ...identity.picture ? { picture: identity.picture } : {}
  }).setProtectedHeader({ alg: "RS256", kid: activeSigningKey.kid, typ: "JWT" }).setIssuer(config.bridgeIssuer).setAudience(config.bridgeAppId).setSubject(identity.subject).setIssuedAt().setExpirationTime(`${CONVEX_TOKEN_TTL_SECONDS}s`).sign(activeSigningKey.key);
  return {
    identity,
    token,
    expiresIn: CONVEX_TOKEN_TTL_SECONDS
  };
};
var SPEAKER_OPS_MEMBERS = [
  { name: "Alex Forstner", email: "alexfors@umich.edu", title: "VP Education" },
  { name: "Alexa Chiang", email: "atchiang@umich.edu", title: "Co-President" },
  { name: "Andrew Sackett", email: "andsack@umich.edu", title: "VP Events" },
  { name: "Cooper Perry", email: "cooperry@umich.edu", title: "Executive Vice President" },
  { name: "Landon Miller", email: "landonem@umich.edu", title: "VP Finance" },
  { name: "Lindsey Ye", email: "ylindsey@umich.edu", title: "VP Operations" },
  { name: "Sam Bodine", email: "sbodine@umich.edu", title: "Co-President" },
  { name: "Samantha Naber", email: "snaber@umich.edu", title: "Leadership Team" },
  { name: "Solomon Deyoung", email: "sdeyoun@umich.edu", title: "Leadership Team" }
];
var SPEAKER_STAGES = [
  "prospect",
  "in-conversation",
  "interested",
  "committed",
  "funding-blocked",
  "deferred",
  "closed"
];
var SPEAKER_FORMAT_LABELS = {
  "in-person": "In person",
  virtual: "Virtual",
  flexible: "Flexible",
  unknown: "Unknown"
};
var SPEAKER_CONFIDENCE_LABELS = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
  unverified: "Unverified"
};
var SPEAKER_RECOMMENDATION_LABELS = {
  recommended: "Recommended",
  alternate: "Alternate",
  hold: "Hold",
  research: "Needs research",
  "not-selected": "Not selected"
};
var SPEAKER_COST_STATUS_LABELS = {
  free: "Free",
  "quote-requested": "Quote requested",
  quoted: "Quoted",
  "funding-needed": "Funding needed",
  unknown: "Unknown"
};
var SPEAKER_TRAVEL_LABELS = {
  required: "Travel required",
  "not-required": "No travel required",
  unknown: "Unknown"
};
var PROPOSED_SLOT_STATUS_LABELS = {
  idea: "Internal option",
  offered: "Offered",
  accepted: "Accepted",
  declined: "Declined"
};
var PROGRAM_SLOT_STATUS_LABELS = {
  planning: "Planning",
  "room-requested": "Room requested",
  "room-approved": "Room approved",
  confirmed: "Confirmed"
};
var BLOB_PATH2 = "speaker-ops/state.json";
var WRITE_ATTEMPTS2 = 5;
var queues2 = /* @__PURE__ */ new Map();
var defaultDataPath2 = () => process.env.UBLDA_SPEAKER_OPS_DATA_FILE ? path2.resolve(process.env.UBLDA_SPEAKER_OPS_DATA_FILE) : path2.join(process.cwd(), ".ublda-local-data", "speaker-ops.json");
var isoNow = () => (/* @__PURE__ */ new Date()).toISOString();
var cleanText2 = (value, max = 500) => value.replace(/[<>]/g, "").trim().slice(0, max);
var randomId2 = (prefix) => `${prefix}_${randomBytes2(10).toString("base64url")}`;
var canUseBlob2 = (forceLocal) => !forceLocal && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
var mutationRejected2 = (result) => Boolean(
  result && typeof result === "object" && "ok" in result && result.ok === false
);
var hydrateLead = (lead) => ({
  confidence: "unverified",
  recommendation: "research",
  recommendationRank: null,
  selectionRationale: "",
  shortBio: "",
  education: [],
  credentials: [],
  qualifications: [],
  whyTheyMatter: "",
  speakerTimezone: "",
  proposedSlots: [],
  drawScore: null,
  drawRationale: "",
  missionFitScore: null,
  missionFitRationale: "",
  logisticsNotes: "",
  travelRequired: "unknown",
  costStatus: "unknown",
  quotedFee: null,
  fundingPlan: "",
  researchLinks: [],
  researchNotes: "General source links support the profile overall; education entries use their own source links where available. Unverified limitations are stated in each profile.",
  ...lead
});
var cleanScore = (value) => typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(5, Math.round(value))) : null;
var cleanOptionalNumber = (value, max) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value * 100) / 100)) : null;
var cleanUrl = (value) => {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 500) : "";
  } catch {
    return "";
  }
};
var cleanStringList = (value, maxItems = 12) => Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, maxItems).map((item) => cleanText2(item, 240)).filter(Boolean) : [];
var cleanProposedSlots = (value) => Array.isArray(value) ? value.slice(0, 8).flatMap((item, index) => {
  if (!item || typeof item !== "object") return [];
  const raw = item;
  const startAt = typeof raw.startAt === "string" ? cleanText2(raw.startAt, 80) : "";
  if (!startAt) return [];
  return [{
    id: typeof raw.id === "string" && raw.id ? cleanText2(raw.id, 80) : `slot-${index + 1}`,
    startAt,
    eventTimezone: typeof raw.eventTimezone === "string" ? cleanText2(raw.eventTimezone, 80) : "America/Detroit",
    status: raw.status && Object.keys(PROPOSED_SLOT_STATUS_LABELS).includes(raw.status) ? raw.status : "idea",
    evidence: typeof raw.evidence === "string" ? cleanText2(raw.evidence, 500) : ""
  }];
}) : [];
var cleanResearchLinks = (value) => Array.isArray(value) ? value.slice(0, 12).flatMap((item) => {
  if (!item || typeof item !== "object") return [];
  const raw = item;
  const url = cleanUrl(raw.url);
  if (!url) return [];
  return [{ label: typeof raw.label === "string" ? cleanText2(raw.label, 120) : "", url }];
}) : [];
var cleanEducation = (value) => Array.isArray(value) ? value.slice(0, 8).flatMap((item) => {
  if (!item || typeof item !== "object") return [];
  const raw = item;
  const school = typeof raw.school === "string" ? cleanText2(raw.school, 160) : "";
  if (!school) return [];
  return [{
    school,
    degree: typeof raw.degree === "string" ? cleanText2(raw.degree, 120) : "",
    year: typeof raw.year === "string" ? cleanText2(raw.year, 20) : "",
    evidenceUrl: cleanUrl(raw.evidenceUrl)
  }];
}) : [];
var normalizeLead = (id, raw, seed) => {
  const base = seed || hydrateLead({
    id,
    name: typeof raw.name === "string" ? cleanText2(raw.name, 120) : "Unverified speaker",
    organization: typeof raw.organization === "string" ? cleanText2(raw.organization, 160) : "Organization to verify",
    stage: "prospect",
    term: "later",
    format: "unknown",
    ownerEmail: "andsack@umich.edu",
    nextAction: "",
    evidence: "",
    blocker: "",
    lastContactAt: "",
    updatedAt: isoNow()
  });
  const merged = { ...base, ...raw, id };
  return {
    ...base,
    ...merged,
    name: cleanText2(String(merged.name || base.name), 120),
    organization: cleanText2(String(merged.organization || base.organization), 160),
    stage: SPEAKER_STAGES.includes(merged.stage) ? merged.stage : base.stage,
    term: ["fall-2026", "winter-2027", "later"].includes(String(merged.term)) ? merged.term : base.term,
    format: Object.keys(SPEAKER_FORMAT_LABELS).includes(String(merged.format)) ? merged.format : base.format,
    ownerEmail: isMemberEmail(String(merged.ownerEmail)) ? merged.ownerEmail : base.ownerEmail,
    confidence: Object.keys(SPEAKER_CONFIDENCE_LABELS).includes(String(merged.confidence)) ? merged.confidence : base.confidence,
    recommendation: Object.keys(SPEAKER_RECOMMENDATION_LABELS).includes(String(merged.recommendation)) ? merged.recommendation : base.recommendation,
    recommendationRank: cleanOptionalNumber(merged.recommendationRank, 99),
    selectionRationale: cleanText2(String(merged.selectionRationale || ""), 500),
    shortBio: cleanText2(String(merged.shortBio || ""), 800),
    education: cleanEducation(merged.education),
    credentials: cleanStringList(merged.credentials),
    qualifications: cleanStringList(merged.qualifications),
    whyTheyMatter: cleanText2(String(merged.whyTheyMatter || ""), 500),
    speakerTimezone: cleanText2(String(merged.speakerTimezone || ""), 80),
    proposedSlots: cleanProposedSlots(merged.proposedSlots),
    drawScore: cleanScore(merged.drawScore),
    drawRationale: cleanText2(String(merged.drawRationale || ""), 500),
    missionFitScore: cleanScore(merged.missionFitScore),
    missionFitRationale: cleanText2(String(merged.missionFitRationale || ""), 500),
    logisticsNotes: cleanText2(String(merged.logisticsNotes || ""), 500),
    travelRequired: Object.keys(SPEAKER_TRAVEL_LABELS).includes(String(merged.travelRequired)) ? merged.travelRequired : base.travelRequired,
    costStatus: Object.keys(SPEAKER_COST_STATUS_LABELS).includes(String(merged.costStatus)) ? merged.costStatus : base.costStatus,
    quotedFee: cleanOptionalNumber(merged.quotedFee, 1e6),
    fundingPlan: cleanText2(String(merged.fundingPlan || ""), 500),
    nextAction: cleanText2(String(merged.nextAction || ""), 240),
    evidence: cleanText2(String(merged.evidence || ""), 800),
    blocker: cleanText2(String(merged.blocker || ""), 500),
    researchLinks: cleanResearchLinks(merged.researchLinks),
    researchNotes: cleanText2(String(
      merged.researchNotes === "Public profile research has not been completed." && seed ? seed.researchNotes : merged.researchNotes || ""
    ), 1200),
    lastContactAt: cleanText2(String(merged.lastContactAt || ""), 80),
    updatedAt: cleanText2(String(merged.updatedAt || base.updatedAt), 80)
  };
};
var leadSeeds = () => {
  const updatedAt = "2026-08-10T19:00:00.000Z";
  const seeds = [
    {
      id: "deb-ruh",
      name: "Debra Ruh",
      organization: "Ruh Global IMPACT",
      stage: "committed",
      term: "fall-2026",
      format: "flexible",
      ownerEmail: "andsack@umich.edu",
      confidence: "high",
      recommendation: "recommended",
      recommendationRank: 1,
      selectionRationale: "Direct fall enthusiasm and a mission-aligned accessibility leadership profile make this the lowest-friction anchor.",
      shortBio: "Founder and disability-inclusion leader behind Ruh Global IMPACT; invited for a fall fireside on accessibility leadership and business.",
      education: [{ school: "University of North Florida", degree: "Attendance verified; degree and field unverified", year: "1980\u20131982", evidenceUrl: "https://www.linkedin.com/in/debraruh" }],
      credentials: ["Founder, Ruh Global IMPACT", "Chair, Billion Strong"],
      qualifications: ["Accessibility entrepreneur", "Author and podcaster", "Global disability-inclusion advocate"],
      whyTheyMatter: "A direct accessibility-industry voice with a warm relationship and clear relevance to UBLDA's mission.",
      drawScore: 4,
      drawRationale: "Recognized disability-inclusion leader with founder and global-community credentials; credible cross-campus appeal without celebrity dependence.",
      missionFitScore: 5,
      missionFitRationale: "Accessibility leadership and disability identity are directly aligned with UBLDA.",
      researchLinks: [
        { label: "Billion Strong", url: "https://www.billion-strong.org/" },
        { label: "Debra Ruh LinkedIn", url: "https://www.linkedin.com/in/debraruh" }
      ],
      researchNotes: "Education is self-reported on LinkedIn; degree and field are not verified.",
      speakerTimezone: "America/New_York",
      proposedSlots: [
        { id: "deb-oct-1", startAt: "2026-10-01T18:30:00-04:00", eventTimezone: "America/Detroit", status: "idea", evidence: "Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. Re-check live calendars before offering; speaker and room availability remain unconfirmed." },
        { id: "deb-oct-22", startAt: "2026-10-22T18:30:00-04:00", eventTimezone: "America/Detroit", status: "idea", evidence: "Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. Re-check live calendars before offering; speaker and room availability remain unconfirmed." }
      ],
      nextAction: "Offer Oct 1 at 6:30 p.m. ET, with Oct 22 at 6:30 p.m. as backup, after the room gate is clear.",
      evidence: "Aug 10 Gmail: she is so looking forward to joining UBLDA for the fireside chat this fall.",
      blocker: "No Ross room has been requested or approved.",
      lastContactAt: "2026-08-10T14:00:00.000Z",
      updatedAt
    },
    {
      id: "rich-donovan",
      name: "Rich Donovan",
      organization: "The Return on Disability Group",
      stage: "committed",
      term: "fall-2026",
      format: "flexible",
      ownerEmail: "andsack@umich.edu",
      confidence: "high",
      recommendation: "recommended",
      recommendationRank: 2,
      selectionRationale: "Direct acceptance plus a strong business-case angle makes him the clearest second event for Ross students.",
      shortBio: "Founder of The Return on Disability Group, invited to discuss the business case for disability inclusion and corporate strategy.",
      education: [
        { school: "Schulich School of Business, York University", degree: "BBA", year: "", evidenceUrl: "https://blogs.worldbank.org/en/team/r/rich-donovan" },
        { school: "Columbia Business School", degree: "MBA", year: "", evidenceUrl: "https://blogs.worldbank.org/en/team/r/rich-donovan" }
      ],
      credentials: ["Founder and CEO, The Return on Disability Group", "Creator of the Return on Disability model"],
      qualifications: ["Disability-market and corporate-strategy specialist", "Former Merrill Lynch portfolio-management and trading professional"],
      whyTheyMatter: "His business-case framing is unusually well matched to a Ross audience and UBLDA's education mission.",
      drawScore: 4,
      drawRationale: "Corporate-strategy and disability-market framing should appeal to Ross students beyond the existing disability community.",
      missionFitScore: 5,
      missionFitRationale: "Connects disability inclusion to business strategy, which is central to UBLDA's Ross-facing mission.",
      researchLinks: [{ label: "World Bank expert profile", url: "https://blogs.worldbank.org/en/team/r/rich-donovan" }],
      researchNotes: "World Bank profile supports education, finance background, and Return on Disability work.",
      speakerTimezone: "America/Toronto",
      proposedSlots: [
        { id: "rich-nov-17", startAt: "2026-11-17T18:30:00-05:00", eventTimezone: "America/Detroit", status: "idea", evidence: "Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. After Ross Tech Week and eight days before Thanksgiving. Re-check live calendars before offering; speaker and room availability remain unconfirmed." },
        { id: "rich-nov-19", startAt: "2026-11-19T18:30:00-05:00", eventTimezone: "America/Detroit", status: "idea", evidence: "Aug 14, 2026 dated calendar snapshot: no busy block appeared in the calendars checked. Re-check live calendars before offering; speaker and room availability remain unconfirmed." }
      ],
      nextAction: "Offer Nov 17 at 6:30 p.m. ET, with Nov 19 at 6:30 p.m. as backup.",
      evidence: "Jul 30 verified Gmail acceptance: he would be delighted to speak and told UBLDA to tell him when.",
      blocker: "No date, format, or room is confirmed.",
      lastContactAt: "2026-07-30",
      updatedAt
    },
    {
      id: "grant-shelton",
      name: "Grant Shelton",
      organization: "GTH Consulting",
      stage: "interested",
      term: "winter-2027",
      format: "virtual",
      ownerEmail: "sdeyoun@umich.edu",
      confidence: "high",
      recommendation: "alternate",
      selectionRationale: "Open to an October Zoom, but the manager still requires fit, format, audience, and funding answers.",
      travelRequired: "not-required",
      costStatus: "quote-requested",
      shortBio: "Potential neurodiversity and workplace speaker represented by booking manager Erin; exact identity and public background remain unverified.",
      whyTheyMatter: "The proposed topic fits UBLDA, but selection should wait until identity, audience fit, and cost are verified.",
      researchNotes: "Identity, organization, education, and public credentials are unverified. Do not attach similarly named public profiles.",
      nextAction: "Keep warm for winter; send audience, topic, format, and funding facts when dates open.",
      evidence: "Gmail and the Drive tracker: his manager is open to a Zoom fireside if the fit is clear.",
      blocker: "Fall is capped; in-person would require travel support or a co-sponsor.",
      lastContactAt: "2026-08-03T14:00:00.000Z",
      updatedAt
    },
    {
      id: "tiffany-yu",
      name: "Tiffany Yu",
      organization: "Diversability",
      stage: "closed",
      term: "later",
      format: "in-person",
      ownerEmail: "sbodine@umich.edu",
      confidence: "high",
      recommendation: "hold",
      selectionRationale: "The separate fall event is closed on cost; preserve the relationship for a future funded or co-hosted opportunity.",
      costStatus: "quoted",
      quotedFee: 15e3,
      fundingPlan: "No approved UBLDA budget. Reopen only with a committed co-host or external funding.",
      shortBio: "Author of The Anti-Ableist Manifesto and founder and CEO of Diversability; formerly an investment banker at Goldman Sachs.",
      education: [
        { school: "Georgetown University McDonough School of Business", degree: "B 2010; honors study in finance and accounting", year: "2010", evidenceUrl: "https://msb.georgetown.edu/news-story/alumni/alumna-tiffany-yu-b10-on-reframing-disability-as-an-identity-of-pride/" },
        { school: "London School of Economics", degree: "Executive MSc, Social Business and Entrepreneurship", year: "", evidenceUrl: "https://blogs.lse.ac.uk/socialbusinesshub/2025/02/14/from-lse-to-advocacy-tiffany-yu-on-anti-ableism-and-social-change/" }
      ],
      credentials: ["Founder and CEO, Diversability", "Author, The Anti-Ableist Manifesto", "Three-time TEDx speaker"],
      qualifications: ["Former Goldman Sachs investment banker", "Accessibility advisory roles with FIFA World Cup 2026 and NIH rehabilitation programs"],
      whyTheyMatter: "High public profile and direct disability-pride relevance create exceptional draw, but the quoted fee makes a separate event unrealistic now.",
      drawScore: 5,
      drawRationale: "Author, TED speaker, and established disability-community founder with demonstrated broad public reach.",
      missionFitScore: 5,
      missionFitRationale: "Disability pride, anti-ableism, entrepreneurship, and leadership map directly to UBLDA.",
      researchLinks: [
        { label: "Official bio", url: "https://www.tiffanyyu.com/bio" },
        { label: "Georgetown profile", url: "https://msb.georgetown.edu/news-story/alumni/alumna-tiffany-yu-b10-on-reframing-disability-as-an-identity-of-pride/" },
        { label: "LSE profile", url: "https://blogs.lse.ac.uk/socialbusinesshub/2025/02/14/from-lse-to-advocacy-tiffany-yu-on-anti-ableism-and-social-change/" }
      ],
      nextAction: "Keep the relationship warm; do not plan a separate Fall 2026 event.",
      evidence: "Gmail: the representative quoted a discounted $15,000 in-person rate; the separate fall event was closed.",
      blocker: "A separate event is not viable without approved funding or a co-host.",
      lastContactAt: "2026-08-10T15:00:00.000Z",
      updatedAt
    },
    {
      id: "diego-mariscal",
      name: "Diego Mariscal",
      organization: "2Gether-International",
      stage: "interested",
      term: "winter-2027",
      format: "flexible",
      ownerEmail: "andsack@umich.edu",
      confidence: "high",
      recommendation: "alternate",
      selectionRationale: "Explicit yes, but the two-event fall slate is already filled by lower-friction confirmed-interest leads.",
      shortBio: "Founder and CEO of 2Gether-International, an accelerator for disabled entrepreneurs; disability advocate and former Mexican national Paralympic swimmer.",
      education: [{ school: "American University", degree: "Studied international relations; completion and degree title unverified", year: "", evidenceUrl: "https://www.dol.gov/agencies/odep/publications/success-stories/diego-mariscal" }],
      credentials: ["Founder and CEO, 2Gether-International"],
      qualifications: ["Disability entrepreneurship leader", "Former Mexican national Paralympic swimmer"],
      whyTheyMatter: "Entrepreneurship, disability, and founder experience align strongly with Ross students and UBLDA.",
      drawScore: 3,
      drawRationale: "Strong founder story and Paralympic background, though lower broad-name recognition than the marquee candidates.",
      missionFitScore: 5,
      missionFitRationale: "Disabled entrepreneurship is a direct UBLDA and Ross intersection.",
      researchLinks: [
        { label: "U.S. Department of Labor profile", url: "https://www.dol.gov/agencies/odep/publications/success-stories/diego-mariscal" },
        { label: "2Gether-International team", url: "https://www.2gether-international.org/our-team/2gi" }
      ],
      nextAction: "Book the planning call requested by his communications team.",
      evidence: "Accepted; communications team followed up Aug 5 for details.",
      blocker: "Audience, format, and date still need a planning call.",
      lastContactAt: "2026-08-05T15:00:00.000Z",
      updatedAt
    },
    {
      id: "neil-milliken",
      name: "Neil Milliken",
      organization: "Thrival Holdings",
      stage: "in-conversation",
      term: "winter-2027",
      format: "virtual",
      ownerEmail: "andsack@umich.edu",
      confidence: "medium",
      recommendation: "alternate",
      speakerTimezone: "Europe/London",
      travelRequired: "not-required",
      shortBio: "Accessibility strategist at Thrival Holdings, former Atos global accessibility leader, co-founder of AXSChat, and dyslexia and ADHD advocate.",
      education: [{ school: "University of Oxford", degree: "Studied English and History; degree title and completion not stated", year: "", evidenceUrl: "https://www.linkedin.com/pulse/neil-milliken-people-behind-tech-good-techuk-wxewf" }],
      credentials: ["Accessibility strategist, Thrival Holdings", "Former Atos VP and global head of accessibility", "Co-founder, AXSChat"],
      qualifications: ["Former W3C Cognitive Accessibility Taskforce invited expert", "IAAP leadership experience", "Disability Power 100 honoree"],
      whyTheyMatter: "Deep enterprise-accessibility expertise and a virtual format make him a high-substance, lower-logistics option.",
      drawScore: 3,
      drawRationale: "High credibility in enterprise accessibility, but likely strongest with a targeted rather than mass audience.",
      missionFitScore: 5,
      missionFitRationale: "Enterprise accessibility and neurodivergence advocacy are core UBLDA topics.",
      researchLinks: [
        { label: "techUK profile", url: "https://www.linkedin.com/pulse/neil-milliken-people-behind-tech-good-techuk-wxewf" },
        { label: "Neil Milliken LinkedIn", url: "https://uk.linkedin.com/in/neilmilliken" }
      ],
      researchNotes: "Public LinkedIn indicates he left Atos at the end of 2025 and is now with Thrival Holdings; display Atos as a former role.",
      nextAction: "Re-verify the two date windows from the July call.",
      evidence: "Brain notes a July 28 call and two dates; Gmail does not show them.",
      blocker: "Exact dates are not supported by the email thread.",
      lastContactAt: "2026-07-28T18:00:00.000Z",
      updatedAt
    },
    {
      id: "microsoft-alum",
      name: "Microsoft alumnus",
      organization: "Microsoft",
      stage: "prospect",
      term: "winter-2027",
      format: "in-person",
      ownerEmail: "alexfors@umich.edu",
      confidence: "low",
      recommendation: "research",
      shortBio: "Reported University of Michigan alum in accessibility engineering; exact name, employer, title, education, and credentials remain unverified.",
      whyTheyMatter: "A verified Microsoft and Michigan connection could draw students, but no selection should be made until the person is identified.",
      researchNotes: "Identity unverified. Do not display a guessed Microsoft executive.",
      nextAction: "Verify the speaker name and direct contact.",
      evidence: "The internal recap mentions an Oct 1 target; no contact appears in Gmail.",
      blocker: "Speaker identity and availability are unverified.",
      lastContactAt: "",
      updatedAt
    },
    {
      id: "mindy-scheier",
      name: "Mindy Scheier",
      organization: "Runway of Dreams",
      stage: "interested",
      term: "winter-2027",
      format: "flexible",
      ownerEmail: "landonem@umich.edu",
      confidence: "high",
      recommendation: "alternate",
      selectionRationale: "Accepted in principle, but the two-event fall slate is full; keep her at the front of the winter slate.",
      shortBio: "Founder and CEO of Runway of Dreams, a fashion-industry veteran who built adaptive-clothing initiatives after adapting jeans for her son.",
      education: [{ school: "University of Vermont and Fashion Institute of Technology", degree: "Dual-program study in Fashion Design; degree title and completion not stated", year: "", evidenceUrl: "https://www.runwayofdreams.org/our-founder" }],
      credentials: ["Founder and CEO, Runway of Dreams", "Founder, Gamut Talent Management", "TED speaker"],
      qualifications: ["Partnered with Tommy Hilfiger on a mainstream adaptive-clothing line", "Adaptive fashion and disability-inclusion leader"],
      whyTheyMatter: "Adaptive fashion is visual, consumer-facing, and unusually accessible to a broad student audience.",
      drawScore: 4,
      drawRationale: "Adaptive fashion, Tommy Hilfiger experience, and TED visibility give the event a concrete, broadly understandable hook.",
      missionFitScore: 5,
      missionFitRationale: "Adaptive design and disability inclusion are directly mission aligned.",
      researchLinks: [{ label: "Runway of Dreams founder profile", url: "https://www.runwayofdreams.org/our-founder" }],
      nextAction: "Keep warm until the winter slot clears the room gate.",
      evidence: "Said she would be honored; planning remains open.",
      blocker: "No date, format, or room is confirmed.",
      lastContactAt: "2026-07-25T14:00:00.000Z",
      updatedAt
    },
    {
      id: "alex-singleton",
      name: "Alex Singleton",
      organization: "Organization to verify",
      stage: "in-conversation",
      term: "winter-2027",
      format: "virtual",
      ownerEmail: "cooperry@umich.edu",
      confidence: "medium",
      recommendation: "hold",
      shortBio: "Denver Broncos inside linebacker and team captain whose Special Olympics advocacy is inspired by his sister Ashley, who has Down syndrome.",
      education: [{ school: "Montana State University", degree: "Sociology-Criminology", year: "2015", evidenceUrl: "https://msubobcats.com/news/2015/5/7/GEN_0507153114.aspx" }],
      credentials: ["Denver Broncos inside linebacker and team captain", "2024 Walter Payton NFL Man of the Year nominee"],
      qualifications: ["Longtime Special Olympics advocate", "Led the Broncos in tackles in 2025"],
      whyTheyMatter: "NFL visibility and an authentic disability-family connection could drive exceptional campus interest if the warm introduction converts.",
      drawScore: 5,
      drawRationale: "Active NFL captain and Special Olympics advocate is the strongest raw-attendance prospect in the researched slate.",
      missionFitScore: 4,
      missionFitRationale: "Authentic disability-family advocacy fits well, though the business and accessibility content would need careful framing.",
      researchLinks: [
        { label: "Montana State education record", url: "https://msubobcats.com/news/2015/5/7/GEN_0507153114.aspx" },
        { label: "Denver Broncos contract update", url: "https://www.denverbroncos.com/news/broncos-re-sign-ilb-alex-singleton-to-2-year-contract" },
        { label: "Broncos Special Olympics profile", url: "https://www.denverbroncos.com/news/mile-high-morning-ilb-alex-singleton-shares-his-inspiration-for-lifelong-commitment-to-special-olympics" }
      ],
      nextAction: "Keep the warm introduction moving; do not hold a date yet.",
      evidence: "Drive tracker: warm introduction is in progress through Lloyd.",
      blocker: "Direct contact, organization, topic, and availability are not yet verified.",
      lastContactAt: "",
      updatedAt
    },
    {
      id: "dustin-giannelli",
      name: "Dustin Giannelli",
      organization: "HearsDustin LLC",
      stage: "interested",
      term: "winter-2027",
      format: "unknown",
      ownerEmail: "sdeyoun@umich.edu",
      confidence: "high",
      recommendation: "alternate",
      shortBio: "Founder and CEO of HearsDustin, a keynote speaker and accessibility strategist with bilateral hearing loss.",
      education: [{ school: "University of New Hampshire, Whittemore School of Business", degree: "Degree reported; exact title and major not independently verified", year: "2008\u20132012", evidenceUrl: "https://www.innocaption.com/recentnews/q-a-hearsdustin" }],
      credentials: ["Founder and CEO, HearsDustin"],
      qualifications: ["Keynotes and workshops for Peloton, Converse, NBCUniversal, Sony, Princeton, and University of Michigan"],
      whyTheyMatter: "A proven keynote record plus direct hearing-access experience offers a practical, high-energy campus event.",
      drawScore: 3,
      drawRationale: "Experienced corporate keynote speaker with credible brands, but limited mass-name recognition.",
      missionFitScore: 5,
      missionFitRationale: "Hearing access, communication, and workplace inclusion are highly relevant.",
      researchLinks: [
        { label: "InnoCaption interview", url: "https://www.innocaption.com/recentnews/q-a-hearsdustin" },
        { label: "HearsDustin", url: "https://www.hearsdustin.com/" }
      ],
      nextAction: "Answer his audience, format, timing, location, and sponsor questions before a short call.",
      evidence: "Gmail: he offered an introduction call and asked five concrete planning questions.",
      blocker: "Format, timing, room, and sponsor or budget position are still open.",
      lastContactAt: "2026-08-04T14:00:00.000Z",
      updatedAt
    },
    {
      id: "maayan-ziv",
      name: "Maayan Ziv",
      organization: "AccessNow",
      stage: "interested",
      term: "winter-2027",
      format: "unknown",
      ownerEmail: "atchiang@umich.edu",
      confidence: "medium",
      recommendation: "hold",
      shortBio: "Founder and CEO of AccessNow, an accessibility mapping and community platform; entrepreneur and activist with muscular dystrophy.",
      education: [
        { school: "Toronto Metropolitan University", degree: "BA, Radio and Television Arts", year: "2012", evidenceUrl: "https://www.torontomu.ca/alumni/podcasts/ryerson-rewind/ryerson-rewind-s02e01/" },
        { school: "Toronto Metropolitan University", degree: "Master of Digital Media", year: "2015", evidenceUrl: "https://www.torontomu.ca/alumni/podcasts/ryerson-rewind/ryerson-rewind-s02e01/" }
      ],
      credentials: ["Founder and CEO, AccessNow", "Meritorious Service Cross, Canada"],
      qualifications: ["Accessibility technology entrepreneur", "Disability activist and community builder"],
      whyTheyMatter: "AccessNow connects disability, technology, entrepreneurship, and community in a concrete product story.",
      drawScore: 4,
      drawRationale: "Award-winning technology founder with a tangible accessibility product and strong entrepreneurship story.",
      missionFitScore: 5,
      missionFitRationale: "Accessibility technology and disabled entrepreneurship directly fit UBLDA.",
      researchLinks: [
        { label: "Toronto Metropolitan University alumni profile", url: "https://www.torontomu.ca/alumni/podcasts/ryerson-rewind/ryerson-rewind-s02e01/" },
        { label: "TMU Meritorious Service Cross announcement", url: "https://www.torontomu.ca/news-events/news/2024/07/two-tmu-alumni-receive-meritorious-service-decorations-from-the-governor-general/" }
      ],
      nextAction: "Send a winter hold note after the winter planning window opens.",
      evidence: "Brain and Drive tracker: interested, with timing affected by fall travel.",
      blocker: "The current Gmail search did not surface a direct date commitment.",
      lastContactAt: "",
      updatedAt
    },
    {
      id: "scott-fedor",
      name: "Scott Fedor",
      organization: "Getting Back Up",
      stage: "interested",
      term: "winter-2027",
      format: "unknown",
      ownerEmail: "snaber@umich.edu",
      confidence: "medium",
      recommendation: "hold",
      nextAction: "Send a winter hold note after the winter planning window opens.",
      evidence: "Drive tracker: interested, with no date selected.",
      blocker: "Format, topic, and availability need direct verification.",
      researchLinks: [
        { label: "Scott Fedor official bio", url: "https://www.scottwfedor.com/about/" },
        { label: "Scott Fedor resume", url: "https://www.scottwfedor.com/wp-content/uploads/2010/06/SWFedorResume.pdf" }
      ],
      researchNotes: "Official bio and resume support the corrected surname, education, authorship, and speaking background.",
      shortBio: "Ross alumnus, author, motivational speaker, and founder of Getting Back Up after a diving accident left him paralyzed.",
      education: [
        { school: "Lehigh University", degree: "BS, Finance", year: "1998", evidenceUrl: "https://www.scottwfedor.com/wp-content/uploads/2010/06/SWFedorResume.pdf" },
        { school: "University of Michigan Ross School of Business", degree: "MBA, Marketing", year: "2004", evidenceUrl: "https://www.scottwfedor.com/wp-content/uploads/2010/06/SWFedorResume.pdf" }
      ],
      credentials: ["Author, Head Strong", "Founder, Getting Back Up"],
      qualifications: ["Speaker for businesses and schools", "Disability nonprofit founder"],
      whyTheyMatter: "A Ross alum with a personal disability story and an existing speaking practice creates strong campus relevance.",
      drawScore: 3,
      drawRationale: "Ross alumni connection and author-speaker experience create targeted campus relevance.",
      missionFitScore: 4,
      missionFitRationale: "Disability lived experience and nonprofit work fit, though the business-accessibility lens is less direct.",
      lastContactAt: "",
      updatedAt
    },
    {
      id: "diane-swonk",
      name: "Diane Swonk",
      organization: "KPMG",
      stage: "deferred",
      term: "later",
      format: "in-person",
      ownerEmail: "sbodine@umich.edu",
      confidence: "high",
      recommendation: "not-selected",
      shortBio: "Chief economist and managing director at KPMG US, prominent economic commentator, University of Michigan economics alumna, and dyslexia advocate.",
      education: [
        { school: "University of Michigan", degree: "AB, Economics", year: "1984", evidenceUrl: "https://prod.lsa.umich.edu/econ/alumni-friends/economics-leadership-council--elc-/diane-c--swonk.html" },
        { school: "University of Michigan", degree: "AM, Applied Economics", year: "1985", evidenceUrl: "https://prod.lsa.umich.edu/econ/alumni-friends/economics-leadership-council--elc-/diane-c--swonk.html" },
        { school: "University of Chicago Booth School of Business", degree: "Master\u2019s study in finance and strategic planning", year: "", evidenceUrl: "https://kpmg.com/us/en/how-we-work/people/s/swonk-diane.html" }
      ],
      credentials: ["Chief Economist and Managing Director, KPMG US", "NABE Fellow"],
      qualifications: ["Adviser to federal economic bodies", "National and international economic commentator", "Dyslexia advocate"],
      whyTheyMatter: "A top economist with Michigan ties and a disability lens would draw broadly across Ross, but the offered dates conflicted with finals.",
      drawScore: 5,
      drawRationale: "National economic visibility, KPMG title, and Michigan ties give her exceptional Ross-wide appeal.",
      missionFitScore: 4,
      missionFitRationale: "The dyslexia and judgment angle is meaningful, though disability inclusion is not her primary public work.",
      researchLinks: [
        { label: "U-M Economics profile", url: "https://prod.lsa.umich.edu/econ/alumni-friends/economics-leadership-council--elc-/diane-c--swonk.html" },
        { label: "KPMG profile", url: "https://kpmg.com/us/en/how-we-work/people/s/swonk-diane.html" }
      ],
      nextAction: "Reconnect for a 2027 date outside finals.",
      evidence: "KPMG agreed Aug 10 to reconnect in 2027.",
      blocker: "Dec 14\u201316 overlaps Ross final exams.",
      lastContactAt: "2026-08-10T15:30:00.000Z",
      updatedAt
    },
    {
      id: "victor-pineda",
      name: "Victor Pineda",
      organization: "World Enabled",
      stage: "closed",
      term: "later",
      format: "unknown",
      ownerEmail: "andsack@umich.edu",
      confidence: "high",
      recommendation: "not-selected",
      selectionRationale: "No reply; the Aug 9 operating decision says not to chase.",
      shortBio: "Disability-rights scholar, urban planner, and founder of World Enabled and the Pineda Foundation.",
      education: [
        { school: "University of California, Berkeley", degree: "BA, Political Economy; BS, Business Administration", year: "", evidenceUrl: "https://www.vpineda.com/about-disability-rights" },
        { school: "University of California, Berkeley", degree: "Master of City and Regional Planning", year: "", evidenceUrl: "https://www.vpineda.com/about-disability-rights" },
        { school: "University of California, Los Angeles", degree: "PhD, Urban Planning", year: "", evidenceUrl: "https://www.vpineda.com/about-disability-rights" }
      ],
      credentials: ["Fulbright Scholar", "Founder, World Enabled and Pineda Foundation"],
      qualifications: ["Former UC Berkeley Chancellor\u2019s Postdoctoral Fellow", "Consultant to the United Nations and World Bank", "World Economic Forum council member"],
      whyTheyMatter: "His global disability-rights and inclusive-city expertise is impressive, but the relationship is closed after no reply.",
      drawScore: 3,
      drawRationale: "Deep international credentials would attract policy and accessibility audiences, but lower broad student recognition.",
      missionFitScore: 5,
      missionFitRationale: "Disability rights, inclusive systems, and global accessibility are directly aligned.",
      researchLinks: [{ label: "Victor Pineda official bio", url: "https://www.vpineda.com/about-disability-rights" }],
      nextAction: "No further outreach unless he re-engages.",
      evidence: "Brain document 60 records no reply and no chasing.",
      blocker: "No response.",
      lastContactAt: "",
      updatedAt
    },
    {
      id: "dr-connolly",
      name: "Dr. Connolly",
      organization: "Organization to verify",
      stage: "closed",
      term: "later",
      format: "unknown",
      ownerEmail: "andsack@umich.edu",
      confidence: "high",
      recommendation: "not-selected",
      selectionRationale: "No reply; the Aug 9 operating decision says not to chase.",
      shortBio: "Outreach candidate whose full name, organization, discipline, education, and credentials have not been verified.",
      whyTheyMatter: "Reconsider only if a reply establishes the person\u2019s identity and fit.",
      researchNotes: "Identity unverified. Do not display a guessed biography.",
      nextAction: "No further outreach unless they re-engage.",
      evidence: "Brain document 60 records no reply and no chasing.",
      blocker: "No response; full identity and organization remain unverified.",
      lastContactAt: "",
      updatedAt
    }
  ];
  return seeds.map(hydrateLead);
};
var slotSeeds = () => [
  {
    id: "fall-2026-primary",
    label: "Fall fireside \xB7 Debra Ruh",
    term: "fall-2026",
    status: "planning",
    preferredStart: "2026-10-01T18:30:00-04:00",
    backupStart: "2026-10-22T18:30:00-04:00",
    leadId: "deb-ruh",
    roomRequestId: "room-fall-2026-primary",
    updatedAt: "2026-08-14T16:00:00.000Z"
  },
  {
    id: "fall-2026-secondary",
    label: "Fall fireside \xB7 Rich Donovan",
    term: "fall-2026",
    status: "planning",
    preferredStart: "2026-11-17T18:30:00-05:00",
    backupStart: "2026-11-19T18:30:00-05:00",
    leadId: "rich-donovan",
    roomRequestId: "room-fall-2026-secondary",
    updatedAt: "2026-08-14T16:00:00.000Z"
  }
];
var roomSeeds = () => slotSeeds().map((slot) => ({
  id: slot.roomRequestId,
  slotId: slot.id,
  status: "draft",
  preferredStart: slot.preferredStart,
  backupStart: slot.backupStart,
  setupMinutes: 30,
  teardownMinutes: 15,
  estimatedAttendance: 45,
  accessibilityNotes: "Step-free route and accessible seating required.",
  equipmentNotes: "Two chairs, two wireless microphones, projector optional.",
  requestedByEmail: "atchiang@umich.edu",
  submittedAt: "",
  responseDueAt: "",
  reference: "",
  roomName: "",
  updatedAt: "2026-08-14T16:00:00.000Z"
}));
var emptyData2 = () => ({
  version: 4,
  leads: Object.fromEntries(leadSeeds().map((lead) => [lead.id, lead])),
  slots: Object.fromEntries(slotSeeds().map((slot) => [slot.id, slot])),
  roomRequests: Object.fromEntries(roomSeeds().map((request) => [request.id, request])),
  activity: [{
    id: "seed_context_2026_08_14",
    actorEmail: "system",
    action: "Context checked",
    detail: "Brain, Gmail, Google Calendar, and Ross calendar guidance reconciled Aug 14. Fall 2026 is capped at two firesides.",
    createdAt: "2026-08-14T19:00:00.000Z"
  }]
});
var migrateData = (raw) => {
  const seeded = emptyData2();
  const rawLeads = { ...raw.leads || {} };
  if (rawLeads["scott-fiedor"] && !rawLeads["scott-fedor"]) {
    rawLeads["scott-fedor"] = {
      ...rawLeads["scott-fiedor"],
      id: "scott-fedor",
      name: "Scott Fedor",
      organization: "Getting Back Up"
    };
  }
  delete rawLeads["scott-fiedor"];
  const leadIds = /* @__PURE__ */ new Set([...Object.keys(seeded.leads), ...Object.keys(rawLeads)]);
  const leads = Object.fromEntries([...leadIds].map((id) => [
    id,
    normalizeLead(id, rawLeads[id] || {}, seeded.leads[id])
  ]));
  if (leads["neil-milliken"]?.organization === "Atos") {
    leads["neil-milliken"].organization = "Thrival Holdings";
  }
  if (leads["neil-milliken"]?.shortBio === "Accessibility strategist, former Atos global accessibility leader, co-founder of AXSChat, and dyslexia and ADHD advocate.") {
    leads["neil-milliken"].shortBio = seeded.leads["neil-milliken"].shortBio;
  }
  const legacySlotEvidence = /* @__PURE__ */ new Map([
    ["Preferred opening-slot recommendation after the Aug 14 calendar review.", seeded.leads["deb-ruh"].proposedSlots[0].evidence],
    ["All nine board calendars showed no busy block in the Aug 14 snapshot.", seeded.leads["deb-ruh"].proposedSlots[1].evidence],
    ["No busy block was recorded in the dated Aug 14 calendar snapshot reviewed for this slot.", seeded.leads["deb-ruh"].proposedSlots[1].evidence],
    ["Clear across all nine board calendars; after Ross Tech Week and eight days before Thanksgiving.", seeded.leads["rich-donovan"].proposedSlots[0].evidence],
    ["Clear across all nine board calendars in the Aug 14 snapshot.", seeded.leads["rich-donovan"].proposedSlots[1].evidence],
    ["No busy block was recorded in the dated Aug 14 calendar snapshot reviewed for this slot; after Ross Tech Week and eight days before Thanksgiving.", seeded.leads["rich-donovan"].proposedSlots[0].evidence],
    ["No busy block was recorded in the dated Aug 14 calendar snapshot reviewed for this slot.", seeded.leads["rich-donovan"].proposedSlots[1].evidence]
  ]);
  for (const lead of [leads["deb-ruh"], leads["rich-donovan"]]) {
    lead.proposedSlots = lead.proposedSlots.map((slot) => ({
      ...slot,
      evidence: legacySlotEvidence.get(slot.evidence) || slot.evidence
    }));
  }
  if (leads["rich-donovan"].lastContactAt === "2026-07-28T16:00:00.000Z") {
    leads["rich-donovan"].lastContactAt = seeded.leads["rich-donovan"].lastContactAt;
  }
  if (leads["rich-donovan"].evidence === "Direct Gmail acceptance: he would be delighted to speak and told UBLDA to tell him when.") {
    leads["rich-donovan"].evidence = seeded.leads["rich-donovan"].evidence;
  }
  if (raw.version !== 4) {
    Object.assign(leads["deb-ruh"], { term: "fall-2026", recommendation: "recommended", recommendationRank: 1 });
    Object.assign(leads["rich-donovan"], { term: "fall-2026", recommendation: "recommended", recommendationRank: 2 });
    Object.assign(leads["neil-milliken"], { term: "winter-2027" });
    Object.assign(leads["microsoft-alum"], { term: "winter-2027" });
    Object.assign(leads["tiffany-yu"], { stage: "closed", term: "later" });
    Object.assign(leads["diane-swonk"], { stage: "deferred", term: "later" });
    Object.assign(leads["victor-pineda"], { stage: "closed", term: "later" });
    Object.assign(leads["dr-connolly"], { stage: "closed", term: "later" });
  }
  const activity = Array.isArray(raw.activity) ? [...raw.activity] : seeded.activity;
  if (raw.version === 1) {
    Object.assign(leads, Object.fromEntries(leadSeeds().map((lead) => [lead.id, lead])));
    delete leads["grant-kessler"];
    activity.unshift({
      id: "context_reconciled_2026_08_10",
      actorEmail: "system",
      action: "Pipeline reconciled",
      detail: "Corrected Grant Shelton and loaded the verified Brain, Gmail, and Drive pipeline under the two-event cap.",
      createdAt: "2026-08-10T19:00:00.000Z"
    });
  }
  if (raw.version && raw.version < 4 && !activity.some((item) => item.id === "two_event_migration_2026_08_14")) {
    activity.unshift({
      id: "two_event_migration_2026_08_14",
      actorEmail: "system",
      action: "Fall slate updated",
      detail: "Program slots were reset to the two-event Fall 2026 plan. Legacy winter slot details were not promoted into a fall event.",
      createdAt: "2026-08-14T19:00:00.000Z"
    });
  }
  const legacyPrimary = raw.slots?.["fall-2026-primary"] || raw.slots?.["fall-2026"];
  const primarySeed = seeded.slots["fall-2026-primary"];
  const secondarySeed = seeded.slots["fall-2026-secondary"];
  const primary = {
    ...primarySeed,
    ...legacyPrimary || {},
    id: primarySeed.id,
    label: primarySeed.label,
    term: primarySeed.term,
    leadId: primarySeed.leadId,
    roomRequestId: primarySeed.roomRequestId,
    ...raw.version !== 4 ? { preferredStart: primarySeed.preferredStart, backupStart: primarySeed.backupStart } : {}
  };
  const secondary = {
    ...secondarySeed,
    ...raw.slots?.["fall-2026-secondary"] || {},
    id: secondarySeed.id,
    label: secondarySeed.label,
    term: secondarySeed.term,
    leadId: secondarySeed.leadId,
    roomRequestId: secondarySeed.roomRequestId,
    ...raw.version !== 4 ? { preferredStart: secondarySeed.preferredStart, backupStart: secondarySeed.backupStart } : {}
  };
  const legacyPrimaryRoom = raw.roomRequests?.["room-fall-2026-primary"] || raw.roomRequests?.["room-fall-2026"];
  const primaryRoomSeed = seeded.roomRequests["room-fall-2026-primary"];
  const secondaryRoomSeed = seeded.roomRequests["room-fall-2026-secondary"];
  const primaryRoom = {
    ...primaryRoomSeed,
    ...legacyPrimaryRoom || {},
    id: primaryRoomSeed.id,
    slotId: primaryRoomSeed.slotId,
    ...raw.version !== 4 ? { preferredStart: primaryRoomSeed.preferredStart, backupStart: primaryRoomSeed.backupStart } : {}
  };
  const secondaryRoom = {
    ...secondaryRoomSeed,
    ...raw.roomRequests?.["room-fall-2026-secondary"] || {},
    id: secondaryRoomSeed.id,
    slotId: secondaryRoomSeed.slotId,
    ...raw.version !== 4 ? { preferredStart: secondaryRoomSeed.preferredStart, backupStart: secondaryRoomSeed.backupStart } : {}
  };
  return {
    version: 4,
    leads,
    slots: { [primary.id]: primary, [secondary.id]: secondary },
    roomRequests: { [primaryRoom.id]: primaryRoom, [secondaryRoom.id]: secondaryRoom },
    activity
  };
};
var memberView = (email) => {
  const member = SPEAKER_OPS_MEMBERS.find((candidate) => candidate.email === email);
  return {
    name: member.name,
    email: member.email,
    title: member.title,
    canConfirmProgram: false
  };
};
var addBusinessDays = (iso, count) => {
  const date = new Date(iso);
  let added = 0;
  while (added < count) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date.toISOString();
};
var roomStatusTransitionAllowed = (current, next) => ({
  draft: ["draft", "submitted"],
  submitted: ["submitted", "approved", "declined"],
  approved: ["approved"],
  declined: ["declined", "draft"]
})[current].includes(next);
var hasApprovalEvidence = (value) => /[a-z0-9]/i.test(value) && value.trim().length >= 6;
var isMemberEmail = (email) => SPEAKER_OPS_MEMBERS.some((member) => member.email === email);
var memberForActor = (actor) => {
  const member = SPEAKER_OPS_MEMBERS.find((candidate) => candidate.email === actor.email);
  return member || {
    name: actor.displayName || actor.email,
    email: actor.email,
    title: "Leadership Team"
  };
};
var SpeakerOpsStore = class {
  dataPath;
  forceLocal;
  constructor(dataPath = defaultDataPath2(), options = {}) {
    this.dataPath = dataPath;
    this.forceLocal = Boolean(options.forceLocal);
  }
  storageKey() {
    return canUseBlob2(this.forceLocal) ? BLOB_PATH2 : this.dataPath;
  }
  async readLocal() {
    try {
      return JSON.parse(await readFile2(this.dataPath, "utf8"));
    } catch {
      return emptyData2();
    }
  }
  async writeLocal(data) {
    await mkdir2(path2.dirname(this.dataPath), { recursive: true });
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes2(5).toString("base64url")}.tmp`;
    await writeFile2(tempPath, `${JSON.stringify(data, null, 2)}
`, { mode: 384 });
    await rename2(tempPath, this.dataPath);
  }
  async readBlob() {
    const blob = await get2(BLOB_PATH2, { access: "private", useCache: false });
    if (!blob || blob.statusCode !== 200) return { data: emptyData2(), etag: null };
    const raw = await new Response(blob.stream).text();
    const etag = blob.blob.etag?.replace(/^W\//, "") || null;
    return { data: JSON.parse(raw), etag };
  }
  async writeBlob(data, etag) {
    await put2(BLOB_PATH2, `${JSON.stringify(data, null, 2)}
`, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      contentType: "application/json",
      ...etag ? { ifMatch: etag } : {}
    });
  }
  async updateData(mutation) {
    const key = this.storageKey();
    const previous = queues2.get(key) || Promise.resolve();
    const task = previous.catch(() => void 0).then(async () => {
      if (!canUseBlob2(this.forceLocal)) {
        const data = migrateData(await this.readLocal());
        const result = await mutation(data);
        if (mutationRejected2(result)) return result;
        await this.writeLocal(data);
        return result;
      }
      for (let attempt = 0; attempt < WRITE_ATTEMPTS2; attempt += 1) {
        const { data: rawData, etag } = await this.readBlob();
        const data = migrateData(rawData);
        const result = await mutation(data);
        if (mutationRejected2(result)) return result;
        try {
          await this.writeBlob(data, etag);
          return result;
        } catch (error) {
          if (!(error instanceof BlobPreconditionFailedError2) || attempt === WRITE_ATTEMPTS2 - 1) throw error;
        }
      }
      throw new Error("Speaker Ops storage could not be updated.");
    });
    queues2.set(key, task);
    try {
      return await task;
    } finally {
      if (queues2.get(key) === task) queues2.delete(key);
    }
  }
  appendActivity(data, actorEmail, action, detail) {
    data.activity.unshift({
      id: randomId2("activity"),
      actorEmail,
      action: cleanText2(action, 80),
      detail: cleanText2(detail, 300),
      createdAt: isoNow()
    });
    data.activity = data.activity.slice(0, 250);
  }
  async workspace(actor) {
    const member = memberForActor(actor);
    const rawData = canUseBlob2(this.forceLocal) ? (await this.readBlob()).data : await this.readLocal();
    const data = migrateData(rawData);
    if (rawData.version !== 4) {
      await this.updateData((stored) => {
        Object.assign(stored, data);
      });
    }
    return {
      viewer: {
        memberId: actor.memberId,
        name: actor.displayName || member.name,
        email: member.email,
        title: member.title,
        role: actor.role,
        canConfirmProgram: actor.role === "admin"
      },
      members: SPEAKER_OPS_MEMBERS.map((candidate) => memberView(candidate.email)),
      leads: Object.values(data.leads),
      slots: Object.values(data.slots),
      roomRequests: Object.values(data.roomRequests),
      activity: data.activity
    };
  }
  async updateLead(actor, leadInput) {
    const member = memberForActor(actor);
    return this.updateData((data) => {
      const lead = data.leads[leadInput.id];
      if (!lead) return { ok: false, error: "Speaker was not found." };
      if (leadInput.stage && SPEAKER_STAGES.includes(leadInput.stage)) lead.stage = leadInput.stage;
      if (leadInput.term && ["fall-2026", "winter-2027", "later"].includes(leadInput.term)) lead.term = leadInput.term;
      if (leadInput.format && Object.keys(SPEAKER_FORMAT_LABELS).includes(leadInput.format)) lead.format = leadInput.format;
      if (leadInput.ownerEmail && isMemberEmail(leadInput.ownerEmail)) lead.ownerEmail = leadInput.ownerEmail;
      if (leadInput.confidence && Object.keys(SPEAKER_CONFIDENCE_LABELS).includes(leadInput.confidence)) lead.confidence = leadInput.confidence;
      if (leadInput.recommendation && Object.keys(SPEAKER_RECOMMENDATION_LABELS).includes(leadInput.recommendation)) lead.recommendation = leadInput.recommendation;
      if (leadInput.recommendationRank === null || typeof leadInput.recommendationRank === "number") lead.recommendationRank = cleanOptionalNumber(leadInput.recommendationRank, 99);
      if (typeof leadInput.selectionRationale === "string") lead.selectionRationale = cleanText2(leadInput.selectionRationale, 500);
      if (typeof leadInput.shortBio === "string") lead.shortBio = cleanText2(leadInput.shortBio, 800);
      if (Array.isArray(leadInput.education)) lead.education = cleanEducation(leadInput.education);
      if (Array.isArray(leadInput.credentials)) lead.credentials = cleanStringList(leadInput.credentials);
      if (Array.isArray(leadInput.qualifications)) lead.qualifications = cleanStringList(leadInput.qualifications);
      if (typeof leadInput.whyTheyMatter === "string") lead.whyTheyMatter = cleanText2(leadInput.whyTheyMatter, 500);
      if (typeof leadInput.speakerTimezone === "string") lead.speakerTimezone = cleanText2(leadInput.speakerTimezone, 80);
      if (Array.isArray(leadInput.proposedSlots)) lead.proposedSlots = cleanProposedSlots(leadInput.proposedSlots);
      if (leadInput.drawScore === null || typeof leadInput.drawScore === "number") lead.drawScore = cleanScore(leadInput.drawScore);
      if (typeof leadInput.drawRationale === "string") lead.drawRationale = cleanText2(leadInput.drawRationale, 500);
      if (leadInput.missionFitScore === null || typeof leadInput.missionFitScore === "number") lead.missionFitScore = cleanScore(leadInput.missionFitScore);
      if (typeof leadInput.missionFitRationale === "string") lead.missionFitRationale = cleanText2(leadInput.missionFitRationale, 500);
      if (typeof leadInput.logisticsNotes === "string") lead.logisticsNotes = cleanText2(leadInput.logisticsNotes, 500);
      if (leadInput.travelRequired && Object.keys(SPEAKER_TRAVEL_LABELS).includes(leadInput.travelRequired)) lead.travelRequired = leadInput.travelRequired;
      if (leadInput.costStatus && Object.keys(SPEAKER_COST_STATUS_LABELS).includes(leadInput.costStatus)) lead.costStatus = leadInput.costStatus;
      if (leadInput.quotedFee === null || typeof leadInput.quotedFee === "number") lead.quotedFee = cleanOptionalNumber(leadInput.quotedFee, 1e6);
      if (typeof leadInput.fundingPlan === "string") lead.fundingPlan = cleanText2(leadInput.fundingPlan, 500);
      if (typeof leadInput.nextAction === "string") lead.nextAction = cleanText2(leadInput.nextAction, 240);
      if (typeof leadInput.evidence === "string") lead.evidence = cleanText2(leadInput.evidence, 800);
      if (typeof leadInput.blocker === "string") lead.blocker = cleanText2(leadInput.blocker, 500);
      if (Array.isArray(leadInput.researchLinks)) lead.researchLinks = cleanResearchLinks(leadInput.researchLinks);
      if (typeof leadInput.researchNotes === "string") lead.researchNotes = cleanText2(leadInput.researchNotes, 1200);
      if (typeof leadInput.lastContactAt === "string") lead.lastContactAt = cleanText2(leadInput.lastContactAt, 80);
      lead.updatedAt = isoNow();
      this.appendActivity(data, member.email, "Speaker updated", `${lead.name}: ${lead.nextAction || "No next action"}`);
      return { ok: true, lead: { ...lead } };
    });
  }
  async updateRoomRequest(actor, input) {
    const member = memberForActor(actor);
    return this.updateData((data) => {
      const request = data.roomRequests[input.id];
      if (!request) return { ok: false, error: "Room request was not found." };
      const requestedStatus = input.status && ["draft", "submitted", "approved", "declined"].includes(input.status) ? input.status : request.status;
      if (!roomStatusTransitionAllowed(request.status, requestedStatus)) {
        return { ok: false, error: `Room request cannot move from ${request.status} to ${requestedStatus}.` };
      }
      if (typeof input.preferredStart === "string") request.preferredStart = cleanText2(input.preferredStart, 80);
      if (typeof input.backupStart === "string") request.backupStart = cleanText2(input.backupStart, 80);
      if (typeof input.setupMinutes === "number") request.setupMinutes = Math.max(0, Math.min(180, Math.round(input.setupMinutes)));
      if (typeof input.teardownMinutes === "number") request.teardownMinutes = Math.max(0, Math.min(180, Math.round(input.teardownMinutes)));
      if (typeof input.estimatedAttendance === "number") request.estimatedAttendance = Math.max(1, Math.min(500, Math.round(input.estimatedAttendance)));
      if (typeof input.accessibilityNotes === "string") request.accessibilityNotes = cleanText2(input.accessibilityNotes, 500);
      if (typeof input.equipmentNotes === "string") request.equipmentNotes = cleanText2(input.equipmentNotes, 500);
      if (input.requestedByEmail && isMemberEmail(input.requestedByEmail)) request.requestedByEmail = input.requestedByEmail;
      if (typeof input.reference === "string") request.reference = cleanText2(input.reference, 120);
      if (typeof input.roomName === "string") request.roomName = cleanText2(input.roomName, 120);
      if (requestedStatus === "approved") {
        if (actor.role !== "admin") return { ok: false, error: "Only a workspace administrator can record Ross approval." };
        if (!request.roomName) return { ok: false, error: "Enter the Ross room before marking the request approved." };
        if (!hasApprovalEvidence(request.reference)) return { ok: false, error: "Add the Ross approval reference or source evidence before marking the request approved." };
      }
      request.status = requestedStatus;
      if (request.status === "submitted" && !request.submittedAt) {
        request.submittedAt = isoNow();
        request.responseDueAt = addBusinessDays(request.submittedAt, 3);
      }
      request.updatedAt = isoNow();
      const slot = data.slots[request.slotId];
      if (slot) {
        if (request.status === "submitted" && slot.status === "planning") slot.status = "room-requested";
        if (request.status === "approved" && slot.status !== "confirmed") slot.status = "room-approved";
        if (request.status === "declined") slot.status = "planning";
        if (request.status === "draft") slot.status = "planning";
        slot.updatedAt = request.updatedAt;
      }
      this.appendActivity(data, member.email, "Room request updated", `${request.slotId}: ${request.status}`);
      return { ok: true, roomRequest: { ...request } };
    });
  }
  async updateSlot(actor, input) {
    const member = memberForActor(actor);
    return this.updateData((data) => {
      const slot = data.slots[input.id];
      if (!slot) return { ok: false, error: "Program slot was not found." };
      if (typeof input.leadId === "string") {
        if (input.leadId && !data.leads[input.leadId]) return { ok: false, error: "Speaker was not found." };
        slot.leadId = input.leadId;
      }
      if (typeof input.preferredStart === "string") slot.preferredStart = cleanText2(input.preferredStart, 80);
      if (typeof input.backupStart === "string") slot.backupStart = cleanText2(input.backupStart, 80);
      if (input.status && Object.keys(PROGRAM_SLOT_STATUS_LABELS).includes(input.status)) {
        const nextStatus = input.status;
        const lead = slot.leadId ? data.leads[slot.leadId] : void 0;
        if (slot.leadId && (!lead || lead.term !== "fall-2026" || ["closed", "deferred"].includes(lead.stage))) {
          return { ok: false, error: "Choose an eligible Fall 2026 speaker before saving this slot." };
        }
        if (slot.leadId && Object.values(data.slots).some((candidate) => candidate.id !== slot.id && candidate.leadId === slot.leadId)) {
          return { ok: false, error: "Each fall slot must use a different speaker." };
        }
        if (nextStatus === "confirmed") {
          if (actor.role !== "admin") return { ok: false, error: "Only a workspace administrator can confirm a programmed date." };
          const request = data.roomRequests[slot.roomRequestId];
          if (request?.status !== "approved") return { ok: false, error: "Ross must approve the room before the fireside can be confirmed." };
          if (!slot.leadId) return { ok: false, error: "Choose a speaker before confirming the fireside." };
          if (!lead?.proposedSlots.some((proposed) => proposed.status === "accepted" && proposed.startAt === slot.preferredStart)) {
            return { ok: false, error: "The speaker must accept this exact proposed time before the fireside can be confirmed." };
          }
        }
        slot.status = nextStatus;
      }
      const selectedLead = slot.leadId ? data.leads[slot.leadId] : void 0;
      if (slot.leadId && (!selectedLead || selectedLead.term !== "fall-2026" || ["closed", "deferred"].includes(selectedLead.stage))) {
        return { ok: false, error: "Choose an eligible Fall 2026 speaker before saving this slot." };
      }
      if (slot.leadId && Object.values(data.slots).some((candidate) => candidate.id !== slot.id && candidate.leadId === slot.leadId)) {
        return { ok: false, error: "Each fall slot must use a different speaker." };
      }
      slot.label = selectedLead ? `Fall fireside \xB7 ${selectedLead.name}` : "Fall fireside \xB7 Unassigned";
      slot.updatedAt = isoNow();
      this.appendActivity(data, member.email, "Program slot updated", `${slot.label}: ${slot.status}`);
      return { ok: true, slot: { ...slot } };
    });
  }
};
var createSpeakerOpsStore = (dataPath, options) => new SpeakerOpsStore(dataPath, options);
var defaultStore = createSpeakerOpsStore();
var MAX_ID_TOKEN_LENGTH = 24e3;
var CONVEX_VIEWER_TIMEOUT_MS = 8e3;
var viewerReference = makeFunctionReference("viewer:current");
var SpeakerOpsAuthError = class extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.name = "SpeakerOpsAuthError";
    this.status = status;
  }
};
var defaultViewerQuery = async (convexToken, convexUrl, timeoutMs = CONVEX_VIEWER_TIMEOUT_MS) => {
  const fetchWithTimeout = (input, init) => fetch(input, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const client = new ConvexHttpClient(convexUrl, {
    auth: convexToken,
    logger: false,
    fetch: fetchWithTimeout
  });
  return client.query(viewerReference, {});
};
var withTimeout = async (promise, timeoutMs) => {
  let timeout;
  const deadline = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error("Leadership membership verification timed out.");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
var verifySpeakerOpsIdentity = async (idToken, dependencies = {}) => {
  if (!idToken || idToken.length > MAX_ID_TOKEN_LENGTH) {
    throw new SpeakerOpsAuthError(401, "Sign in with your UBLDA leadership account.");
  }
  const environment = dependencies.environment || process.env;
  const convexUrl = environment.CONVEX_URL?.trim() || environment.VITE_CONVEX_URL?.trim();
  if (!convexUrl) throw new SpeakerOpsAuthError(503, "Leadership authentication is not configured.");
  let exchange;
  try {
    if (dependencies.exchange) {
      exchange = await dependencies.exchange(idToken);
    } else {
      const config = authBridgeConfig(environment);
      exchange = await exchangeLogtoIdTokenWithIdentity(idToken, config);
    }
  } catch (error) {
    if (error instanceof SpeakerOpsAuthError) throw error;
    if (!dependencies.exchange && error instanceof Error && error.message.startsWith("Missing ")) {
      throw new SpeakerOpsAuthError(503, "Leadership authentication is not configured.");
    }
    throw new SpeakerOpsAuthError(401, "Your leadership sign-in is invalid or expired.");
  }
  let viewer;
  try {
    const timeoutMs = dependencies.viewerTimeoutMs ?? CONVEX_VIEWER_TIMEOUT_MS;
    const viewerPromise = dependencies.queryViewer ? dependencies.queryViewer(exchange.token, convexUrl) : defaultViewerQuery(exchange.token, convexUrl, timeoutMs);
    viewer = await withTimeout(viewerPromise, timeoutMs);
  } catch (error) {
    if (error instanceof ConvexError) {
      throw new SpeakerOpsAuthError(403, "This account is not approved for the UBLDA leadership workspace.");
    }
    throw new SpeakerOpsAuthError(503, "Leadership membership could not be verified.");
  }
  if (!viewer || viewer.status !== "active") {
    throw new SpeakerOpsAuthError(403, "This account is not an active UBLDA leadership member.");
  }
  return {
    memberId: viewer.memberId,
    displayName: viewer.displayName || exchange.identity.name || exchange.identity.email,
    email: exchange.identity.email,
    role: viewer.role
  };
};

// server/operationsService.ts
var defaultStore2 = createOperationsStore();
var allowedActions = /* @__PURE__ */ new Set([
  "workspace",
  "updateAttendance",
  "createStrike",
  "updateStrikeStatus",
  "updateAccount",
  "updateDocument",
  "updateReview"
]);
var textValue = (body, key) => typeof body[key] === "string" ? body[key].trim() : "";
var authStatus = (error) => {
  if (!error || typeof error !== "object" || !("status" in error)) return null;
  const status = Number(error.status);
  return [401, 403, 503].includes(status) ? status : null;
};
var writeErrorStatus = (error) => /only the three operations super admins/i.test(error) ? 403 : 400;
var handleOperationsRequest = async (rawBody, _ip = "unknown", options = {}) => {
  void _ip;
  const body = rawBody && typeof rawBody === "object" ? rawBody : {};
  const action = textValue(body, "action");
  if (!allowedActions.has(action)) return { status: 400, body: { error: "Unknown Operations action." } };
  const store = options.store || defaultStore2;
  const verifyIdentity = options.verifyIdentity || verifySpeakerOpsIdentity;
  try {
    const actor = await verifyIdentity(textValue(body, "idToken"));
    if (action === "workspace") {
      return { status: 200, body: { success: true, workspace: await store.workspace(actor) } };
    }
    if (!isOperationsSuperAdmin(actor.email)) {
      return { status: 403, body: { error: "Only the three Operations super admins can change this workspace." } };
    }
    if (action === "updateAttendance") {
      const attendance = body.attendance && typeof body.attendance === "object" ? body.attendance : null;
      if (!attendance?.eventId || !attendance.memberEmail) return { status: 400, body: { error: "Event and member are required." } };
      const result2 = await store.updateAttendance(actor, attendance);
      return result2.ok ? { status: 200, body: { success: true, ...result2 } } : { status: writeErrorStatus(result2.error), body: { error: result2.error } };
    }
    if (action === "createStrike") {
      const input = body.strike && typeof body.strike === "object" ? body.strike : null;
      if (!input?.memberEmail || !input.reason || !input.detail) return { status: 400, body: { error: "Member, reason, and evidence are required." } };
      const result2 = await store.createStrike(actor, {
        memberEmail: input.memberEmail,
        reason: input.reason,
        detail: input.detail,
        eventId: input.eventId
      });
      return result2.ok ? { status: 200, body: { success: true, ...result2 } } : { status: writeErrorStatus(result2.error), body: { error: result2.error } };
    }
    if (action === "updateStrikeStatus") {
      const input = body.strike && typeof body.strike === "object" ? body.strike : null;
      if (!input?.id || !input.status) return { status: 400, body: { error: "Strike and status are required." } };
      const result2 = await store.updateStrikeStatus(actor, {
        id: input.id,
        status: input.status,
        note: input.note || ""
      });
      return result2.ok ? { status: 200, body: { success: true, ...result2 } } : { status: writeErrorStatus(result2.error), body: { error: result2.error } };
    }
    if (action === "updateAccount") {
      const input = body.account && typeof body.account === "object" ? body.account : null;
      if (!input?.email || !input.role) return { status: 400, body: { error: "Account and role are required." } };
      const result2 = await store.updateAccount(actor, { email: input.email, role: input.role });
      return result2.ok ? { status: 200, body: { success: true, ...result2 } } : { status: writeErrorStatus(result2.error), body: { error: result2.error } };
    }
    if (action === "updateDocument") {
      const document = body.document && typeof body.document === "object" ? body.document : null;
      if (!document?.id) return { status: 400, body: { error: "Document is required." } };
      const result2 = await store.updateDocument(actor, { ...document, id: document.id });
      return result2.ok ? { status: 200, body: { success: true, ...result2 } } : { status: writeErrorStatus(result2.error), body: { error: result2.error } };
    }
    const review = body.review && typeof body.review === "object" ? body.review : null;
    if (!review?.id) return { status: 400, body: { error: "Review is required." } };
    const result = await store.updateReview(actor, {
      id: review.id,
      decision: review.decision,
      reviewerEmail: review.reviewerEmail,
      note: review.note || ""
    });
    return result.ok ? { status: 200, body: { success: true, ...result } } : { status: writeErrorStatus(result.error), body: { error: result.error } };
  } catch (error) {
    const status = authStatus(error);
    if (status) return { status, body: { error: error instanceof Error ? error.message : "Leadership sign-in failed." } };
    if (options.verifyIdentity) return { status: 401, body: { error: "Your leadership sign-in is invalid or expired." } };
    console.error("operations_request_failed", error instanceof Error ? error.name : "UnknownError");
    return { status: 500, body: { error: "Operations is temporarily unavailable." } };
  }
};
export {
  handleOperationsRequest
};
