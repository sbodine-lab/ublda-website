var OWNER_EMAIL = "sbodine@umich.edu";
var APPLICATION_SHEET_NAME = "Leadership Interest";
var APPLICANT_ACCOUNTS_SHEET_NAME = "Applicant Accounts";
var INTERVIEWER_AVAILABILITY_SHEET_NAME = "Interviewer Availability";
var GENERAL_MEMBERS_SHEET_NAME = "General Members";
var RESUME_FOLDER_PROPERTY = "UBLDA_RESUME_FOLDER_ID";

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
  "Submission Count",
  "Password Salt",
  "Password Hash",
  "Password Updated At",
  "Password Version",
  "Email Verified At"
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
    var formType = safeString_(data.formType);

    if (formType === "leadershipInterest" || formType === "eboardApplication") {
      return handleLeadershipInterest(data);
    }

    if (formType === "applicantAccount") {
      return handleApplicantAccount(data);
    }

    if (formType === "interviewerAvailability" || isInterviewerAvailabilityPayload_(data)) {
      return handleInterviewerAvailability(data);
    }

    if (formType === "interviewAssignment") {
      return handleInterviewAssignment(data);
    }

    if (formType === "generalMember") {
      return handleGeneralMember(data);
    }

    return jsonResponse_({ success: false, error: "Unsupported form type." });
  } catch (error) {
    MailApp.sendEmail(OWNER_EMAIL, "UBLDA form error", String(error && error.stack ? error.stack : error));
    return jsonResponse_({ success: false, error: "Could not process submission" });
  }
}

function isInterviewerAvailabilityPayload_(data) {
  return !safeString_(data.formType) && (
    Array.isArray(data.availability) ||
    Array.isArray(data.interviewAvailability) ||
    safeString_(data.maxInterviews)
  );
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
  return jsonResponse_({
    success: false,
    error: "Legacy recruiting administration is retired. Use the leadership workspace."
  });
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
  return jsonResponse_({
    success: false,
    error: "Applicant account authentication is retired. Public application and interview booking remain available."
  });
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

function dashboardMemberSignups_() {
  var members = [];
  var accountSheet = ensureSheet_(APPLICANT_ACCOUNTS_SHEET_NAME, APPLICANT_ACCOUNT_HEADERS);
  var accountLastRow = accountSheet.getLastRow();

  if (accountLastRow >= 2) {
    var accountRows = accountSheet.getRange(2, 1, accountLastRow - 1, APPLICANT_ACCOUNT_HEADERS.length).getValues();
    accountRows.forEach(function(row, index) {
      var email = safeString_(row[2]);
      members.push({
        id: email || "account-" + (index + 2),
        name: [safeString_(row[4]), safeString_(row[5])].filter(Boolean).join(" ") || email,
        email: email,
        uniqname: safeString_(row[3]),
        status: safeString_(row[9]) || "Member account",
        source: "Applicant Accounts",
        updatedAt: row[1] instanceof Date ? row[1].toISOString() : safeString_(row[1]),
        detail: "Submissions: " + safeString_(row[11] || 0)
      });
    });
  }

  var generalSheet = ensureSheet_(GENERAL_MEMBERS_SHEET_NAME, GENERAL_MEMBER_HEADERS);
  var generalLastRow = generalSheet.getLastRow();

  if (generalLastRow >= 2) {
    var generalRows = generalSheet.getRange(2, 1, generalLastRow - 1, GENERAL_MEMBER_HEADERS.length).getValues();
    generalRows.forEach(function(row, index) {
      var uniqname = normalizeUniqname_(row[2]);
      var email = uniqname ? uniqname + "@umich.edu" : "";
      members.push({
        id: email || "general-" + (index + 2),
        name: [safeString_(row[0]), safeString_(row[1])].filter(Boolean).join(" ") || email,
        email: email,
        uniqname: uniqname,
        status: "General member",
        source: "General Members",
        updatedAt: "",
        detail: [safeString_(row[3]), safeString_(row[4])].filter(Boolean).join(" · ")
      });
    });
  }

  return members;
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
