// server/localRecruitingStore.ts
import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";

// src/lib/dashboardAccess.ts
var SUPER_ADMIN_EMAIL = "sbodine@umich.edu";
var ADMIN_ACCOUNTS = [
  {
    email: SUPER_ADMIN_EMAIL,
    name: "Sam Bodine",
    title: "Super Admin",
    role: "super-admin",
    scopes: ["recruiting", "members", "events", "sponsors", "publishing", "system"]
  },
  {
    email: "atchiang@umich.edu",
    name: "Alexa Chiang",
    title: "Exec Admin",
    role: "exec",
    scopes: ["recruiting", "events", "members", "publishing"]
  },
  {
    email: "cooperry@umich.edu",
    name: "Cooper Ryan",
    title: "Exec Admin",
    role: "exec",
    scopes: ["recruiting", "members", "sponsors"]
  }
];
var adminAccountForEmail = (email) => ADMIN_ACCOUNTS.find((account) => account.email === email.toLowerCase());
var roleForEmail = (email) => adminAccountForEmail(email)?.role || "member";

// server/localRecruitingStore.ts
var SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
var BLOB_STATE_PATH = "recruiting/state.json";
var LOCAL_PREVIEW_SESSION_TOKEN = "local-preview-session-token";
var emptyData = () => ({
  version: 1,
  accounts: {},
  sessions: {},
  candidates: {},
  interviewerAvailability: {}
});
var defaultDataPath = () => process.env.UBLDA_LOCAL_DATA_FILE || path.join(process.cwd(), ".ublda-local-data", "recruiting.json");
var shouldUseBlobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
var sessionExpiresAt = () => new Date(Date.now() + SESSION_TTL_MS).toISOString();
var hashPassword = (password, salt = randomBytes(16).toString("base64url")) => ({
  salt,
  hash: pbkdf2Sync(password, salt, 12e4, 32, "sha256").toString("base64url")
});
var constantTimeEquals = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};
var verifyPassword = (password, salt, expectedHash) => {
  if (!salt || !expectedHash) return false;
  return constantTimeEquals(hashPassword(password, salt).hash, expectedHash);
};
var createSessionToken = () => `local_${Date.now()}_${randomBytes(18).toString("base64url")}`;
var decorateAccount = (account) => {
  const admin = adminAccountForEmail(account.email);
  return {
    firstName: account.firstName,
    lastName: account.lastName,
    uniqname: account.uniqname,
    email: account.email,
    role: admin?.role || "member",
    adminTitle: admin?.title || "Member",
    adminScopes: admin?.scopes || []
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
var buildDashboardData = (data, role, accountEmail) => {
  const dashboardData = {
    backendStatus: dashboardStatus()
  };
  if (role === "super-admin" || role === "exec") {
    dashboardData.candidates = Object.values(data.candidates);
    dashboardData.interviewerAvailability = Object.values(data.interviewerAvailability);
    dashboardData.memberSignups = memberSignupsFromAccounts(data.accounts);
    dashboardData.adminAccounts = ADMIN_ACCOUNTS;
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
  async readData() {
    if (shouldUseBlobStorage()) {
      try {
        const blob = await get(BLOB_STATE_PATH, { access: "private", useCache: false });
        if (!blob || blob.statusCode !== 200) {
          return this.withPreviewAdmin(emptyData());
        }
        const raw = await new Response(blob.stream).text();
        return this.withPreviewAdmin(JSON.parse(raw));
      } catch {
        return this.withPreviewAdmin(emptyData());
      }
    }
    try {
      const raw = await readFile(this.dataPath, "utf8");
      return this.withPreviewAdmin(JSON.parse(raw));
    } catch {
      return this.withPreviewAdmin(emptyData());
    }
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
    const tempPath = `${this.dataPath}.${process.pid}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}
`);
    await rename(tempPath, this.dataPath);
  }
  withPreviewAdmin(data) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const email = "sbodine@umich.edu";
    const existing = data.accounts[email];
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
    data.sessions[LOCAL_PREVIEW_SESSION_TOKEN] = {
      email,
      expiresAt: sessionExpiresAt()
    };
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
  async dashboardData(sessionToken) {
    const session = await this.restoreSession(sessionToken);
    if (!session) return null;
    const data = await this.readData();
    const role = roleForEmail(session.account.email);
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
