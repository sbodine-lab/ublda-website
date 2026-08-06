// server/localRecruitingStore.ts
import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import bcrypt from "bcryptjs";

// src/lib/dashboardAccess.ts
var SUPER_ADMIN_EMAIL = "sbodine@umich.edu";
var ADMIN_SCOPES = ["recruiting", "members", "events", "announcements", "resources", "system"];
var ADMIN_ACCOUNTS = [
  {
    email: SUPER_ADMIN_EMAIL,
    name: "Sam Bodine",
    title: "Co-President",
    role: "super-admin",
    scopes: ["recruiting", "members", "events", "announcements", "resources", "system"],
    askAbout: "Partnerships, this portal, and anything that needs a decision."
  },
  {
    email: "atchiang@umich.edu",
    name: "Alexa Chiang",
    title: "Co-President",
    role: "exec",
    scopes: ["recruiting", "members", "events", "announcements", "resources"],
    askAbout: "Speakers, event dates, and anything that needs a decision."
  },
  {
    email: "cooperry@umich.edu",
    name: "Cooper Perry",
    title: "Executive Vice President",
    role: "exec",
    scopes: ["recruiting", "members", "events", "announcements"],
    askAbout: "Recruiting and how the exec team runs."
  },
  {
    email: "ylindsey@umich.edu",
    name: "Lindsey Ye",
    title: "VP Operations",
    role: "exec",
    scopes: ["members", "events", "resources"],
    askAbout: "Meeting logistics, Drive access, and club paperwork."
  },
  {
    email: "alexfors@umich.edu",
    name: "Alex Forstner",
    title: "VP Education",
    role: "exec",
    scopes: ["members", "events", "resources"],
    askAbout: "Workshops, curriculum, and member development."
  },
  {
    email: "landonem@umich.edu",
    name: "Landon Miller",
    title: "VP Finance",
    role: "exec",
    scopes: ["members", "events"],
    askAbout: "Budget, reimbursements, and anything with a cost attached."
  },
  {
    email: "andsack@umich.edu",
    name: "Andrew Sackett",
    title: "Events & Programming",
    role: "exec",
    scopes: ["events", "announcements"],
    askAbout: "Event logistics, rooms, and the day-of run of show."
  },
  {
    email: "snaber@umich.edu",
    name: "Samantha Naber",
    title: "Exec Admin",
    role: "exec",
    scopes: ["recruiting", "events", "announcements"],
    askAbout: "Recruiting logistics and interview scheduling."
  },
  {
    email: "sdeyoun@umich.edu",
    name: "Solomon Deyoung",
    title: "Exec Admin",
    role: "exec",
    scopes: ["events", "announcements"],
    askAbout: "Event support and getting announcements out."
  }
];
var adminAccountForEmail = (email) => ADMIN_ACCOUNTS.find((account) => account.email === email.toLowerCase());
var roleForEmail = (email) => adminAccountForEmail(email)?.role || "member";
var scopesForEmail = (email) => adminAccountForEmail(email)?.scopes || [];
var effectiveRoleForAccount = (input) => {
  if (input.role && input.role !== "member") return input.role;
  if (input.verifiedVia === "google") return roleForEmail(input.email);
  return "member";
};

// src/lib/interviews.ts
var INTERVIEW_WINDOW_DAYS = [
  {
    date: "2026-05-07",
    shortLabel: "Thu, May 7",
    label: "Thursday, May 7"
  },
  {
    date: "2026-05-08",
    shortLabel: "Fri, May 8",
    label: "Friday, May 8"
  },
  {
    date: "2026-05-09",
    shortLabel: "Sat, May 9",
    label: "Saturday, May 9"
  }
];
var INTERVIEW_START_HOUR_ET = 8;
var INTERVIEW_END_HOUR_ET = 22;
var INTERVIEW_BLOCK_MINUTES = 30;
var INTERVIEW_BUFFER_MINUTES = 20;
var INTERVIEW_SLOT_INTERVAL_MINUTES = INTERVIEW_BLOCK_MINUTES + INTERVIEW_BUFFER_MINUTES;
var formatHour = (hour24) => {
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return `${hour12}:${"00"} ${suffix}`;
};
var formatTime = (hour24, minute) => {
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
};
var isoWithEasternOffset = (date, totalMinutes) => {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`;
};
var INTERVIEW_SLOTS = INTERVIEW_WINDOW_DAYS.flatMap((day) => {
  const startMinutes = INTERVIEW_START_HOUR_ET * 60;
  const endMinutes = INTERVIEW_END_HOUR_ET * 60;
  const slots = [];
  for (let minute = startMinutes; minute + INTERVIEW_BLOCK_MINUTES <= endMinutes; minute += INTERVIEW_SLOT_INTERVAL_MINUTES) {
    const end = minute + INTERVIEW_BLOCK_MINUTES;
    const bufferEnd = end + INTERVIEW_BUFFER_MINUTES;
    const startHour = Math.floor(minute / 60);
    const startMinute = minute % 60;
    const endHour = Math.floor(end / 60);
    const endMinute = end % 60;
    const bufferEndHour = Math.floor(bufferEnd / 60);
    const bufferEndMinute = bufferEnd % 60;
    const timeLabel = `${formatTime(startHour, startMinute)}-${formatTime(endHour, endMinute)} ET`;
    const bufferLabel = `buffer until ${formatTime(bufferEndHour, bufferEndMinute)} ET`;
    const start = isoWithEasternOffset(day.date, minute);
    const endValue = isoWithEasternOffset(day.date, end);
    const bufferEndValue = isoWithEasternOffset(day.date, bufferEnd);
    slots.push({
      value: `${start}/${endValue}`,
      label: `${day.shortLabel}, ${timeLabel}`,
      dayLabel: day.label,
      timeLabel,
      bufferLabel,
      start,
      end: endValue,
      bufferEnd: bufferEndValue,
      startMinutes: minute
    });
  }
  return slots;
});
var INTERVIEW_DAY_PARTS = [
  {
    key: "morning",
    label: "Morning",
    rangeLabel: "8 AM-noon",
    startMinutes: 8 * 60,
    endMinutes: 12 * 60
  },
  {
    key: "afternoon",
    label: "Afternoon",
    rangeLabel: "noon-5 PM",
    startMinutes: 12 * 60,
    endMinutes: 17 * 60
  },
  {
    key: "evening",
    label: "Evening",
    rangeLabel: "5-10 PM",
    startMinutes: 17 * 60,
    endMinutes: 22 * 60
  }
];
var INTERVIEW_SLOT_GROUPS = INTERVIEW_WINDOW_DAYS.map((day) => ({
  ...day,
  slots: INTERVIEW_SLOTS.filter((slot) => slot.dayLabel === day.label),
  parts: INTERVIEW_DAY_PARTS.map((part) => ({
    ...part,
    slots: INTERVIEW_SLOTS.filter((slot) => slot.dayLabel === day.label && slot.startMinutes >= part.startMinutes && slot.startMinutes < part.endMinutes)
  }))
}));
var INTERVIEW_WINDOW_LABEL = "Thursday, May 7 through Saturday, May 9";
var INTERVIEW_DAY_RANGE_LABEL = `${INTERVIEW_WINDOW_LABEL}, ${formatHour(INTERVIEW_START_HOUR_ET)}-${formatHour(INTERVIEW_END_HOUR_ET)} ET`;
var INTERVIEW_BLOCK_WITH_BUFFER_LABEL = `${INTERVIEW_BLOCK_MINUTES}-minute interview + ${INTERVIEW_BUFFER_MINUTES}-minute buffer`;
var FUNCTION_PREFERENCE_OPTIONS = [
  "Events and Programming",
  "Marketing and Social Media",
  "Outreach and Partnerships"
];
var BOARD_POSITION_OPTIONS = FUNCTION_PREFERENCE_OPTIONS;
var slotByValue = new Map(INTERVIEW_SLOTS.map((slot) => [slot.value, slot]));
var boardPositionValues = new Set(BOARD_POSITION_OPTIONS);
var getInterviewSlotByValue = (value) => slotByValue.get(value);

// src/lib/portalAccess.ts
var ACCESS_NEED_CATALOG = [
  // physical-space
  { id: "step-free-entry", category: "physical-space", label: "Step-free entry" },
  { id: "step-free-route-inside", category: "physical-space", label: "Step-free route inside the building" },
  { id: "wheelchair-space-at-table", category: "physical-space", label: "Wheelchair space at the table" },
  { id: "seat-near-exit", category: "physical-space", label: "Seat reserved near an exit" },
  { id: "seat-near-front", category: "physical-space", label: "Seat reserved near the front" },
  { id: "accessible-restroom", category: "physical-space", label: "Accessible restroom on the same floor" },
  { id: "service-animal", category: "physical-space", label: "Service animal attending" },
  // communication
  { id: "asl-interpreter", category: "communication", label: "ASL interpreter" },
  { id: "live-captioning", category: "communication", label: "Live captioning" },
  { id: "captions-on-video", category: "communication", label: "Captions on all video" },
  { id: "mic-always-used", category: "communication", label: "Microphone always used" },
  { id: "speaker-faces-audience", category: "communication", label: "Speaker faces the audience" },
  { id: "agenda-in-advance", category: "communication", label: "Written agenda in advance" },
  { id: "no-cold-calling", category: "communication", label: "No cold-calling" },
  // sensory
  { id: "quiet-space", category: "sensory", label: "Quiet space available" },
  { id: "no-strobe-or-flashing", category: "sensory", label: "No strobe or flashing content" },
  { id: "lighting-adjustable", category: "sensory", label: "Adjustable lighting" },
  { id: "scent-free", category: "sensory", label: "Scent-free request" },
  { id: "volume-limits", category: "sensory", label: "Volume kept low" },
  // materials
  { id: "slides-in-advance", category: "materials", label: "Slides shared in advance" },
  { id: "screen-reader-files", category: "materials", label: "Screen-reader compatible files" },
  { id: "large-print", category: "materials", label: "Large print" },
  { id: "plain-language-summary", category: "materials", label: "Plain-language summary" },
  // food
  { id: "ingredients-labeled", category: "food", label: "Ingredients labeled" },
  { id: "allergy-nut", category: "food", label: "Nut allergy" },
  { id: "allergy-gluten", category: "food", label: "Gluten" },
  { id: "allergy-dairy", category: "food", label: "Dairy" },
  { id: "allergy-shellfish", category: "food", label: "Shellfish" },
  { id: "allergy-other", category: "food", label: "Other allergy (describe below)" },
  { id: "texture-or-swallow", category: "food", label: "Texture or swallowing needs" },
  { id: "halal", category: "food", label: "Halal" },
  { id: "kosher", category: "food", label: "Kosher" },
  { id: "vegan", category: "food", label: "Vegan" },
  { id: "seated-not-buffet", category: "food", label: "Seated service rather than buffet" },
  // timing
  { id: "breaks-every-30", category: "timing", label: "Breaks every 30 minutes" },
  { id: "under-60-min", category: "timing", label: "Prefer events under 60 minutes" },
  { id: "late-or-early-exit", category: "timing", label: "Late arrival or early exit without explaining" },
  { id: "recording-if-absent", category: "timing", label: "Recording if I cannot attend" }
];
var ACCESS_NEEDS_LIMIT = 50;
var ACCESS_FOLLOW_UP_PREFERENCES = ["email", "before-event", "do-not-contact"];
var accessNeedIds = new Set(ACCESS_NEED_CATALOG.map((need) => need.id));
var emptyAccessProfile = () => ({
  needs: [],
  generalNote: "",
  followUpPreference: "email",
  scope: "private",
  appliesTo: "rsvp-only",
  consentAt: "",
  consentText: "",
  expiresAt: "",
  withdrawnAt: "",
  hasOpened: false,
  updatedAt: ""
});
var accessConsentExpiresAt = (now) => {
  const parsed = new Date(now);
  const stamp = Number.isNaN(parsed.getTime()) ? /* @__PURE__ */ new Date() : parsed;
  const year = stamp.getUTCFullYear();
  return stamp.getUTCMonth() <= 3 ? new Date(Date.UTC(year, 3, 30, 23, 59, 59)).toISOString() : new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();
};
var normalizeAccessProfile = (value) => {
  const base = emptyAccessProfile();
  if (!value || typeof value !== "object") return base;
  const row = value;
  const rawNeeds = Array.isArray(row.needs) ? row.needs : [];
  const needs = rawNeeds.filter((entry) => Boolean(entry) && typeof entry === "object").map((entry) => ({
    id: typeof entry.id === "string" ? entry.id : "",
    priority: entry.priority === "helpful" ? "helpful" : "required",
    detail: typeof entry.detail === "string" ? entry.detail : ""
  })).filter((need) => accessNeedIds.has(need.id)).slice(0, ACCESS_NEEDS_LIMIT);
  return {
    needs,
    generalNote: typeof row.generalNote === "string" ? row.generalNote : base.generalNote,
    followUpPreference: ACCESS_FOLLOW_UP_PREFERENCES.some((option) => option === row.followUpPreference) ? row.followUpPreference : base.followUpPreference,
    scope: row.scope === "shared-with-leads" ? "shared-with-leads" : "private",
    appliesTo: row.appliesTo === "all-events" ? "all-events" : "rsvp-only",
    consentAt: typeof row.consentAt === "string" ? row.consentAt : base.consentAt,
    consentText: typeof row.consentText === "string" ? row.consentText : base.consentText,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : base.expiresAt,
    withdrawnAt: typeof row.withdrawnAt === "string" ? row.withdrawnAt : base.withdrawnAt,
    hasOpened: row.hasOpened === true,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : base.updatedAt
  };
};
var buildAccessProfile = (input, previous, now) => ({
  needs: input.needs.map((need) => ({ ...need })),
  generalNote: input.generalNote,
  followUpPreference: input.followUpPreference,
  scope: input.scope,
  appliesTo: input.appliesTo,
  consentAt: now,
  consentText: input.consentText || previous.consentText,
  expiresAt: accessConsentExpiresAt(now),
  withdrawnAt: "",
  hasOpened: true,
  updatedAt: now
});
var withdrawAccessProfile = (previous, now) => ({
  ...previous,
  scope: "private",
  withdrawnAt: now,
  hasOpened: true,
  updatedAt: now
});

// src/lib/portalAudit.ts
var AUDIT_LOG_LIMIT = 300;
var AUDIT_SUMMARY_LIMIT = 240;
var createId = (prefix) => {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${suffix}`;
};
var buildAuditEntry = (input) => ({
  actorEmail: input.actorEmail.trim().toLowerCase(),
  actorRole: input.actorRole,
  action: input.action,
  targetType: input.targetType,
  targetId: input.targetId,
  summary: input.summary.replace(/\s+/g, " ").trim().slice(0, AUDIT_SUMMARY_LIMIT),
  id: createId("audit"),
  at: (/* @__PURE__ */ new Date()).toISOString()
});
var appendAudit = (log, entry) => {
  const current = Array.isArray(log) ? log : [];
  const next = [...current, entry];
  return next.length > AUDIT_LOG_LIMIT ? next.slice(next.length - AUDIT_LOG_LIMIT) : next;
};
var readAuditEntries = (log, limit = 100) => {
  const current = Array.isArray(log) ? log : [];
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), AUDIT_LOG_LIMIT) : 100;
  return [...current].reverse().slice(0, safeLimit);
};

