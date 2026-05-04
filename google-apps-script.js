var OWNER_EMAIL = "sbodine@umich.edu";
var APPLICATION_SHEET_NAME = "Leadership Interest";
var APPLICANT_ACCOUNTS_SHEET_NAME = "Applicant Accounts";
var INTERVIEWER_AVAILABILITY_SHEET_NAME = "Interviewer Availability";
var GENERAL_MEMBERS_SHEET_NAME = "General Members";
var RESUME_FOLDER_PROPERTY = "UBLDA_RESUME_FOLDER_ID";
var SESSION_TTL_DAYS = 30;

var ADMIN_ACCOUNTS = [
  {
    email: "sbodine@umich.edu",
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

var APPLICATION_HEADERS = [
  "Submitted At",
  "Updated At",
  "Submission Count",
  "Status",
  "First Name",
  "Last Name",
  "Email",
  "Uniqname",
  "Year",
  "Expected Graduation",
  "College / Program",
  "Ross Eligibility",
  "Interest Type",
  "Role Preferences",
  "Candidate Availability",
  "Resume File",
  "Resume URL",
  "Weekly Commitment",
  "Notes",
  "Calendar Event ID",
  "User Agent",
  "Submission ID",
  "Availability Blocks",
  "Assigned Interview Slot",
  "Interviewers",
  "Interview Status",
  "Feedback"
];

var INTERVIEWER_AVAILABILITY_HEADERS = [
  "Submitted At",
  "Updated At",
  "Submission Count",
  "First Name",
  "Last Name",
  "Email",
  "Uniqname",
  "Availability Summary",
  "Availability Blocks",
  "Max Interviews",
  "Notes",
  "User Agent",
  "Submission ID"
];

var APPLICANT_ACCOUNT_HEADERS = [
  "Created At",
  "Updated At",
  "Email",
  "Uniqname",
  "First Name",
  "Last Name",
  "Session Token Hash",
  "Session Expires At",
  "Last Sign In At",
  "Application Status",
  "Last Application Row",
  "Submission Count"
];

var GENERAL_MEMBER_HEADERS = [
  "First Name",
  "Last Name",
  "Uniqname",
  "Year",
  "College / Program"
];

function doPost(e) {
  try {
    var data = JSON.parse((e.postData && e.postData.contents) || "{}");

    if (data.formType === "leadershipInterest" || data.formType === "eboardApplication") {
      return handleLeadershipInterest(data);
    }

    if (data.formType === "applicantAccount") {
      return handleApplicantAccount(data);
    }

    if (data.formType === "interviewerAvailability") {
      return handleInterviewerAvailability(data);
    }

    if (data.formType === "interviewAssignment") {
      return handleInterviewAssignment(data);
    }

    return handleGeneralMember(data);
  } catch (error) {
    MailApp.sendEmail(OWNER_EMAIL, "UBLDA form error", String(error && error.stack ? error.stack : error));
    return jsonResponse_({ success: false, error: "Could not process submission" });
  }
}

function setupLeadershipInterestSheet() {
  ensureSheet_(APPLICATION_SHEET_NAME, APPLICATION_HEADERS);
  ensureSheet_(APPLICANT_ACCOUNTS_SHEET_NAME, APPLICANT_ACCOUNT_HEADERS);
  ensureSheet_(INTERVIEWER_AVAILABILITY_SHEET_NAME, INTERVIEWER_AVAILABILITY_HEADERS);
}

function setUbldaSpreadsheetIdFromActiveSheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("Open the target spreadsheet before running this setup function.");
  }

  PropertiesService.getScriptProperties().setProperty("UBLDA_SPREADSHEET_ID", active.getId());
}

