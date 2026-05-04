// server/localRecruitingStore.ts

// server/localRecruitingStore.ts
import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobPreconditionFailedError, del, get, put } from "@vercel/blob";
import bcrypt from "bcryptjs";

// src/lib/dashboardAccess.ts
var SUPER_ADMIN_EMAIL = "sbodine@umich.edu";
var ADMIN_ACCOUNTS = [
  {
    email: SUPER_ADMIN_EMAIL,
    name: "Sam Bodine",
    title: "Super Admin",
    role: "super-admin",
    scopes: ["recruiting", "members", "announcements", "resources", "system"]
  },
  {
    email: "atchiang@umich.edu",
    name: "Alexa Chiang",
    title: "Exec Admin",
    role: "exec",
    scopes: ["recruiting", "members", "announcements", "resources"]
  },
  {
    email: "cooperry@umich.edu",
    name: "Cooper Perry",
    title: "Exec Admin",
    role: "exec",
    scopes: ["recruiting", "members"]
  }
];
var adminAccountForEmail = (email) => ADMIN_ACCOUNTS.find((account) => account.email === email.toLowerCase());

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
  },
  {
    date: "2026-05-10",
    shortLabel: "Sun, May 10",
    label: "Sunday, May 10"
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
var INTERVIEW_WINDOW_LABEL = "Thursday, May 7 through Sunday, May 10";
var INTERVIEW_DAY_RANGE_LABEL = `${INTERVIEW_WINDOW_LABEL}, ${formatHour(INTERVIEW_START_HOUR_ET)}-${formatHour(INTERVIEW_END_HOUR_ET)} ET`;
var INTERVIEW_BLOCK_WITH_BUFFER_LABEL = `${INTERVIEW_BLOCK_MINUTES}-minute interview + ${INTERVIEW_BUFFER_MINUTES}-minute buffer`;
var BOARD_POSITION_OPTIONS = [
  "Events and Programming",
  "Marketing and Social Media",
  "Outreach and Partnerships"
];
var slotByValue = new Map(INTERVIEW_SLOTS.map((slot) => [slot.value, slot]));
var boardPositionValues = new Set(BOARD_POSITION_OPTIONS);
var getInterviewSlotByValue = (value) => slotByValue.get(value);

// server/localRecruitingStore.ts
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
var BCRYPT_COST = 12;
var PASSWORD_HASH_ALGORITHM = "bcrypt";
var BLOB_STATE_PATH = "recruiting/state.json";
var BLOB_SLOT_LOCK_PREFIX = "recruiting/slot-locks";
var LOCAL_PREVIEW_SESSION_TOKEN = "local-preview-session-token";
var mutationQueues = /* @__PURE__ */ new Map();
var BLOB_WRITE_MAX_ATTEMPTS = 5;
var emptyData = () => ({
  version: 1,
  accounts: {},
  sessions: {},
  candidates: {},
  interviewerAvailability: {},
  calendarEvents: {},
  rateLimits: {}
});
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
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    email: account.email,
    role: account.role || "member",
    adminTitle: account.adminTitle || "Member",
    adminScopes: account.adminScopes || []
  };
};
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
var bookingError = (code, message) => Object.assign(new Error(message), { code });
var isBlobWriteConflict = (error) => error instanceof BlobPreconditionFailedError || error instanceof Error && /precondition|already exists|overwrite/i.test(error.message);
var slotLockId = (slotValue) => createHash("sha256").update(slotValue).digest("base64url");
var bookingSlotRows = (data) => INTERVIEW_SLOTS.map((slot) => {
  const interviewers = Object.values(data.interviewerAvailability).filter((interviewer) => interviewer.availability.includes(slot.value)).map((interviewer) => interviewer.name).sort((left, right) => left.localeCompare(right));
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
    try {
      const blob = await get(BLOB_STATE_PATH, { access: "private", useCache: false });
      if (!blob || blob.statusCode !== 200) {
        return { data: this.withPreviewAdmin(emptyData()), etag: null };
      }
      const raw = await new Response(blob.stream).text();
      return {
        data: this.withPreviewAdmin(JSON.parse(raw)),
        etag: blob.blob.etag
      };
    } catch {
      return { data: this.withPreviewAdmin(emptyData()), etag: null };
    }
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
    await put(BLOB_STATE_PATH, `${JSON.stringify(data, null, 2)}
`, {
      access: "private",
      allowOverwrite: Boolean(etag),
      addRandomSuffix: false,
      contentType: "application/json",
      ...etag ? { ifMatch: etag } : {}
    });
  }
  async writeData(data) {
    if (shouldUseBlobStorage()) {
      await put(BLOB_STATE_PATH, `${JSON.stringify(data, null, 2)}
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
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}
`);
    await rename(tempPath, this.dataPath);
  }
  localSlotLockPath(slotValue) {
    return path.join(path.dirname(this.dataPath), "slot-locks", `${slotLockId(slotValue)}.json`);
  }
  blobSlotLockPath(slotValue) {
    return `${BLOB_SLOT_LOCK_PREFIX}/${slotLockId(slotValue)}.json`;
  }
  async releaseBookingLock(slotValue) {
    if (shouldUseBlobStorage()) {
      await del(this.blobSlotLockPath(slotValue)).catch(() => void 0);
      return;
    }
    await unlink(this.localSlotLockPath(slotValue)).catch(() => void 0);
  }
  async acquireBookingLock(submission) {
    const payload = `${JSON.stringify({
      slotValue: submission.slotValue,
      email: submission.email,
      submissionId: submission.submissionId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2)}
`;
    try {
      if (shouldUseBlobStorage()) {
        await put(this.blobSlotLockPath(submission.slotValue), payload, {
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
    } catch (error) {
      if (isBlobWriteConflict(error) || error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
        throw bookingError("SLOT_TAKEN", "That slot was just booked. Please choose another time.");
      }
      throw error;
    }
    return () => this.releaseBookingLock(submission.slotValue);
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
    data.accounts[email] = {
      firstName: existing?.firstName || "Sam",
      lastName: existing?.lastName || "Bodine",
      uniqname: "sbodine",
      email,
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
    const data = await this.readData();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = data.accounts[account.email];
    const sessionToken = existing?.sessionToken || createSessionToken();
    const passwordPair = password ? hashPassword(password) : {
      salt: existing?.passwordSalt || "",
      hash: existing?.passwordHash || ""
    };
    const stored = {
      ...account,
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
    await this.writeData(data);
    return {
      account: decorateAccount(stored),
      sessionToken,
      application: stored.application
    };
  }
  async signIn(email, password) {
    const data = await this.readData();
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
    await this.writeData(data);
    return {
      account: decorateAccount(account),
      sessionToken: account.sessionToken,
      application: account.application
    };
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
    const data = await this.readData();
    const existingAccount = data.accounts[submission.email];
    const existingCandidate = data.candidates[submission.email];
    const now = submission.submittedAt;
    if (existingAccount) {
      existingAccount.application = {
        status: submission.status,
        interviewSlot: submission.interviewSlot.label,
        resumeUrl: `local-preview://${submission.resumeFile.name}`,
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
      resumeUrl: `local-preview://${submission.resumeFile.name}`,
      assignedSlot: existingCandidate?.assignedSlot || "",
      interviewers: existingCandidate?.interviewers || [],
      feedback: existingCandidate?.feedback || ""
    };
    await this.writeData(data);
  }
  async saveInterviewerAvailability(submission) {
    const data = await this.readData();
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
    await this.writeData(data);
    return { updatedExistingSubmission: Boolean(existing) };
  }
  async saveInterviewAssignment(submission) {
    const data = await this.readData();
    const candidate = data.candidates[submission.email];
    if (candidate) {
      candidate.assignedSlot = submission.assignedSlot?.value || "";
      candidate.interviewers = submission.interviewers;
      candidate.status = submission.interviewStatus;
      candidate.feedback = submission.feedback;
    }
    await this.writeData(data);
    return { updatedCandidate: Boolean(candidate) };
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
    try {
      return await this.updateData((data) => {
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
        data.candidates[submission.email] = {
          id: existingCandidate?.id || candidateIdFromEmail(submission.email),
          name: `${submission.firstName} ${submission.lastName}`.trim() || submission.email,
          program: existingCandidate?.program || "Interview slot signup",
          email: submission.email,
          rolePreferences,
          status: "Invited",
          availability: existingCandidate?.availability?.length ? existingCandidate.availability : [submission.slotValue],
          resumeUrl: existingCandidate?.resumeUrl || "",
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
    } finally {
      await releaseLock();
    }
  }
  async saveCalendarEvent(event) {
    const data = await this.readData();
    data.calendarEvents[event.id] = event;
    await this.writeData(data);
    return event;
  }
  async deleteCalendarEvent(id) {
    const data = await this.readData();
    const existed = Boolean(data.calendarEvents[id]);
    delete data.calendarEvents[id];
    await this.writeData(data);
    return { deleted: existed };
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
};
var createLocalRecruitingStore = (dataPath) => new LocalRecruitingStore(dataPath);
export {
  LOCAL_PREVIEW_SESSION_TOKEN,
  LocalRecruitingStore,
  createLocalRecruitingStore
};