// src/lib/portalMembers.ts
var MEMBER_STATUSES = ["prospect", "active", "inactive", "alumni"];
var MEMBER_SOURCES = ["self-signup", "festifall", "interest-form", "referral", "recruiting", "manual"];
var MEMBER_YEARS = ["", "Freshman", "Sophomore", "Junior", "Senior", "Grad"];
var MEMBER_SCHOOLS = ["", "Ross", "LSA", "CoE", "SI", "Kinesiology", "Nursing", "Other"];
var MEMBER_INTERESTS = ["consulting", "speakers", "finance", "mentorship", "operations", "marketing"];
var BULK_ADMIT_LIMIT = 100;
var buildMemberProfileRecord = (email, seed, actorEmail) => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const key = email.trim().toLowerCase();
  return {
    email: key,
    firstName: seed.firstName || "",
    lastName: seed.lastName || "",
    preferredName: seed.preferredName || "",
    pronouns: seed.pronouns || "",
    uniqname: seed.uniqname || key.replace(/@.*$/, ""),
    status: seed.status || "prospect",
    source: seed.source || "manual",
    year: seed.year || "",
    school: seed.school || "",
    major: seed.major || "",
    gradYear: seed.gradYear || "",
    interests: seed.interests ? [...seed.interests] : [],
    linkedinUrl: seed.linkedinUrl || "",
    phone: seed.phone || "",
    dietary: seed.dietary || "",
    notes: seed.notes || "",
    joinedAt: seed.joinedAt || now,
    createdAt: seed.createdAt || now,
    updatedAt: now,
    updatedBy: actorEmail.trim().toLowerCase(),
    access: seed.access ? normalizeAccessProfile(seed.access) : emptyAccessProfile()
  };
};
var applyMemberProfilePatch = (base, patch, actorEmail, now) => ({
  email: base.email,
  firstName: patch.firstName ?? base.firstName,
  lastName: patch.lastName ?? base.lastName,
  preferredName: patch.preferredName ?? base.preferredName,
  pronouns: patch.pronouns ?? base.pronouns,
  uniqname: patch.uniqname ?? base.uniqname,
  status: patch.status ?? base.status,
  source: patch.source ?? base.source,
  year: patch.year ?? base.year,
  school: patch.school ?? base.school,
  major: patch.major ?? base.major,
  gradYear: patch.gradYear ?? base.gradYear,
  interests: patch.interests ? [...patch.interests] : base.interests,
  linkedinUrl: patch.linkedinUrl ?? base.linkedinUrl,
  phone: patch.phone ?? base.phone,
  dietary: patch.dietary ?? base.dietary,
  notes: patch.notes ?? base.notes,
  joinedAt: patch.joinedAt ?? base.joinedAt,
  createdAt: base.createdAt,
  updatedAt: now,
  updatedBy: actorEmail.trim().toLowerCase(),
  access: base.access
});
var normalizeMemberProfileRecord = (value, fallbackEmail = "") => {
  const row = value && typeof value === "object" ? value : {};
  const email = (typeof row.email === "string" && row.email ? row.email : fallbackEmail).trim().toLowerCase();
  const record = buildMemberProfileRecord(email, row, row.updatedBy || "");
  return {
    ...record,
    status: MEMBER_STATUSES.some((option) => option === row.status) ? row.status : record.status,
    source: MEMBER_SOURCES.some((option) => option === row.source) ? row.source : record.source,
    year: MEMBER_YEARS.some((option) => option === row.year) ? row.year : "",
    school: MEMBER_SCHOOLS.some((option) => option === row.school) ? row.school : "",
    interests: Array.isArray(row.interests) ? row.interests.filter((interest) => MEMBER_INTERESTS.some((option) => option === interest)) : [],
    createdAt: row.createdAt || record.createdAt,
    updatedAt: row.updatedAt || record.updatedAt,
    access: normalizeAccessProfile(row.access)
  };
};
var memberDisplayName = (record) => {
  const first = record.preferredName || record.firstName;
  const full = `${first} ${record.lastName}`.trim();
  return full || record.email;
};