function handleGeneralMember(data) {
  var sheet = ensureSheet_(GENERAL_MEMBERS_SHEET_NAME, GENERAL_MEMBER_HEADERS);
  var uniqname = normalizeUniqname_(data.uniqname || data.email);
  var email = uniqname + "@umich.edu";

  sheet.appendRow([
    safeString_(data.firstName),
    safeString_(data.lastName),
    uniqname,
    safeString_(data.year),
    safeString_(data.college)
  ]);

  var notifySubject = "New UBLDA Member: " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  var notifyBody = "Name: " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  notifyBody += "\nUniqname: " + uniqname;
  notifyBody += "\nEmail: " + email;
  notifyBody += "\nYear: " + safeString_(data.year);
  notifyBody += "\nCollege: " + safeString_(data.college);

  MailApp.sendEmail(OWNER_EMAIL, notifySubject, notifyBody);

  var welcomeSubject = "Welcome to UBLDA!";
  var welcomeBody = "Hey " + safeString_(data.firstName) + "!";
  welcomeBody += "\n\nI'm Sam, one of the co-presidents of UBLDA. Just wanted to personally say that myself, Alexa, Cooper, and the rest of our e-board are really excited to have you on board.";
  welcomeBody += "\n\nWe'll keep you in the loop on upcoming events, workshops, and ways to get involved. In the meantime, give us a follow and check out what's coming up:";
  welcomeBody += "\n\nInstagram: https://www.instagram.com/michiganublda/";
  welcomeBody += "\nLinkedIn: https://www.linkedin.com/company/ublda/";
  welcomeBody += "\nEvents: https://ublda.org/events";
  welcomeBody += "\n\nIf you ever have questions or just want to chat, don't hesitate to reach out to any of us:";
  welcomeBody += "\n" + OWNER_EMAIL;
  welcomeBody += "\natchiang@umich.edu";
  welcomeBody += "\ncooperry@umich.edu";
  welcomeBody += "\n\nSee you around!";
  welcomeBody += "\nSam Bodine";
  welcomeBody += "\nCo-President, UBLDA";
  welcomeBody += "\nUniversity of Michigan, Ross School of Business";

  MailApp.sendEmail(email, welcomeSubject, welcomeBody);

  return jsonResponse_({ success: true });
}

function handleLeadershipInterest(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ensureSheet_(APPLICATION_SHEET_NAME, APPLICATION_HEADERS);
    var email = canonicalEmail_(data.email || data.uniqname);
    var uniqname = normalizeUniqname_(email);
    var existingRow = findRowByEmail_(sheet, email);
    var existingValues = existingRow ? sheet.getRange(existingRow, 1, 1, APPLICATION_HEADERS.length).getValues()[0] : [];
    var firstSubmittedAt = existingValues[0] || parseDate_(data.submittedAt) || new Date();
    var submissionCount = Number(existingValues[2] || 0) + 1;
    var resumeFile = saveResumeFile_(data, email, uniqname);
    var calendarEventId = safeString_(existingValues[19]);
    var row = buildApplicationRow_(data, email, uniqname, firstSubmittedAt, submissionCount, resumeFile, calendarEventId);

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      existingRow = sheet.getLastRow();
    }

    syncApplicantAccountFromSubmission_(data, email, uniqname, existingRow, row[3], submissionCount);
    sendLeadershipNotification_(data, email, existingRow, submissionCount, resumeFile, calendarEventId);
    sendLeadershipReceipt_(data, email, calendarEventId);

    return jsonResponse_({
      success: true,
      status: row[3],
      row: existingRow,
      calendarEventCreated: Boolean(calendarEventId),
      updatedExistingSubmission: submissionCount > 1
    });
  } finally {
    lock.releaseLock();
  }
}

function buildApplicationRow_(data, email, uniqname, firstSubmittedAt, submissionCount, resumeFile, calendarEventId) {
  var status = safeString_(data.status) || deriveStatus_(data.rossStatus);
  var rolePreferences = safeJoin_(data.rolePreferences || data.preferredRoles || data.preferredRole);
  var availability = safeString_(data.availabilitySummary) || summarizeSlots_(data.availability);
  var availabilityBlocks = serializeSlots_(data.availability);
  var notes = safeString_(data.notes || data.accommodations || data.conflictDisclosure);

  return [
    firstSubmittedAt,
    new Date(),
    submissionCount,
    status,
    safeString_(data.firstName),
    safeString_(data.lastName),
    email,
    uniqname,
    safeString_(data.year),
    safeString_(data.expectedGraduation),
    safeString_(data.college),
    prettyRossStatus_(data.rossStatus),
    prettyInterestType_(data.interestType),
    rolePreferences,
    availability,
    safeString_(resumeFile && resumeFile.name),
    safeString_(resumeFile && resumeFile.url),
    safeString_(data.weeklyCommitment),
    notes,
    safeString_(calendarEventId),
    safeString_(data.userAgent),
    safeString_(data.submissionId),
    availabilityBlocks,
    safeString_(data.assignedSlot || data.assignedInterviewSlot),
    safeJoin_(data.interviewers),
    safeString_(data.interviewStatus || "Needs match"),
    safeString_(data.feedback)
  ];
}

function sendLeadershipNotification_(data, email, rowNumber, submissionCount, resumeFile, calendarEventId) {
  var subjectPrefix = submissionCount > 1 ? "Updated" : "New";
  var notifySubject = subjectPrefix + " UBLDA Leadership Interest: " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  var notifyBody = "Name: " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  notifyBody += "\nEmail: " + email;
  notifyBody += "\nStatus: " + (safeString_(data.status) || deriveStatus_(data.rossStatus));
  notifyBody += "\nRoss eligibility: " + prettyRossStatus_(data.rossStatus);
  notifyBody += "\nInterest type: " + prettyInterestType_(data.interestType);
  notifyBody += "\nRole preferences: " + safeJoin_(data.rolePreferences || data.preferredRoles || data.preferredRole);
  notifyBody += "\nCandidate availability: " + (safeString_(data.availabilitySummary) || summarizeSlots_(data.availability));
  notifyBody += "\nResume: " + (resumeFile && resumeFile.url ? resumeFile.url : "Not provided");
  notifyBody += "\nCalendar event: " + (calendarEventId || "Not created yet");
  notifyBody += "\nWeekly commitment: " + safeString_(data.weeklyCommitment);
  notifyBody += "\nSpreadsheet row: " + rowNumber;
  notifyBody += "\nSubmission count: " + submissionCount;
  notifyBody += "\n\nNotes:\n" + (safeString_(data.notes || data.accommodations || data.conflictDisclosure) || "None provided");

  MailApp.sendEmail(OWNER_EMAIL, notifySubject, notifyBody);
}

function sendLeadershipReceipt_(data, email, calendarEventId) {
  var status = safeString_(data.status) || deriveStatus_(data.rossStatus);
  var receiptSubject = "UBLDA leadership interest received";
  var receiptBody = "Hey " + safeString_(data.firstName) + ",";
  receiptBody += "\n\nThanks for sharing your interest in helping build UBLDA. We received your resume, role rankings, and interview availability.";
  receiptBody += "\n\nA quick policy note: current e-board openings are Ross/BBA-focused so UBLDA can maintain Ross club recognition requirements. If you are not currently a Ross/BBA student, we will keep your interest on file for future project, committee, and leadership opportunities as they come up.";

  if (status === "Interview eligible" && calendarEventId) {
    receiptBody += "\n\nYour Google Calendar invite should arrive once the e-board confirms the assigned interview slot.";
  } else if (status === "Interview eligible") {
    receiptBody += "\n\nWe saved your availability and will match candidates to interviewers on Wednesday.";
  } else if (status === "Needs review") {
    receiptBody += "\n\nWe saved your availability while we confirm your Ross eligibility and the right next step.";
  } else {
    receiptBody += "\n\nYou are still welcome in UBLDA, and we will reach back out when a future project, committee, or leadership role is a stronger fit.";
  }

  receiptBody += "\n\nBest,";
  receiptBody += "\nSam and the UBLDA E-Board";

  MailApp.sendEmail(email, receiptSubject, receiptBody);
}

function handleInterviewerAvailability(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ensureSheet_(INTERVIEWER_AVAILABILITY_SHEET_NAME, INTERVIEWER_AVAILABILITY_HEADERS);
    var email = canonicalEmail_(data.email || data.uniqname);
    var uniqname = normalizeUniqname_(email);
    var existingRow = findInterviewerRowByEmail_(sheet, email);
    var existingValues = existingRow ? sheet.getRange(existingRow, 1, 1, INTERVIEWER_AVAILABILITY_HEADERS.length).getValues()[0] : [];
    var firstSubmittedAt = existingValues[0] || parseDate_(data.submittedAt) || new Date();
    var submissionCount = Number(existingValues[2] || 0) + 1;
    var row = [
      firstSubmittedAt,
      new Date(),
      submissionCount,
      safeString_(data.firstName),
      safeString_(data.lastName),
      email,
      uniqname,
      safeString_(data.availabilitySummary) || summarizeSlots_(data.availability),
      serializeSlots_(data.availability),
      safeString_(data.maxInterviews || "As needed"),
      safeString_(data.notes),
      safeString_(data.userAgent),
      safeString_(data.submissionId)
    ];

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      existingRow = sheet.getLastRow();
    }

    sendInterviewerAvailabilityNotification_(data, email, existingRow, submissionCount);

    return jsonResponse_({
      success: true,
      row: existingRow,
      updatedExistingSubmission: submissionCount > 1
    });
  } finally {
    lock.releaseLock();
  }
}