// src/lib/portalEvents.ts
var ACCESS_COMMITMENT_CATALOG = [
  "step-free-route",
  "accessible-restroom-same-floor",
  "live-captions",
  "asl-interpreter",
  "mic-always-used",
  "slides-shared-in-advance",
  "quiet-space-available",
  "food-labeled-allergens",
  "seating-reserved-front",
  "no-flashing-content",
  "recording-available-after"
];
var commitmentIds = new Set(ACCESS_COMMITMENT_CATALOG);
var createId2 = (prefix) => {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${suffix}`;
};
var rsvpKey = (eventId, email) => `${eventId}:${email.trim().toLowerCase()}`;
var buildClubEvent = (data, actorEmail) => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: data.id || createId2("event"),
    title: data.title,
    summary: data.summary,
    kind: data.kind,
    format: data.format,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    locationName: data.locationName,
    locationDetail: data.locationDetail,
    virtualUrl: data.virtualUrl,
    hostName: data.hostName,
    speakerName: data.speakerName,
    speakerOrg: data.speakerOrg,
    capacity: data.capacity,
    rsvpDeadline: data.rsvpDeadline,
    status: "draft",
    accessCommitments: data.accessCommitments.map((commitment) => ({ ...commitment })),
    accommodationsContactEmail: data.accommodationsContactEmail,
    recordingUrl: data.recordingUrl,
    slidesUrl: data.slidesUrl,
    roomStatus: data.roomStatus,
    internalNotes: data.internalNotes,
    createdAt: now,
    updatedAt: now,
    createdBy: actorEmail.trim().toLowerCase(),
    publishedAt: "",
    publishedBy: ""
  };
};
var mergeClubEvent = (existing, data, now) => ({
  ...buildClubEvent({ ...data, id: existing.id }, existing.createdBy),
  status: existing.status,
  createdAt: existing.createdAt,
  createdBy: existing.createdBy,
  publishedAt: existing.publishedAt,
  publishedBy: existing.publishedBy,
  updatedAt: now
});
var buildEventRsvp = (email, data, previous, now) => {
  const key = email.trim().toLowerCase();
  return {
    id: rsvpKey(data.eventId, key),
    eventId: data.eventId,
    email: key,
    response: data.response,
    guestCount: data.guestCount,
    accommodationNote: data.accommodationNote ?? previous?.accommodationNote ?? "",
    shareAccommodationWithLeads: data.shareAccommodationWithLeads ?? previous?.shareAccommodationWithLeads ?? false,
    respondedAt: now,
    checkedInAt: previous?.checkedInAt || "",
    checkedInBy: previous?.checkedInBy || ""
  };
};
var canPublishEvent = (event) => {
  const blockers = [];
  if (!Array.isArray(event.accessCommitments) || event.accessCommitments.length === 0) {
    blockers.push("State what this event can and cannot provide access-wise before publishing it.");
  }
  if (!event.accommodationsContactEmail) {
    blockers.push("Add an accommodations contact email before publishing.");
  }
  if (!event.hostName) {
    blockers.push("Name the person running this event before publishing.");
  }
  if (!event.startsAt || !event.endsAt || Date.parse(event.endsAt) <= Date.parse(event.startsAt)) {
    blockers.push("The end time has to come after the start time.");
  }
  return { ok: blockers.length === 0, blockers };
};
var isRsvpOpen = (event, now) => {
  const blockers = [];
  const nowMs = Number.isNaN(Date.parse(now)) ? Date.now() : Date.parse(now);
  if (event.status === "cancelled") {
    blockers.push("That event was cancelled.");
  } else if (event.status !== "published") {
    blockers.push("That event is not published yet.");
  }
  if (event.rsvpDeadline && !Number.isNaN(Date.parse(event.rsvpDeadline)) && Date.parse(event.rsvpDeadline) < nowMs) {
    blockers.push("The RSVP deadline for that event has passed.");
  }
  return { ok: blockers.length === 0, blockers };
};

// src/lib/portalAnnouncements.ts
var createId3 = (prefix) => {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${suffix}`;
};
var buildAnnouncement = (data, actorEmail) => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: data.id || createId3("announcement"),
    title: data.title,
    body: data.body,
    audience: data.audience,
    status: "draft",
    pinned: data.pinned,
    ctaLabel: data.ctaLabel,
    ctaHref: data.ctaHref,
    authorEmail: actorEmail.trim().toLowerCase(),
    approvedBy: "",
    publishedAt: "",
    expiresAt: data.expiresAt,
    createdAt: now,
    updatedAt: now
  };
};
var mergeAnnouncement = (existing, data, now) => ({
  ...buildAnnouncement({ ...data, id: existing.id }, existing.authorEmail),
  status: existing.status,
  approvedBy: existing.approvedBy,
  publishedAt: existing.publishedAt,
  createdAt: existing.createdAt,
  updatedAt: now
});