function sendInterviewerAvailabilityNotification_(data, email, rowNumber, submissionCount) {
  var subjectPrefix = submissionCount > 1 ? "Updated" : "New";
  var notifySubject = subjectPrefix + " UBLDA Interviewer Availability: " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  var notifyBody = "Name: " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  notifyBody += "\nEmail: " + email;
  notifyBody += "\nAvailability: " + (safeString_(data.availabilitySummary) || summarizeSlots_(data.availability));
  notifyBody += "\nMax interviews: " + safeString_(data.maxInterviews || "As needed");
  notifyBody += "\nSpreadsheet row: " + rowNumber;
  notifyBody += "\nSubmission count: " + submissionCount;
  notifyBody += "\n\nNotes:\n" + (safeString_(data.notes) || "None provided");

  MailApp.sendEmail(OWNER_EMAIL, notifySubject, notifyBody);
}

function handleInterviewAssignment(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var adminSession = authorizeDashboardSession_(data.sessionToken, ["super-admin", "exec"]);
    if (!adminSession.authorized) {
      return jsonResponse_({ success: false, error: adminSession.error || "Admin access is required." });
    }

    var sheet = ensureSheet_(APPLICATION_SHEET_NAME, APPLICATION_HEADERS);
    var email = canonicalEmail_(data.email || data.uniqname);
    var rowNumber = findRowByEmail_(sheet, email);

    if (!rowNumber) {
      return jsonResponse_({ success: false, error: "Candidate application was not found." });
    }

    var assignedSlot = assignmentSlotValue_(data.assignedSlot);
    var assignedSlotLabel = assignmentSlotLabel_(data.assignedSlot) || assignedSlot;
    var interviewers = safeJoin_(data.interviewers);
    var interviewStatus = safeString_(data.interviewStatus || data.status || "Needs match");
    var feedback = safeString_(data.feedback);

    sheet.getRange(rowNumber, 24, 1, 4).setValues([[
      assignedSlot,
      interviewers,
      interviewStatus,
      feedback
    ]]);

    sendInterviewAssignmentNotification_(data, email, rowNumber, assignedSlotLabel, interviewers, interviewStatus, adminSession.account);

    return jsonResponse_({
      success: true,
      row: rowNumber,
      calendarEventCreated: false
    });
  } finally {
    lock.releaseLock();
  }
}

function sendInterviewAssignmentNotification_(data, email, rowNumber, assignedSlot, interviewers, interviewStatus, adminAccount) {
  var notifySubject = "UBLDA interview assignment updated: " + email;
  var notifyBody = "Candidate: " + email;
  notifyBody += "\nUpdated by: " + safeString_(adminAccount && adminAccount.email);
  notifyBody += "\nAssigned slot: " + (assignedSlot || "Unassigned");
  notifyBody += "\nInterviewers: " + (interviewers || "Unassigned");
  notifyBody += "\nStatus: " + interviewStatus;
  notifyBody += "\nSpreadsheet row: " + rowNumber;
  notifyBody += "\n\nFeedback:\n" + (safeString_(data.feedback) || "None recorded");

  MailApp.sendEmail(OWNER_EMAIL, notifySubject, notifyBody);
}

function handleApplicantAccount(data) {
  var action = safeString_(data.action);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ensureSheet_(APPLICANT_ACCOUNTS_SHEET_NAME, APPLICANT_ACCOUNT_HEADERS);

    if (action === "session") {
      return handleApplicantSession_(sheet, data);
    }

    if (action === "dashboardData") {
      return handleDashboardData_(sheet, data);
    }

    var account = data.account || data;
    var email = canonicalEmail_(account.email || account.uniqname || data.email || data.uniqname);
    var uniqname = normalizeUniqname_(email);
    var existingRow = findAccountRowByEmail_(sheet, email);

    if (action === "requestMagicLink") {
      if (!existingRow) {
        return jsonResponse_({ success: false, error: "No applicant account found for that uniqname yet. Create an account first." });
      }

      var linkToken = createSessionToken_();
      var linkHash = hashToken_(linkToken);
      var linkExpiresAt = sessionExpiresAt_();
      sheet.getRange(existingRow, 7, 1, 3).setValues([[linkHash, linkExpiresAt, new Date()]]);
      sendApplicantPortalLink_(email, linkToken, safeString_(data.origin));
      return jsonResponse_({ success: true, magicLinkSent: true });
    }

    if (action !== "create" && action !== "googleSignIn") {
      return jsonResponse_({ success: false, error: "Applicant account action is invalid." });
    }

    var now = new Date();
    var token = createSessionToken_();
    var tokenHash = hashToken_(token);
    var expiresAt = sessionExpiresAt_();
    var application = applicationSummaryForEmail_(email);
    var existingValues = existingRow ? sheet.getRange(existingRow, 1, 1, APPLICANT_ACCOUNT_HEADERS.length).getValues()[0] : [];
    var createdAt = existingValues[0] || now;
    var row = [
      createdAt,
      now,
      email,
      uniqname,
      safeString_(account.firstName),
      safeString_(account.lastName),
      tokenHash,
      expiresAt,
      now,
      application ? application.status : "",
      application ? application.row : "",
      application ? application.submissionCount : ""
    ];

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    if (action === "create") {
      sendApplicantPortalLink_(email, token, safeString_(data.origin));
    }

    return jsonResponse_({
      success: true,
      sessionToken: token,
      account: accountResponse_(row),
      application: application ? application.response : null
    });
  } finally {
    lock.releaseLock();
  }
}