// src/lib/portalResources.ts
var createId4 = (prefix) => {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${suffix}`;
};
var buildPortalResource = (data, actorEmail, order) => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: data.id || createId4("resource"),
    title: data.title,
    description: data.description,
    href: data.href,
    category: data.category,
    formatNote: data.formatNote,
    audience: data.audience,
    order,
    published: data.published,
    addedBy: actorEmail.trim().toLowerCase(),
    createdAt: now,
    updatedAt: now
  };
};
var mergePortalResource = (existing, data, now) => ({
  ...buildPortalResource({ ...data, id: existing.id }, existing.addedBy, existing.order),
  createdAt: existing.createdAt,
  updatedAt: now
});
var sortPortalResources = (resources) => [...resources].sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));

// server/bookingEmail.ts
var DEFAULT_EMAIL_FROM = "UBLDA Interviews <interviews@ublda.org>";
var DEFAULT_REPLY_TO = "sbodine@umich.edu";
var envValue = (key) => process.env[key]?.trim() || "";
var isProduction = () => process.env.VERCEL_ENV === "production";
var bookingEmailRequired = () => process.env.UBLDA_REQUIRE_BOOKING_EMAIL === "true" || isProduction();
var domainVerified = () => process.env.UBLDA_EMAIL_DOMAIN_VERIFIED === "true";
var emailFrom = () => envValue("UBLDA_EMAIL_FROM") || DEFAULT_EMAIL_FROM;
var emailReplyTo = () => envValue("UBLDA_EMAIL_REPLY_TO") || DEFAULT_REPLY_TO;
var bookingEmailLaunchStatus = () => {
  const missing = [];
  const apiKey = envValue("RESEND_API_KEY");
  const from = emailFrom();
  const replyTo = emailReplyTo();
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!from) missing.push("UBLDA_EMAIL_FROM");
  if (!domainVerified()) missing.push("UBLDA_EMAIL_DOMAIN_VERIFIED=true");
  return {
    required: bookingEmailRequired(),
    canAttemptSend: Boolean(apiKey && from),
    readyForLaunch: missing.length === 0,
    missing,
    from,
    replyTo
  };
};

// server/launchReadiness.ts
var hasAnyAdminSecret = () => Boolean(
  process.env.UBLDA_SUPER_ADMIN_PASSWORD || process.env.SAM_BODINE_PASSWORD
);
var overallStatus = (checks) => {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
};
var buildLaunchReadiness = () => {
  const email = bookingEmailLaunchStatus();
  const checks = [
    {
      id: "recruiting-store",
      label: "Recruiting store",
      status: process.env.BLOB_READ_WRITE_TOKEN ? "pass" : "warn",
      detail: process.env.BLOB_READ_WRITE_TOKEN ? "Private Vercel Blob storage is configured for recruiting data and resumes." : "Using local preview storage. Add BLOB_READ_WRITE_TOKEN before production launch."
    },
    {
      id: "booking-email",
      label: "Confirmation email",
      status: email.readyForLaunch ? "pass" : email.required ? "fail" : "warn",
      detail: email.readyForLaunch ? `Resend sender is ready: ${email.from}.` : email.required ? `Required email config is missing: ${email.missing.join(", ") || "email provider"}.` : "Automated confirmation email is optional; manual follow-up is expected."
    },
    {
      id: "resume-storage",
      label: "Resume uploads",
      status: process.env.BLOB_READ_WRITE_TOKEN ? "pass" : "warn",
      detail: process.env.BLOB_READ_WRITE_TOKEN ? "Uploaded resumes are stored privately in Vercel Blob and served only to recruiting admins." : "Resume uploads work locally, but production should use private Vercel Blob."
    },
    {
      id: "admin-secret",
      label: "Admin session secret",
      status: hasAnyAdminSecret() ? "pass" : "warn",
      detail: hasAnyAdminSecret() ? "Super-admin fallback sessions are signed with a configured secret." : "No super-admin fallback secret is configured. Password accounts can still work, but recovery is harder."
    }
  ];
  return {
    overall: overallStatus(checks),
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    checks
  };
};

// server/localRecruitingStore.ts
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
var BCRYPT_COST = 12;
var PASSWORD_HASH_ALGORITHM = "bcrypt";
var BLOB_STATE_PATH = "recruiting/state.json";
var BLOB_SLOT_LOCK_PREFIX = "recruiting/slot-locks";
var BLOB_RESUME_PREFIX = "recruiting/resumes";
var LOCAL_PREVIEW_SESSION_TOKEN = "local-preview-session-token";
var mutationQueues = /* @__PURE__ */ new Map();
var BLOB_WRITE_MAX_ATTEMPTS = 5;
var BLOB_READ_MAX_ATTEMPTS = 3;
var BLOB_READ_RETRY_DELAY_MS = 250;
var BOOKING_LOCK_TTL_MS = 1e3 * 60 * 10;
var defaultBlobClient = { get, put, del };
var recruitingBlobClient = defaultBlobClient;
var setRecruitingBlobClientForTests = (client) => {
  recruitingBlobClient = client || defaultBlobClient;
};
var emptyData = () => ({
  version: 1,
  accounts: {},
  sessions: {},
  candidates: {},
  interviewerAvailability: {},
  calendarEvents: {},
  rateLimits: {},
  resumes: {},
  memberProfiles: {},
  clubEvents: {},
  eventRsvps: {},
  announcements: {},
  portalResources: {},
  auditLog: []
});
var shouldSeedLowDemandTestSignups = () => process.env.UBLDA_ENABLE_TEST_SIGNUPS === "true";
var seededIntervieweeBookings = [
  {
    id: "seeded-shado-placeholder",
    email: "shado-preserved-slot@example.com",
    firstName: "Shado",
    lastName: "Placeholder",
    program: "Preserved occupied interview slot",
    slotStart: "2026-05-07T08:50:00-04:00",
    rolePreferences: ["Outreach and Partnerships"],
    feedback: "Seeded Shado placeholder booking."
  },
  {
    id: "low-demand-test-1",
    email: "low-demand-test-1@example.com",
    firstName: "Avery",
    lastName: "Lowell",
    program: "Low-demand test signup",
    slotStart: "2026-05-07T09:40:00-04:00",
    rolePreferences: ["Events and Programming", "Marketing and Social Media"],
    feedback: "Seeded low-demand test booking.",
    resumeFileName: "booking_low_demand_seed_1_1778097247067-low-demand-test-resume.pdf"
  },
  {
    id: "low-demand-test-2",
    email: "low-demand-test-2@example.com",
    firstName: "Morgan",
    lastName: "Vale",
    program: "Low-demand test signup",
    slotStart: "2026-05-07T21:20:00-04:00",
    rolePreferences: ["Marketing and Social Media", "Outreach and Partnerships"],
    feedback: "Seeded low-demand test booking.",
    resumeFileName: "booking_low_demand_seed_2_1778097247068-low-demand-test-resume.pdf"
  },
  {
    id: "low-demand-test-3",
    email: "low-demand-test-3@example.com",
    firstName: "Riley",
    lastName: "Stone",
    program: "Low-demand test signup",
    slotStart: "2026-05-08T08:00:00-04:00",
    rolePreferences: ["Outreach and Partnerships", "Events and Programming"],
    feedback: "Seeded low-demand test booking.",
    resumeFileName: "booking_low_demand_seed_3_1778097247069-low-demand-test-resume.pdf"
  },
  {
    id: "low-demand-test-4",
    email: "low-demand-test-4@example.com",
    firstName: "Casey",
    lastName: "Reed",
    program: "Low-demand test signup",
    slotStart: "2026-05-08T20:30:00-04:00",
    rolePreferences: ["Events and Programming", "Outreach and Partnerships"],
    feedback: "Seeded low-demand test booking.",
    resumeFileName: "booking_low_demand_seed_4_1778097247070-low-demand-test-resume.pdf"
  },
  {
    id: "low-demand-test-5",
    email: "low-demand-test-5@example.com",
    firstName: "Jamie",
    lastName: "Park",
    program: "Low-demand test signup",
    slotStart: "2026-05-09T08:00:00-04:00",
    rolePreferences: ["Marketing and Social Media"],
    feedback: "Seeded low-demand test booking.",
    resumeFileName: "booking_low_demand_seed_5_1778097247071-low-demand-test-resume.pdf"
  },
  {
    id: "low-demand-test-6",
    email: "low-demand-test-6@example.com",
    firstName: "Taylor",
    lastName: "Brooks",
    program: "Low-demand test signup",
    slotStart: "2026-05-09T21:20:00-04:00",
    rolePreferences: ["Outreach and Partnerships"],
    feedback: "Seeded low-demand test booking.",
    resumeFileName: "booking_low_demand_seed_6_1778097247071-low-demand-test-resume.pdf"
  }
];
var seededIntervieweeEmails = new Set(seededIntervieweeBookings.map((booking) => booking.email));
var interviewersForSlot = (data, slotValue) => Object.values(data.interviewerAvailability).filter((interviewer) => Array.isArray(interviewer.availability) && interviewer.availability.includes(slotValue)).map((interviewer) => interviewer.name).sort((left, right) => left.localeCompare(right));
var seedLowDemandTestSignups = (data, force = false) => {
  if (!force && !shouldSeedLowDemandTestSignups()) return;
  seededIntervieweeBookings.forEach((booking) => {
    const slot = INTERVIEW_SLOTS.find((candidateSlot) => candidateSlot.start === booking.slotStart);
    if (!slot) return;
    const resume = localSeededResume(booking, force);
    if (resume && !data.resumes[booking.email]) {
      data.resumes[booking.email] = resume;
    }
    const slotAlreadyBooked = Object.values(data.candidates).some((candidate) => candidate.email !== booking.email && candidate.assignedSlot === slot.value);
    if (slotAlreadyBooked || data.candidates[booking.email]) {
      return;
    }
    data.candidates[booking.email] = {
      id: booking.id,
      name: `${booking.firstName} ${booking.lastName}`,
      program: booking.program,
      email: booking.email,
      rolePreferences: booking.rolePreferences,
      status: "Invited",
      availability: [slot.value],
      resumeUrl: resume || data.resumes[booking.email] ? resumeUrlForEmail(booking.email) : "",
      assignedSlot: slot.value,
      interviewers: interviewersForSlot(data, slot.value).slice(0, 2),
      feedback: booking.feedback
    };
  });
};
var isSeededVolatileCandidate = (candidate) => Boolean(candidate && seededIntervieweeEmails.has(candidate.email) && (candidate.id === "seeded-shado-placeholder" || candidate.id.startsWith("low-demand-test-") || candidate.feedback === "Seeded low-demand test booking." || candidate.feedback === "Seeded Shado placeholder booking."));
var persistableRecruitingData = (data) => {
  const cloned = JSON.parse(JSON.stringify(data));
  seededIntervieweeEmails.forEach((email) => {
    if (isSeededVolatileCandidate(cloned.candidates[email])) {
      delete cloned.candidates[email];
    }
    delete cloned.resumes?.[email];
  });
  return cloned;
};
var isStaleBookingLock = (raw) => {
  try {
    const lock = JSON.parse(raw);
    const createdAt = typeof lock.createdAt === "string" ? Date.parse(lock.createdAt) : Number.NaN;
    return Number.isFinite(createdAt) && Date.now() - createdAt > BOOKING_LOCK_TTL_MS;
  } catch {
    return false;
  }
};
var defaultDataPath = () => process.env.UBLDA_LOCAL_DATA_FILE || path.join(process.cwd(), ".ublda-local-data", "recruiting.json");
var shouldUseBlobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
var sessionExpiresAt = () => new Date(Date.now() + SESSION_TTL_MS).toISOString();
var legacyHashPassword = (password, salt = randomBytes(16).toString("base64url")) => ({
  salt,
  hash: pbkdf2Sync(password, salt, 12e4, 32, "sha256").toString("base64url")
});
var hashPassword = (password) => ({
  salt: PASSWORD_HASH_ALGORITHM,
  hash: bcrypt.hashSync(password, BCRYPT_COST)
});
var constantTimeEquals = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
var verifyPassword = (password, salt, expectedHash) => {
  if (!salt || !expectedHash) return false;
  if (salt === PASSWORD_HASH_ALGORITHM || expectedHash.startsWith("$2")) {
    return bcrypt.compareSync(password, expectedHash);
  }
  return constantTimeEquals(legacyHashPassword(password, salt).hash, expectedHash);
};
var createSessionToken = () => `local_${Date.now()}_${randomBytes(18).toString("base64url")}`;
var decorateAccount = (account) => {
  const role = effectiveRoleForAccount(account);
  const fallbackAdmin = role === "member" ? void 0 : adminAccountForEmail(account.email);
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    email: account.email,
    role,
    adminTitle: account.adminTitle || fallbackAdmin?.title || "Member",
    // `undefined` means nobody has ever set scopes for this account, so seed from the
    // roster. An explicit `[]` is a deliberate revocation and must survive decoration —
    // treating it as "unset" would silently restore what a super-admin just took away.
    adminScopes: Array.isArray(account.adminScopes) ? account.adminScopes : role === "member" ? [] : scopesForEmail(account.email),
    verifiedVia: account.verifiedVia || ""
  };
};
var portalAccountSummary = (account) => {
  const role = effectiveRoleForAccount(account);
  return {
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    role,
    adminTitle: account.adminTitle || (role === "member" ? "Member" : adminAccountForEmail(account.email)?.title || "Exec Admin"),
    // `undefined` means nobody has ever set scopes for this account, so seed from the
    // roster. An explicit `[]` is a deliberate revocation and must survive decoration —
    // treating it as "unset" would silently restore what a super-admin just took away.
    adminScopes: Array.isArray(account.adminScopes) ? account.adminScopes : role === "member" ? [] : scopesForEmail(account.email),
    verifiedVia: account.verifiedVia || "",
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
};
var memberSeedFromAccount = (account) => account ? { firstName: account.firstName, lastName: account.lastName, uniqname: account.uniqname } : {};
var memberSignupsFromAccounts = (accounts) => Object.values(accounts).map((account) => ({
  id: account.email,
  name: `${account.firstName} ${account.lastName}`.trim() || account.email,
  email: account.email,
  uniqname: account.uniqname,
  status: account.application?.status || "Local preview account",
  source: "Local preview accounts",
  updatedAt: account.updatedAt,
  detail: account.application ? `Submissions: ${account.application.submissionCount}` : ""
}));
var statusForDashboard = (status) => {
  if (status === "Future role pool") return "Hold";
  if (status === "Interview eligible" || status === "Needs review") return "Needs match";
  return "Needs match";
};
var dashboardStatus = () => ({
  source: shouldUseBlobStorage() ? "vercel" : "preview",
  message: shouldUseBlobStorage() ? "Loaded recruiting data from the private Vercel Blob backend." : "Loaded from durable local preview storage. Data lives in .ublda-local-data and survives dev-server restarts.",
  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
});
var candidateIdFromEmail = (email) => email.replace(/@.*$/, "").replace(/[^a-z0-9._-]+/g, "-").slice(0, 48) || email;
var localSeededResume = (booking, force) => {
  if (!force || !booking.resumeFileName) return null;
  const storageKey = `${BLOB_RESUME_PREFIX}/${candidateIdFromEmail(booking.email)}/${booking.resumeFileName}`;
  const resumePath = path.join(process.cwd(), ".ublda-local-data", storageKey);
  if (!existsSync(resumePath)) return null;
  return {
    email: booking.email,
    fileName: booking.resumeFileName,
    mimeType: "application/pdf",
    size: statSync(resumePath).size,
    storageKey,
    storageKind: "local",
    uploadedAt: (/* @__PURE__ */ new Date("2026-05-06T19:54:07.000-04:00")).toISOString()
  };
};
var bookingError = (code, message) => Object.assign(new Error(message), { code });
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var resumeUrlForEmail = (email) => `/api/resume?candidate=${encodeURIComponent(email)}`;
var safeResumeFileName = (fileName) => {
  const fallback = "resume.pdf";
  const baseName = path.basename(fileName || fallback).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (baseName || fallback).slice(0, 120);
};
var resumeStorageKey = (email, submissionId, fileName) => `${BLOB_RESUME_PREFIX}/${candidateIdFromEmail(email)}/${submissionId}-${safeResumeFileName(fileName)}`;
var isBlobWriteConflict = (error) => error instanceof BlobPreconditionFailedError || error instanceof Error && /precondition|already exists|overwrite/i.test(error.message);
var writableBlobEtag = (etag) => etag?.replace(/^W\//, "") || null;
var slotLockId = (slotValue) => createHash("sha256").update(slotValue).digest("base64url");
var bookingSlotRows = (data) => INTERVIEW_SLOTS.map((slot) => {
  const interviewers = interviewersForSlot(data, slot.value);
  const bookedCandidate = Object.values(data.candidates).find((candidate) => candidate.assignedSlot === slot.value);
  return {
    value: slot.value,
    label: slot.label,
    dayLabel: slot.dayLabel,
    shortDayLabel: slot.dayLabel.replace(/^.*?, /, ""),
    timeLabel: slot.timeLabel,
    start: slot.start,
    end: slot.end,
    startMinutes: slot.startMinutes,
    interviewerCount: interviewers.length,
    interviewers,
    isBooked: Boolean(bookedCandidate),
    isAvailable: interviewers.length > 0 && !bookedCandidate
  };
});
var buildDashboardData = (data, role, accountEmail) => {
  const dashboardData = {
    backendStatus: dashboardStatus()
  };
  if (role === "super-admin" || role === "exec") {
    dashboardData.candidates = Object.values(data.candidates);
    dashboardData.interviewerAvailability = Object.values(data.interviewerAvailability);
    dashboardData.memberSignups = memberSignupsFromAccounts(data.accounts);
    dashboardData.adminAccounts = ADMIN_ACCOUNTS;
    dashboardData.calendarEvents = Object.values(data.calendarEvents);
    dashboardData.launchReadiness = buildLaunchReadiness();
  } else {
    dashboardData.memberSignups = memberSignupsFromAccounts(data.accounts).filter((member) => member.email === accountEmail);
  }
  return dashboardData;
};
var LocalRecruitingStore = class {
  dataPath;
  constructor(dataPath = defaultDataPath()) {
    this.dataPath = dataPath;
  }
  async readBlobData() {
    for (let attempt = 0; attempt < BLOB_READ_MAX_ATTEMPTS; attempt += 1) {
      try {
        const blob = await recruitingBlobClient.get(BLOB_STATE_PATH, { access: "private", useCache: false });
        if (!blob || blob.statusCode !== 200) {
          return { data: this.withPreviewAdmin(emptyData()), etag: null };
        }
        const raw = await new Response(blob.stream).text();
        return {
          data: this.withPreviewAdmin(JSON.parse(raw)),
          etag: writableBlobEtag(blob.blob.etag)
        };
      } catch {
        if (attempt === BLOB_READ_MAX_ATTEMPTS - 1) {
          throw bookingError(
            "BLOB_UNAVAILABLE",
            "Recruiting storage is temporarily unavailable. Please refresh in a minute."
          );
        }
        await sleep(BLOB_READ_RETRY_DELAY_MS * (attempt + 1));
      }
    }
    throw bookingError("BLOB_UNAVAILABLE", "Recruiting storage is temporarily unavailable. Please refresh in a minute.");
  }
  async readData() {
    if (shouldUseBlobStorage()) {
      return (await this.readBlobData()).data;
    }
    try {
      const raw = await readFile(this.dataPath, "utf8");
      return this.withPreviewAdmin(JSON.parse(raw));
    } catch {
      return this.withPreviewAdmin(emptyData());
    }
  }
  async writeBlobData(data, etag) {
    const persistableData = persistableRecruitingData(data);
    await recruitingBlobClient.put(BLOB_STATE_PATH, `${JSON.stringify(persistableData, null, 2)}
`, {
      access: "private",
      allowOverwrite: Boolean(etag),
      addRandomSuffix: false,
      contentType: "application/json",
      ...etag ? { ifMatch: etag } : {}
    });
  }
  async writeData(data) {
    const persistableData = persistableRecruitingData(data);
    if (shouldUseBlobStorage()) {
      await recruitingBlobClient.put(BLOB_STATE_PATH, `${JSON.stringify(persistableData, null, 2)}
`, {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: "application/json"
      });
      return;
    }
    await mkdir(path.dirname(this.dataPath), { recursive: true });
    const tempPath = `${this.dataPath}.${process.pid}.${randomBytes(6).toString("base64url")}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(persistableData, null, 2)}