function handleApplicantSession_(sheet, data) {
  var session = sessionForToken_(sheet, data.sessionToken);

  if (!session.found) {
    return jsonResponse_({ success: false, error: session.error || "Applicant session not found." });
  }

  var values = session.values;
  var application = applicationSummaryForEmail_(safeString_(values[2]));
  sheet.getRange(session.rowNumber, 9).setValue(new Date());

  if (application) {
    sheet.getRange(session.rowNumber, 10, 1, 3).setValues([[application.status, application.row, application.submissionCount]]);
  }

  return jsonResponse_({
    success: true,
    account: accountResponse_(values),
    application: application ? application.response : null
  });
}

function handleDashboardData_(sheet, data) {
  var session = authorizeDashboardSession_(data.sessionToken, ["super-admin", "exec", "member"]);
  if (!session.authorized) {
    return jsonResponse_({ success: false, error: session.error || "A valid member session is required." });
  }

  var role = session.account.role;
  var payload = {
    backendStatus: {
      source: "sheets",
      message: "Loaded from Google Sheets through the signed-in account backend.",
      updatedAt: new Date().toISOString()
    }
  };

  if (role === "super-admin" || role === "exec") {
    payload.candidates = dashboardCandidates_();
    payload.interviewerAvailability = dashboardInterviewerAvailability_();
    payload.adminAccounts = ADMIN_ACCOUNTS;
  }

  return jsonResponse_({
    success: true,
    account: session.account,
    role: role,
    dashboardData: payload
  });
}

function sessionForToken_(sheet, sessionToken) {
  var tokenHash = hashToken_(safeString_(sessionToken));
  var lastRow = sheet.getLastRow();

  if (!tokenHash || lastRow < 2) {
    return { found: false, error: "Applicant session not found." };
  }

  var matches = sheet
    .getRange(2, 7, lastRow - 1, 1)
    .createTextFinder(tokenHash)
    .matchCase(true)
    .matchEntireCell(true)
    .findNext();

  if (!matches) {
    return { found: false, error: "Applicant session not found." };
  }

  var rowNumber = matches.getRow();
  var values = sheet.getRange(rowNumber, 1, 1, APPLICANT_ACCOUNT_HEADERS.length).getValues()[0];
  var expiresAt = parseDate_(values[7]);

  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    return { found: false, error: "Applicant session expired." };
  }

  return {
    found: true,
    rowNumber: rowNumber,
    values: values,
    account: accountResponse_(values)
  };
}

function authorizeDashboardSession_(sessionToken, allowedRoles) {
  var sheet = ensureSheet_(APPLICANT_ACCOUNTS_SHEET_NAME, APPLICANT_ACCOUNT_HEADERS);
  var session = sessionForToken_(sheet, sessionToken);

  if (!session.found) {
    return { authorized: false, error: session.error || "Applicant session not found." };
  }

  var role = session.account.role || "member";
  var allowed = !allowedRoles || allowedRoles.indexOf(role) !== -1;

  if (!allowed) {
    return { authorized: false, error: "Admin access is required." };
  }

  sheet.getRange(session.rowNumber, 9).setValue(new Date());

  return {
    authorized: true,
    account: session.account,
    rowNumber: session.rowNumber,
    values: session.values
  };
}

function syncApplicantAccountFromSubmission_(data, email, uniqname, applicationRow, status, submissionCount) {
  var sheet = ensureSheet_(APPLICANT_ACCOUNTS_SHEET_NAME, APPLICANT_ACCOUNT_HEADERS);
  var existingRow = findAccountRowByEmail_(sheet, email);
  var now = new Date();

  if (existingRow) {
    var current = sheet.getRange(existingRow, 1, 1, APPLICANT_ACCOUNT_HEADERS.length).getValues()[0];
    sheet.getRange(existingRow, 2, 1, 11).setValues([[
      now,
      email,
      uniqname,
      safeString_(data.firstName) || current[4],
      safeString_(data.lastName) || current[5],
      current[6],
      current[7],
      current[8],
      status,
      applicationRow,
      submissionCount
    ]]);
    return;
  }

  sheet.appendRow([
    now,
    now,
    email,
    uniqname,
    safeString_(data.firstName),
    safeString_(data.lastName),
    "",
    "",
    "",
    status,
    applicationRow,
    submissionCount
  ]);
}

function saveResumeFile_(data, email, uniqname) {
  var resume = data.resumeFile || {};
  var contentBase64 = safeString_(resume.contentBase64);

  if (!contentBase64) {
    throw new Error("Resume file missing from submission.");
  }

  var folder = getResumeFolder_();
  var fileName = uniqname + "-" + safeString_(data.submissionId || Date.now()) + "-" + sanitizeFileName_(resume.name || "resume");
  var bytes = Utilities.base64Decode(contentBase64);
  var blob = Utilities.newBlob(bytes, safeString_(resume.mimeType) || "application/octet-stream", fileName);
  var file = folder.createFile(blob).setName(fileName);

  return {
    name: file.getName(),
    url: file.getUrl(),
    email: email
  };
}

function maybeUpsertInterviewEvent_(data, email, existingEventId, resumeFile) {
  var status = safeString_(data.status) || deriveStatus_(data.rossStatus);
  var slot = data.interviewSlot || {};
  var start = parseDate_(slot.start);
  var end = parseDate_(slot.end);

  if (status === "Future role pool" || !start || !end) {
    return "";
  }

  var calendar = CalendarApp.getDefaultCalendar();
  var allowedEventId = safeString_(existingEventId);
  var existingEvent = null;

  if (allowedEventId) {
    try {
      existingEvent = calendar.getEventById(allowedEventId);
      allowedEventId = existingEvent ? existingEvent.getId() : "";
    } catch (error) {
      existingEvent = null;
      allowedEventId = "";
    }
  }

  if (hasSlotConflict_(calendar, start, end, allowedEventId)) {
    throw new Error("Selected interview slot is no longer available. Please choose another time.");
  }

  var title = "UBLDA Leadership Interview - " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  var description = "UBLDA leadership interview signup";
  description += "\nName: " + safeString_(data.firstName) + " " + safeString_(data.lastName);
  description += "\nEmail: " + email;
  description += "\nRoss eligibility: " + prettyRossStatus_(data.rossStatus);
  description += "\nPreferred lane: " + safeString_(data.preferredRole);
  description += "\nResume: " + (resumeFile && resumeFile.url ? resumeFile.url : "");
  description += "\nNotes: " + safeString_(data.notes || data.accommodations || data.conflictDisclosure);

  if (existingEvent) {
    existingEvent.setTitle(title);
    existingEvent.setTime(start, end);
    existingEvent.setDescription(description);
    existingEvent.addGuest(email);
    return existingEvent.getId();
  }

  return calendar.createEvent(title, start, end, {
    description: description,
    guests: email,
    sendInvites: true
  }).getId();
}

function dashboardCandidates_() {
  var sheet = ensureSheet_(APPLICATION_SHEET_NAME, APPLICATION_HEADERS);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, APPLICATION_HEADERS.length).getValues();

  return rows.map(function(row, index) {
    var email = safeString_(row[6]);
    var interviewStatus = safeString_(row[25]) || statusForDashboard_(safeString_(row[3]));

    return {
      id: normalizeUniqname_(email) || "candidate-" + (index + 2),
      name: [safeString_(row[4]), safeString_(row[5])].filter(Boolean).join(" ") || email,
      program: [safeString_(row[10]), safeString_(row[9])].filter(Boolean).join(" · "),
      email: email,
      rolePreferences: splitList_(row[13]),
      status: interviewStatus,
      availability: splitList_(row[22]),
      resumeUrl: safeString_(row[16]),
      assignedSlot: slotValueFromAssignment_(row[23]),
      interviewers: splitList_(row[24]),
      feedback: safeString_(row[26])
    };
  });
}