`);
    await rename(tempPath, this.dataPath);
  }
  localSlotLockPath(slotValue) {
    return path.join(path.dirname(this.dataPath), "slot-locks", `${slotLockId(slotValue)}.json`);
  }
  localResumePath(storageKey) {
    return path.join(path.dirname(this.dataPath), storageKey);
  }
  blobSlotLockPath(slotValue) {
    return `${BLOB_SLOT_LOCK_PREFIX}/${slotLockId(slotValue)}.json`;
  }
  async storeResumeFile(submission) {
    const fileName = safeResumeFileName(submission.resumeFile.name);
    const storageKey = resumeStorageKey(submission.email, submission.submissionId, fileName);
    const content = Buffer.from(submission.resumeFile.contentBase64.replace(/\s+/g, ""), "base64");
    const mimeType = submission.resumeFile.mimeType || "application/octet-stream";
    if (shouldUseBlobStorage()) {
      await recruitingBlobClient.put(storageKey, content, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mimeType
      });
    } else {
      const resumePath = this.localResumePath(storageKey);
      await mkdir(path.dirname(resumePath), { recursive: true });
      await writeFile(resumePath, content);
    }
    return {
      email: submission.email,
      fileName,
      mimeType,
      size: submission.resumeFile.size,
      storageKey,
      storageKind: shouldUseBlobStorage() ? "blob" : "local",
      uploadedAt: submission.submittedAt
    };
  }
  async deleteResumeFile(resume) {
    if (resume.storageKind === "blob" || shouldUseBlobStorage()) {
      await recruitingBlobClient.del(resume.storageKey).catch(() => void 0);
      return;
    }
    await unlink(this.localResumePath(resume.storageKey)).catch(() => void 0);
  }
  async releaseBookingLock(slotValue) {
    if (shouldUseBlobStorage()) {
      await recruitingBlobClient.del(this.blobSlotLockPath(slotValue)).catch(() => void 0);
      return;
    }
    await unlink(this.localSlotLockPath(slotValue)).catch(() => void 0);
  }
  async clearStaleBookingLock(slotValue) {
    if (shouldUseBlobStorage()) {
      const lock = await recruitingBlobClient.get(this.blobSlotLockPath(slotValue), {
        access: "private",
        useCache: false
      }).catch(() => null);
      if (!lock || lock.statusCode !== 200) return true;
      const raw2 = await new Response(lock.stream).text();
      if (!isStaleBookingLock(raw2)) return false;
      await recruitingBlobClient.del(this.blobSlotLockPath(slotValue)).catch(() => void 0);
      return true;
    }
    const lockPath = this.localSlotLockPath(slotValue);
    let raw = "";
    try {
      raw = await readFile(lockPath, "utf8");
    } catch {
      return true;
    }
    if (!isStaleBookingLock(raw)) return false;
    await unlink(lockPath).catch(() => void 0);
    return true;
  }
  async acquireBookingLock(submission) {
    const payload = `${JSON.stringify({
      slotValue: submission.slotValue,
      email: submission.email,
      submissionId: submission.submissionId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2)}
`;
    const writeLock = async () => {
      if (shouldUseBlobStorage()) {
        await recruitingBlobClient.put(this.blobSlotLockPath(submission.slotValue), payload, {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "application/json"
        });
      } else {
        const lockPath = this.localSlotLockPath(submission.slotValue);
        await mkdir(path.dirname(lockPath), { recursive: true });
        const file = await open(lockPath, "wx");
        try {
          await file.writeFile(payload);
        } finally {
          await file.close();
        }
      }
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await writeLock();
        return () => this.releaseBookingLock(submission.slotValue);
      } catch (error) {
        const lockAlreadyExists = isBlobWriteConflict(error) || error && typeof error === "object" && "code" in error && error.code === "EEXIST";
        if (!lockAlreadyExists) {
          throw error;
        }
        if (attempt === 0 && await this.clearStaleBookingLock(submission.slotValue)) {
          continue;
        }
        throw bookingError("SLOT_TAKEN", "That slot was just booked. Please choose another time.");
      }
    }
    throw bookingError("SLOT_TAKEN", "That slot was just booked. Please choose another time.");
  }
  async updateData(mutator) {
    if (shouldUseBlobStorage()) {
      for (let attempt = 0; attempt < BLOB_WRITE_MAX_ATTEMPTS; attempt += 1) {
        const { data, etag } = await this.readBlobData();
        const result = await mutator(data);
        try {
          await this.writeBlobData(data, etag);
          return result;
        } catch (error) {
          if (!isBlobWriteConflict(error) || attempt === BLOB_WRITE_MAX_ATTEMPTS - 1) {
            throw error;
          }
        }
      }
      throw bookingError("WRITE_CONFLICT", "Could not save that change. Please try again.");
    }
    const key = shouldUseBlobStorage() ? `blob:${BLOB_STATE_PATH}` : `file:${this.dataPath}`;
    const previous = mutationQueues.get(key) || Promise.resolve();
    const next = previous.catch(() => void 0).then(async () => {
      const data = await this.readData();
      const result = await mutator(data);
      await this.writeData(data);
      return result;
    });
    mutationQueues.set(key, next.catch(() => void 0));
    return next;
  }
  withPreviewAdmin(data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const email = "sbodine@umich.edu";
    const existing = data.accounts[email];
    data.calendarEvents ||= {};
    data.rateLimits ||= {};
    data.resumes ||= {};
    data.memberProfiles ||= {};
    data.clubEvents ||= {};
    data.eventRsvps ||= {};
    data.announcements ||= {};
    data.portalResources ||= {};
    data.auditLog ||= [];
    const shouldSeedDefaultPreview = !process.env.UBLDA_LOCAL_DATA_FILE && !shouldUseBlobStorage();
    seedLowDemandTestSignups(data, shouldSeedDefaultPreview);
    data.accounts[email] = {
      firstName: existing?.firstName || "Sam",
      lastName: existing?.lastName || "Bodine",
      uniqname: "sbodine",
      email,
      role: existing?.role || "super-admin",
      // Both of these come from the roster so the Console — whose whole job is documenting
      // who can do what — cannot disagree with it about the club's own super-admin. The
      // hand-written list here predated the 'events' scope and silently omitted it.
      adminTitle: existing?.adminTitle || adminAccountForEmail(email)?.title || "Super Admin",
      adminScopes: existing?.adminScopes || [...ADMIN_SCOPES],
      createdAt: existing?.createdAt || now,
      updatedAt: existing?.updatedAt || now,
      sessionToken: existing?.sessionToken || LOCAL_PREVIEW_SESSION_TOKEN,
      sessionExpiresAt: existing?.sessionExpiresAt || sessionExpiresAt(),
      passwordSalt: existing?.passwordSalt || "",
      passwordHash: existing?.passwordHash || "",
      application: existing?.application || null
    };
    delete data.sessions[LOCAL_PREVIEW_SESSION_TOKEN];
    return data;
  }
  async upsertAccount(account, password = "") {
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing = data.accounts[account.email];
      const sessionToken = existing?.sessionToken && existing.sessionToken !== LOCAL_PREVIEW_SESSION_TOKEN ? existing.sessionToken : createSessionToken();
      const passwordPair = password ? hashPassword(password) : {
        salt: existing?.passwordSalt || "",
        hash: existing?.passwordHash || ""
      };
      const stored = {
        ...account,
        // A role granted in the Console is an administrative act, not session state: it has
        // to outlive the next sign-in. Sign-in callers never send these fields, so without
        // the carry-forward every grant would be silently wiped the next time that officer
        // authenticated. Carrying `role` forward cannot elevate anyone on its own — a
        // never-granted account has `role: 'member'` stored, and effectiveRoleForAccount
        // still requires a Google-verified identity to reach the roster.
        role: account.role || existing?.role,
        adminScopes: account.adminScopes || existing?.adminScopes,
        adminTitle: account.adminTitle || existing?.adminTitle || "",
        verifiedVia: account.verifiedVia || existing?.verifiedVia || "password",
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        sessionToken,
        sessionExpiresAt: sessionExpiresAt(),
        passwordSalt: passwordPair.salt,
        passwordHash: passwordPair.hash,
        application: existing?.application || null
      };
      data.accounts[stored.email] = stored;
      data.sessions[sessionToken] = {
        email: stored.email,
        expiresAt: stored.sessionExpiresAt
      };
      return {
        account: decorateAccount(stored),
        sessionToken,
        application: stored.application
      };
    });
  }
  async signIn(email, password) {
    return this.updateData((data) => {
      const account = data.accounts[email];
      if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
        return null;
      }
      account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      account.sessionToken = account.sessionToken || createSessionToken();
      account.sessionExpiresAt = sessionExpiresAt();
      data.sessions[account.sessionToken] = {
        email,
        expiresAt: account.sessionExpiresAt
      };
      return {
        account: decorateAccount(account),
        sessionToken: account.sessionToken,
        application: account.application
      };
    });
  }
  async restoreSession(sessionToken) {
    if (sessionToken === LOCAL_PREVIEW_SESSION_TOKEN) {
      return null;
    }
    const data = await this.readData();
    const session = data.sessions[sessionToken];
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }
    const account = data.accounts[session.email];
    if (!account) {
      return null;
    }
    return {
      account: decorateAccount(account),
      sessionToken,
      application: account.application
    };
  }
  async deleteSession(sessionToken) {
    return this.updateData((data) => {
      const session = data.sessions[sessionToken];
      delete data.sessions[sessionToken];
      if (session) {
        const account = data.accounts[session.email];
        if (account?.sessionToken === sessionToken) {
          account.sessionToken = "";
          account.sessionExpiresAt = (/* @__PURE__ */ new Date(0)).toISOString();
          account.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
      return { deleted: Boolean(session) };
    });
  }
  async saveApplication(submission) {
    const resume = await this.storeResumeFile(submission);
    const now = submission.submittedAt;
    await this.updateData((data) => {
      data.resumes ||= {};
      data.resumes[submission.email] = resume;
      const existingAccount = data.accounts[submission.email];
      const existingCandidate = data.candidates[submission.email];
      if (existingAccount) {
        existingAccount.application = {
          status: submission.status,
          interviewSlot: submission.interviewSlot.label,
          resumeUrl: resumeUrlForEmail(submission.email),
          updatedAt: now,
          submissionCount: (existingAccount.application?.submissionCount || 0) + 1
        };
        existingAccount.updatedAt = now;
      }
      data.candidates[submission.email] = {
        id: submission.uniqname,
        name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
        program: [submission.college, submission.year].filter(Boolean).join(" \xB7 "),
        email: submission.email,
        rolePreferences: submission.rolePreferences,
        status: existingCandidate?.status || statusForDashboard(submission.status),
        availability: submission.availability.map((slot) => slot.value),
        resumeUrl: resumeUrlForEmail(submission.email),
        assignedSlot: existingCandidate?.assignedSlot || "",
        interviewers: existingCandidate?.interviewers || [],
        feedback: existingCandidate?.feedback || ""
      };
    });
  }
  async saveInterviewerAvailability(submission) {
    return this.updateData((data) => {
      const admin = adminAccountForEmail(submission.email);
      const existing = data.interviewerAvailability[submission.email];
      data.interviewerAvailability[submission.email] = {
        name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
        role: admin?.title || "E-board",
        email: submission.email,
        uniqname: submission.uniqname,
        availability: submission.availability.map((slot) => slot.value),
        availabilitySummary: submission.availabilitySummary,
        maxInterviews: submission.maxInterviews || "As needed",
        notes: submission.notes,
        updatedAt: submission.submittedAt,
        submissionCount: (existing?.submissionCount || 0) + 1
      };
      return { updatedExistingSubmission: Boolean(existing) };
    });
  }
  async saveInterviewAssignment(submission) {
    return this.updateData((data) => {
      const candidate = data.candidates[submission.email];
      const assignedSlotValue = submission.assignedSlot?.value || "";
      if (candidate) {
        if (assignedSlotValue) {
          const conflictingCandidate = Object.values(data.candidates).find((row) => row.email !== submission.email && row.assignedSlot === assignedSlotValue);
          if (conflictingCandidate) {
            throw bookingError("SLOT_TAKEN", "That slot is already finalized for another interviewee.");
          }
          const availableNames = new Set(Object.values(data.interviewerAvailability).filter((interviewer) => interviewer.availability.includes(assignedSlotValue)).map((interviewer) => interviewer.name));
          const unavailableInterviewers = submission.interviewers.filter((interviewer) => !availableNames.has(interviewer));
          if (unavailableInterviewers.length > 0) {
            throw bookingError("INTERVIEWER_UNAVAILABLE", "Assigned interviewers must be available for the selected interview slot.");
          }
        }
        candidate.assignedSlot = assignedSlotValue;
        candidate.interviewers = submission.interviewers;
        candidate.status = submission.interviewStatus;
        candidate.feedback = submission.feedback;
      }
      return { updatedCandidate: Boolean(candidate) };
    });
  }
  async publicInterviewSlots() {
    const data = await this.readData();
    return bookingSlotRows(data);
  }
  async consumeRateLimit(key, maxAttempts, windowMs) {
    return this.updateData((data) => {
      data.rateLimits ||= {};
      const now = Date.now();
      const existing = data.rateLimits[key];
      if (!existing || existing.resetAt <= now) {
        data.rateLimits[key] = { count: 1, resetAt: now + windowMs };
        return { limited: false, retryAfterSeconds: 0 };
      }
      existing.count += 1;
      return {
        limited: existing.count > maxAttempts,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1e3))
      };
    });
  }
  async bookInterviewSlot(submission) {
    const preflightData = await this.readData();
    const slot = getInterviewSlotByValue(submission.slotValue);
    if (!slot) {
      throw bookingError("INVALID_SLOT", "Choose a valid interview slot.");
    }
    const preflightInterviewers = Object.values(preflightData.interviewerAvailability).filter((interviewer) => interviewer.availability.includes(submission.slotValue));
    if (preflightInterviewers.length === 0) {
      throw bookingError("NO_INTERVIEWER_COVERAGE", "That slot no longer has e-board interviewer coverage.");
    }
    const preflightBookedCandidate = Object.values(preflightData.candidates).find((candidate) => candidate.assignedSlot === submission.slotValue);
    if (preflightBookedCandidate && preflightBookedCandidate.email !== submission.email) {
      throw bookingError("SLOT_TAKEN", "That slot was just booked. Please choose another time.");
    }
    const preflightExistingCandidate = preflightData.candidates[submission.email];
    if (preflightExistingCandidate?.assignedSlot && preflightExistingCandidate.assignedSlot !== submission.slotValue) {
      throw bookingError("ALREADY_BOOKED", "This email already has an interview slot. Email sbodine@umich.edu if you need to reschedule.");
    }
    const releaseLock = await this.acquireBookingLock(submission);
    let storedResume = null;
    let previousResume = null;
    try {
      const savedBooking = await this.updateData(async (data) => {
        data.resumes ||= {};
        const availableInterviewers = Object.values(data.interviewerAvailability).filter((interviewer) => interviewer.availability.includes(submission.slotValue)).sort((left, right) => left.name.localeCompare(right.name));
        if (availableInterviewers.length === 0) {
          throw bookingError("NO_INTERVIEWER_COVERAGE", "That slot no longer has e-board interviewer coverage.");
        }
        const bookedCandidate = Object.values(data.candidates).find((candidate) => candidate.assignedSlot === submission.slotValue);
        if (bookedCandidate && bookedCandidate.email !== submission.email) {
          throw bookingError("SLOT_TAKEN", "That slot was just booked. Please choose another time.");
        }
        const existingCandidate = data.candidates[submission.email];
        if (existingCandidate?.assignedSlot && existingCandidate.assignedSlot !== submission.slotValue) {
          throw bookingError("ALREADY_BOOKED", "This email already has an interview slot. Email sbodine@umich.edu if you need to reschedule.");
        }
        const interviewers = availableInterviewers.slice(0, 2).map((interviewer) => interviewer.name);
        const rolePreferences = submission.rolePreferences?.length ? submission.rolePreferences : existingCandidate?.rolePreferences?.length ? existingCandidate.rolePreferences : [submission.roleInterest || "Open function preference"].filter(Boolean);
        const feedbackNotes = [
          existingCandidate?.feedback || "",
          submission.conflicts ? `Booking notes: ${submission.conflicts}` : ""
        ].filter(Boolean).join("\n");
        storedResume ||= await this.storeResumeFile(submission);
        previousResume = data.resumes[submission.email] || null;
        data.resumes[submission.email] = storedResume;
        data.candidates[submission.email] = {
          id: existingCandidate?.id || candidateIdFromEmail(submission.email),
          name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
          program: existingCandidate?.program || "Interview slot signup",
          email: submission.email,
          rolePreferences,
          status: "Invited",
          availability: existingCandidate?.availability?.length ? existingCandidate.availability : [submission.slotValue],
          resumeUrl: resumeUrlForEmail(submission.email),
          assignedSlot: submission.slotValue,
          interviewers,
          feedback: feedbackNotes
        };
        return {
          candidate: data.candidates[submission.email],
          slot,
          interviewers
        };
      });
      const resumeToDelete = previousResume;
      const activeResume = storedResume;
      if (resumeToDelete && activeResume && resumeToDelete.storageKey !== activeResume.storageKey) {
        await this.deleteResumeFile(resumeToDelete);
      }
      return savedBooking;
    } catch (error) {
      if (storedResume) {
        await this.deleteResumeFile(storedResume);
      }
      throw error;
    } finally {
      await releaseLock();
    }
  }
  async saveCalendarEvent(event) {
    return this.updateData((data) => {
      data.calendarEvents[event.id] = event;
      return event;
    });
  }
  async deleteCalendarEvent(id) {
    return this.updateData((data) => {
      const existed = Boolean(data.calendarEvents[id]);
      delete data.calendarEvents[id];
      return { deleted: existed };
    });
  }
  // ── Portal ────────────────────────────────────────────────────────────────
  // Every method below is a pure upsert with no external side effects, so it is safe
  // to run 2–5× under blob CAS retry, and every mutation appends its audit entry
  // inside the SAME mutator as the change it describes. Never nest updateData.
  recordAudit(data, entry) {
    data.auditLog = appendAudit(data.auditLog || [], buildAuditEntry(entry));
  }
  memberProfileFor(data, email, actorEmail) {
    const key = email.trim().toLowerCase();
    const existing = data.memberProfiles[key];
    if (existing) return normalizeMemberProfileRecord(existing, key);
    const seed = memberSeedFromAccount(data.accounts[key]);
    const isSelfCreated = key === actorEmail.trim().toLowerCase();
    return buildMemberProfileRecord(
      key,
      isSelfCreated ? { ...seed, source: "self-signup" } : seed,
      actorEmail
    );
  }
  async listPortalWorkspace() {
    const data = await this.readData();
    return {
      accounts: Object.values(data.accounts).map(portalAccountSummary),
      memberProfiles: Object.values(data.memberProfiles).map((profile) => normalizeMemberProfileRecord(profile)),
      clubEvents: Object.values(data.clubEvents),
      eventRsvps: Object.values(data.eventRsvps),
      announcements: Object.values(data.announcements),
      resources: sortPortalResources(Object.values(data.portalResources))
    };
  }
  /**
   * Applies an already-validated patch. `access` is structurally excluded by
   * applyMemberProfilePatch, so neither a member nor an admin can write access data here.
   * Pass `audit: false` for a member's own profile edit.
   */
  async saveMemberProfile(email, patch, actor, options = {}) {
    const key = email.trim().toLowerCase();
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existed = Boolean(data.memberProfiles[key]);
      const base = this.memberProfileFor(data, key, actor.email);
      const record = applyMemberProfilePatch(base, patch, actor.email, now);
      data.memberProfiles[key] = record;
      if (options.audit !== false) {
        this.recordAudit(data, {
          actorEmail: actor.email,
          actorRole: actor.role,
          action: options.action || "admin.member.upsert",
          targetType: "member",
          targetId: key,
          summary: `${existed ? "Updated" : "Added"} member ${memberDisplayName(record)} (${key}).`
        });
      }
      return record;
    });
  }
  /** Idempotent: rerunning with the same emails leaves already-admitted members untouched. */
  async bulkAdmitMembers(input, actor) {
    const emails = Array.from(new Set(
      input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean)
    )).slice(0, BULK_ADMIT_LIMIT);
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const admitted = [];
      let created = 0;
      emails.forEach((key) => {
        const existing = data.memberProfiles[key];
        if (existing) {
          const current = normalizeMemberProfileRecord(existing, key);
          const needsAdmitting = current.source === "self-signup" && current.status === "prospect";
          if (!needsAdmitting) {
            admitted.push(current);
            return;
          }
          const promoted = {
            ...current,
            status: input.status,
            source: input.source,
            year: current.year || input.year || "",
            school: current.school || input.school || "",
            interests: current.interests.length ? current.interests : input.interests || [],
            joinedAt: current.joinedAt || now,
            updatedAt: now,
            updatedBy: actor.email
          };
          data.memberProfiles[key] = promoted;
          admitted.push(promoted);
          created += 1;
          return;
        }
        const record = buildMemberProfileRecord(key, {
          ...memberSeedFromAccount(data.accounts[key]),
          status: input.status,
          source: input.source,
          year: input.year || "",
          school: input.school || "",
          interests: input.interests || [],
          joinedAt: now
        }, actor.email);
        data.memberProfiles[key] = record;
        admitted.push(record);
        created += 1;
      });
      if (created > 0) {
        this.recordAudit(data, {
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "admin.member.bulkAdmit",
          targetType: "member",
          targetId: `batch:${created}`,
          summary: `Admitted ${created} member${created === 1 ? "" : "s"} from intake as ${input.status}.`
        });
      }
      return admitted;
    });
  }
  /** Owner-write only. The audit entry records the sharing scope and never the content. */
  async saveMemberAccess(email, input, actor) {
    const key = email.trim().toLowerCase();
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const base = this.memberProfileFor(data, key, key);
      const record = {
        ...base,
        access: buildAccessProfile(input, base.access, now),
        updatedAt: now
      };
      data.memberProfiles[key] = record;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "member.saveAccess",
        targetType: "member",
        targetId: key,
        summary: `Access sharing set to ${record.access.scope}.`
      });
      return record;
    });
  }
  async withdrawMemberAccessConsent(email, actor) {
    const key = email.trim().toLowerCase();
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const base = this.memberProfileFor(data, key, key);
      const record = {
        ...base,
        access: withdrawAccessProfile(normalizeAccessProfile(base.access), now),
        updatedAt: now
      };
      data.memberProfiles[key] = record;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "member.withdrawAccessConsent",
        targetType: "member",
        targetId: key,
        summary: "Access sharing withdrawn."
      });
      return record;
    });
  }
  /** Create forces `draft`; an edit never changes `status`. Publishing has its own method. */
  async saveClubEvent(input, actor) {
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing = input.id ? data.clubEvents[input.id] : void 0;
      const event = existing ? mergeClubEvent(existing, input, now) : buildClubEvent(input, actor.email);
      data.clubEvents[event.id] = event;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.event.upsert",
        targetType: "event",
        targetId: event.id,
        summary: `${existing ? "Updated" : "Drafted"} event \u201C${event.title}\u201D.`
      });
      return event;
    });
  }
  async publishClubEvent(eventId, actor) {
    return this.updateData((data) => {
      const existing = data.clubEvents[eventId];
      if (!existing) {
        return { ok: false, blockers: ["That event no longer exists."] };
      }
      const gate = canPublishEvent(existing);
      if (!gate.ok) {
        return { ok: false, blockers: gate.blockers };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const event = {
        ...existing,
        status: "published",
        publishedAt: existing.publishedAt || now,
        publishedBy: actor.email,
        updatedAt: now
      };
      data.clubEvents[event.id] = event;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.event.publish",
        targetType: "event",
        targetId: event.id,
        summary: `Published event \u201C${event.title}\u201D.`
      });
      return { ok: true, event };
    });
  }
  async cancelClubEvent(eventId, reason, actor) {
    return this.updateData((data) => {
      const existing = data.clubEvents[eventId];
      if (!existing) {
        return { ok: false, blockers: ["That event no longer exists."] };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const trimmedReason = reason.trim().slice(0, 240);
      const internalNotes = [existing.internalNotes, trimmedReason ? `Cancelled: ${trimmedReason}` : ""].filter(Boolean).join("\n").slice(0, 1e3);
      const event = { ...existing, status: "cancelled", internalNotes, updatedAt: now };
      data.clubEvents[event.id] = event;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.event.cancel",
        targetType: "event",
        targetId: event.id,
        summary: `Cancelled event \u201C${event.title}\u201D.${trimmedReason ? ` Reason: ${trimmedReason}` : ""}`
      });
      return { ok: true, event };
    });
  }
  /**
   * Writes the CALLER's row, always. `rsvpCount` counts 'going' responses.
   * Member RSVPs are not audited: the log is a capped 300-entry buffer and RSVP churn
   * would evict the admin actions it exists to record.
   */
  async saveEventRsvp(email, input) {
    const key = email.trim().toLowerCase();
    return this.updateData((data) => {
      const event = data.clubEvents[input.eventId];
      if (!event) {
        return { ok: false, blockers: ["That event no longer exists."] };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const gate = isRsvpOpen(event, now);
      if (!gate.ok) {
        return { ok: false, blockers: gate.blockers };
      }
      const id = rsvpKey(event.id, key);
      const rsvp = buildEventRsvp(key, { ...input, eventId: event.id }, data.eventRsvps[id], now);
      data.eventRsvps[id] = rsvp;
      const rsvpCount = Object.values(data.eventRsvps).filter((row) => row.eventId === event.id && row.response === "going").length;
      return { ok: true, rsvp, event, rsvpCount };
    });
  }
  /** Creates the RSVP row for a walk-in when there is none. */
  async checkInMember(eventId, email, checkedIn, actor) {
    const key = email.trim().toLowerCase();
    return this.updateData((data) => {
      const event = data.clubEvents[eventId];
      if (!event) {
        return { ok: false, blockers: ["That event no longer exists."] };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const id = rsvpKey(eventId, key);
      const existing = data.eventRsvps[id];
      const rsvp = {
        id,
        eventId,
        email: key,
        response: existing?.response || "going",
        guestCount: existing?.guestCount || 0,
        accommodationNote: existing?.accommodationNote || "",
        shareAccommodationWithLeads: existing?.shareAccommodationWithLeads || false,
        respondedAt: existing?.respondedAt || now,
        checkedInAt: checkedIn ? existing?.checkedInAt || now : "",
        checkedInBy: checkedIn ? actor.email : ""
      };
      data.eventRsvps[id] = rsvp;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.event.checkIn",
        targetType: "rsvp",
        targetId: id,
        summary: `${checkedIn ? "Checked in" : "Undid check-in for"} ${key} at \u201C${event.title}\u201D.`
      });
      return { ok: true, rsvp };
    });
  }
  /** Create forces `draft`; an edit never changes `status`. */
  async saveAnnouncement(input, actor) {
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing = input.id ? data.announcements[input.id] : void 0;
      const announcement = existing ? mergeAnnouncement(existing, input, now) : buildAnnouncement(input, actor.email);
      data.announcements[announcement.id] = announcement;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.announcement.upsert",
        targetType: "announcement",
        targetId: announcement.id,
        summary: `${existing ? "Updated" : "Drafted"} announcement \u201C${announcement.title}\u201D.`
      });
      return announcement;
    });
  }
  async publishAnnouncement(id, status, actor) {
    return this.updateData((data) => {
      const existing = data.announcements[id];
      if (!existing) {
        return { ok: false, blockers: ["That announcement no longer exists."] };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const announcement = {
        ...existing,
        status,
        publishedAt: status === "published" ? existing.publishedAt || now : existing.publishedAt,
        approvedBy: actor.email,
        updatedAt: now
      };
      data.announcements[announcement.id] = announcement;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.announcement.publish",
        targetType: "announcement",
        targetId: announcement.id,
        summary: `${status === "published" ? "Published" : "Archived"} announcement \u201C${announcement.title}\u201D.`
      });
      return { ok: true, announcement };
    });
  }
  async savePortalResource(input, actor) {
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing = input.id ? data.portalResources[input.id] : void 0;
      const nextOrder = Object.values(data.portalResources).reduce((highest, row) => Math.max(highest, row.order), -1) + 1;
      const resource = existing ? mergePortalResource(existing, input, now) : buildPortalResource(input, actor.email, nextOrder);
      data.portalResources[resource.id] = resource;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.resource.upsert",
        targetType: "resource",
        targetId: resource.id,
        summary: `${existing ? "Updated" : "Added"} resource \u201C${resource.title}\u201D.`
      });
      return resource;
    });
  }
  /** Rewrites `order` for exactly the ids given; anything else keeps its place. */
  async reorderPortalResources(ids, actor) {
    return this.updateData((data) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      let moved = 0;
      ids.forEach((id, index) => {
        const resource = data.portalResources[id];
        if (!resource) return;
        if (resource.order === index) return;
        data.portalResources[id] = { ...resource, order: index, updatedAt: now };
        moved += 1;
      });
      if (ids.length > 0) {
        this.recordAudit(data, {
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "admin.resource.reorder",
          targetType: "resource",
          targetId: `batch:${ids.length}`,
          summary: `Reordered the member library: ${moved} of ${ids.length} resource${ids.length === 1 ? "" : "s"} moved.`
        });
      }
      return sortPortalResources(Object.values(data.portalResources));
    });
  }
  /** For actions that are audited but do not otherwise mutate the document, such as an export. */
  async appendAuditEntry(entry) {
    return this.updateData((data) => {
      const built = buildAuditEntry(entry);
      data.auditLog = appendAudit(data.auditLog || [], built);
      return built;
    });
  }
  /** Newest first. */
  async readAuditLog(limit = 100) {
    const data = await this.readData();
    return readAuditEntries(data.auditLog || [], limit);
  }
  /**
   * The manual escape hatch: a super-admin can elevate an officer from the Console
   * without depending on the Google sign-in path working.
   */
  async grantAccountRole(input, actor) {
    const key = input.email.trim().toLowerCase();
    return this.updateData((data) => {
      const existing = data.accounts[key];
      if (!existing) {
        return { ok: false, blockers: ["No account has signed in with that email yet."] };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      existing.role = input.role;
      existing.adminScopes = input.role === "member" ? [] : [...input.scopes];
      existing.adminTitle = input.title || adminAccountForEmail(key)?.title || (input.role === "member" ? "Member" : "Exec Admin");
      existing.updatedAt = now;
      this.recordAudit(data, {
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "admin.grantRole",
        targetType: "admin-account",
        targetId: key,
        summary: `Set ${key} to ${input.role}${existing.adminScopes.length ? ` with ${existing.adminScopes.join(", ")}` : ""}.`
      });
      return { ok: true, account: portalAccountSummary(existing) };
    });
  }
  async dashboardData(sessionToken) {
    const session = await this.restoreSession(sessionToken);
    if (!session) return null;
    const data = await this.readData();
    const role = session.account.role || "member";
    return {
      account: session.account,
      role,
      dashboardData: buildDashboardData(data, role, session.account.email)
    };
  }
  async leadershipDashboardData() {
    const data = await this.readData();
    return buildDashboardData(data, "super-admin", "sbodine@umich.edu");
  }
  async readCandidateResume(email) {
    const data = await this.readData();
    const resume = data.resumes?.[email];
    if (!resume) return null;
    if (resume.storageKind === "blob" || shouldUseBlobStorage()) {
      const blob = await recruitingBlobClient.get(resume.storageKey, { access: "private", useCache: false });
      if (!blob || blob.statusCode !== 200) return null;
      const content2 = Buffer.from(await new Response(blob.stream).arrayBuffer());
      return { ...resume, content: content2 };
    }
    const content = await readFile(this.localResumePath(resume.storageKey));
    return { ...resume, content };
  }
};
var createLocalRecruitingStore = (dataPath) => new LocalRecruitingStore(dataPath);
export {
  LOCAL_PREVIEW_SESSION_TOKEN,
  LocalRecruitingStore,
  createLocalRecruitingStore,
  setRecruitingBlobClientForTests
};