function dashboardInterviewerAvailability_() {
  var sheet = ensureSheet_(INTERVIEWER_AVAILABILITY_SHEET_NAME, INTERVIEWER_AVAILABILITY_HEADERS);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, INTERVIEWER_AVAILABILITY_HEADERS.length).getValues();

  return rows.map(function(row) {
    var name = [safeString_(row[3]), safeString_(row[4])].filter(Boolean).join(" ") || safeString_(row[5]);
    var admin = adminAccountForEmail_(row[5]);

    return {
      name: name,
      role: admin ? admin.title : "E-board",
      availability: splitList_(row[8]),
      maxInterviews: safeString_(row[9]) || "As needed"
    };
  });
}

function splitList_(value) {
  return safeString_(value).split(/\s*;\s*/).map(function(item) {
    return safeString_(item);
  }).filter(Boolean);
}

function statusForDashboard_(value) {
  if (value === "Interview eligible" || value === "Needs review") return "Needs match";
  if (value === "Future role pool") return "Hold";
  return value || "Needs match";
}

function slotValueFromAssignment_(value) {
  var text = safeString_(value);
  if (!text) return "";
  if (text.indexOf(" | ") !== -1) return safeString_(text.split(" | ")[0]);
  if (text.indexOf("2026-") === 0) return text;
  return text;
}

function assignmentSlotValue_(slot) {
  if (slot && typeof slot === "object") {
    var value = safeString_(slot.value || slot.start);
    var label = safeString_(slot.label);
    return label && value ? value + " | " + label : value || label;
  }

  return safeString_(slot);
}

function assignmentSlotLabel_(slot) {
  if (slot && typeof slot === "object") {
    return safeString_(slot.label || slot.value || slot.start);
  }

  return safeString_(slot);
}

function hasSlotConflict_(calendar, start, end, allowedEventId) {
  var events = calendar.getEvents(start, end);

  for (var i = 0; i < events.length; i += 1) {
    if (!allowedEventId || events[i].getId() !== allowedEventId) {
      return true;
    }
  }

  return false;
}

function ensureSheet_(name, headers) {
  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  var currentHeaders = headerRange.getValues()[0];
  var needsHeaders = false;

  for (var i = 0; i < headers.length; i += 1) {
    if (currentHeaders[i] !== headers[i]) {
      needsHeaders = true;
      break;
    }
  }

  if (needsHeaders) {
    headerRange.setValues([headers]);
  }

  sheet.setFrozenRows(1);
  headerRange
    .setFontWeight("bold")
    .setFontColor("#FFFFFF")
    .setBackground("#0F2B3C")
    .setWrap(true);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), headers.length).createFilter();
  }
  sheet.autoResizeColumns(1, headers.length);

  return sheet;
}

function getSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty("UBLDA_SPREADSHEET_ID");

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("No active spreadsheet found. Set UBLDA_SPREADSHEET_ID in script properties.");
  }

  return active;
}

function findRowByEmail_(sheet, email) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  var matches = sheet
    .getRange(2, 7, lastRow - 1, 1)
    .createTextFinder(email)
    .matchCase(false)
    .matchEntireCell(true)
    .findNext();

  return matches ? matches.getRow() : 0;
}

function findAccountRowByEmail_(sheet, email) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  var matches = sheet
    .getRange(2, 3, lastRow - 1, 1)
    .createTextFinder(email)
    .matchCase(false)
    .matchEntireCell(true)
    .findNext();

  return matches ? matches.getRow() : 0;
}

function findInterviewerRowByEmail_(sheet, email) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  var matches = sheet
    .getRange(2, 6, lastRow - 1, 1)
    .createTextFinder(email)
    .matchCase(false)
    .matchEntireCell(true)
    .findNext();

  return matches ? matches.getRow() : 0;
}

function applicationSummaryForEmail_(email) {
  var sheet = ensureSheet_(APPLICATION_SHEET_NAME, APPLICATION_HEADERS);
  var row = findRowByEmail_(sheet, email);

  if (!row) {
    return null;
  }

  var values = sheet.getRange(row, 1, 1, APPLICATION_HEADERS.length).getValues()[0];
  var response = {
    status: safeString_(values[3]),
    interviewSlot: safeString_(values[23]) || safeString_(values[14]),
    resumeUrl: safeString_(values[16]),
    updatedAt: values[1] instanceof Date ? values[1].toISOString() : safeString_(values[1]),
    submissionCount: Number(values[2] || 0)
  };

  return {
    row: row,
    status: response.status,
    submissionCount: response.submissionCount,
    response: response
  };
}

function getResumeFolder_() {
  var properties = PropertiesService.getScriptProperties();
  var folderId = properties.getProperty(RESUME_FOLDER_PROPERTY);

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      properties.deleteProperty(RESUME_FOLDER_PROPERTY);
    }
  }

  var spreadsheetFile = DriveApp.getFileById(getSpreadsheet_().getId());
  var parents = spreadsheetFile.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var folder = parent.createFolder("UBLDA Leadership Resumes");
  properties.setProperty(RESUME_FOLDER_PROPERTY, folder.getId());

  return folder;
}

function sanitizeFileName_(value) {
  return safeString_(value)
    .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "resume";
}

function createSessionToken_() {
  return Utilities.getUuid() + "-" + Utilities.getUuid();
}

function hashToken_(token) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  var output = "";

  for (var i = 0; i < digest.length; i += 1) {
    var value = digest[i];
    if (value < 0) value += 256;
    output += ("0" + value.toString(16)).slice(-2);
  }

  return output;
}

function sessionExpiresAt_() {
  var date = new Date();
  date.setDate(date.getDate() + SESSION_TTL_DAYS);
  return date;
}

function accountResponse_(values) {
  var email = safeString_(values[2]);
  var admin = adminAccountForEmail_(email);

  return {
    email: email,
    uniqname: safeString_(values[3]),
    firstName: safeString_(values[4]),
    lastName: safeString_(values[5]),
    role: admin ? admin.role : "member",
    adminTitle: admin ? admin.title : "Member",
    adminScopes: admin ? admin.scopes : []
  };
}

function sendApplicantPortalLink_(email, token, origin) {
  var baseUrl = origin || "https://ublda.org";
  var link = baseUrl.replace(/\/$/, "") + "/portal?session=" + encodeURIComponent(token);
  var subject = "Your UBLDA applicant portal";
  var body = "Hey,";
  body += "\n\nYour UBLDA applicant portal is ready. Use this secure link to get back to your resume drop, interview slot, and future UBLDA resources:";
  body += "\n\n" + link;
  body += "\n\nThis link expires in " + SESSION_TTL_DAYS + " days.";
  body += "\n\nBest,";
  body += "\nSam and the UBLDA E-Board";

  MailApp.sendEmail(email, subject, body);
}

function canonicalEmail_(value) {
  return normalizeUniqname_(value) + "@umich.edu";
}

function normalizeUniqname_(value) {
  return safeString_(value).toLowerCase().replace(/@.*$/, "");
}

function adminAccountForEmail_(email) {
  var normalized = safeString_(email).toLowerCase();

  for (var i = 0; i < ADMIN_ACCOUNTS.length; i += 1) {
    if (ADMIN_ACCOUNTS[i].email === normalized) {
      return ADMIN_ACCOUNTS[i];
    }
  }

  return null;
}

function safeJoin_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) {
      return safeString_(item);
    }).filter(Boolean).join("; ");
  }

  return safeString_(value);
}

function serializeSlots_(slots) {
  if (!Array.isArray(slots)) {
    return safeString_(slots);
  }

  return slots.map(function(slot) {
    if (slot && typeof slot === "object") {
      return safeString_(slot.value || slot.label || slot.start);
    }

    return safeString_(slot);
  }).filter(Boolean).join("; ");
}

function summarizeSlots_(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return "";
  }

  var counts = {};
  slots.forEach(function(slot) {
    var label = slot && typeof slot === "object" ? safeString_(slot.dayLabel || slot.label).replace(/, .*/, "") : "Selected";
    counts[label || "Selected"] = (counts[label || "Selected"] || 0) + 1;
  });

  return Object.keys(counts).map(function(label) {
    return label + ": " + counts[label] + " slot" + (counts[label] === 1 ? "" : "s");
  }).join("; ");
}

function safeString_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseDate_(value) {
  if (!value) {
    return null;
  }

  var date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function deriveStatus_(rossStatus) {
  if (rossStatus === "ross-bba") {
    return "Interview eligible";
  }

  if (rossStatus === "non-ross") {
    return "Future role pool";
  }

  return "Needs review";
}

function prettyRossStatus_(rossStatus) {
  if (rossStatus === "ross-bba") return "Currently enrolled at Ross/BBA";
  if (rossStatus === "business-minor") return "Business minor / Ross-affiliated";
  if (rossStatus === "non-ross") return "Not currently a Ross student";
  if (rossStatus === "unsure") return "Unsure / needs confirmation";
  return safeString_(rossStatus);
}

function prettyInterestType_(interestType) {
  if (interestType === "leadership-interview") return "Current e-board interview";
  if (interestType === "future-role") return "Future project or committee role";
  if (interestType === "either") return "Either";
  return safeString_(interestType);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
