var OWNER_EMAIL = "sbodine@umich.edu";
var GENERAL_MEMBERS_SHEET_NAME = "General Members";
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
    if (safeString_(data.formType) !== "generalMember") {
      return jsonResponse_({ success: false, error: "Unsupported form type." });
    }
    return handleGeneralMember(data);
  } catch (error) {
    MailApp.sendEmail(OWNER_EMAIL, "UBLDA membership form error", String(error && error.stack ? error.stack : error));
    return jsonResponse_({ success: false, error: "Could not process submission." });
  }
}

function setUbldaSpreadsheetIdFromActiveSheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("Open the target spreadsheet before running this setup function.");
  }
  PropertiesService.getScriptProperties().setProperty("UBLDA_SPREADSHEET_ID", active.getId());
}

function setupGeneralMembersSheet() {
  ensureSheet_(GENERAL_MEMBERS_SHEET_NAME, GENERAL_MEMBER_HEADERS);
}

function handleGeneralMember(data) {
  var sheet = ensureSheet_(GENERAL_MEMBERS_SHEET_NAME, GENERAL_MEMBER_HEADERS);
  var uniqname = normalizeUniqname_(data.uniqname || data.email);
  var email = uniqname + "@umich.edu";
  var firstName = safeString_(data.firstName);
  var lastName = safeString_(data.lastName);
  var year = safeString_(data.year);
  var college = safeString_(data.college);

  if (!firstName || !lastName || !uniqname) {
    return jsonResponse_({ success: false, error: "Missing required fields." });
  }

  sheet.appendRow([firstName, lastName, uniqname, year, college]);

  var notifySubject = "New UBLDA Member: " + firstName + " " + lastName;
  var notifyBody = "Name: " + firstName + " " + lastName;
  notifyBody += "\nUniqname: " + uniqname;
  notifyBody += "\nEmail: " + email;
  notifyBody += "\nYear: " + year;
  notifyBody += "\nCollege: " + college;
  MailApp.sendEmail(OWNER_EMAIL, notifySubject, notifyBody);

  var welcomeBody = "Hey " + firstName + "!";
  welcomeBody += "\n\nI'm Sam, one of the co-presidents of UBLDA. Alexa, Cooper, the rest of our e-board, and I are excited to have you on board.";
  welcomeBody += "\n\nWe'll keep you in the loop on upcoming events, workshops, and ways to get involved.";
  welcomeBody += "\n\nInstagram: https://www.instagram.com/michiganublda/";
  welcomeBody += "\nLinkedIn: https://www.linkedin.com/company/ublda/";
  welcomeBody += "\nEvents: https://ublda.org/events";
  welcomeBody += "\n\nQuestions? Reach us at sbodine@umich.edu, atchiang@umich.edu, or cooperry@umich.edu.";
  welcomeBody += "\n\nSee you around!\nSam Bodine\nCo-President, UBLDA";
  MailApp.sendEmail(email, "Welcome to UBLDA!", welcomeBody);

  return jsonResponse_({ success: true });
}

function ensureSheet_(name, headers) {
  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  var currentHeaders = headerRange.getValues()[0];
  var needsHeaders = headers.some(function(header, index) {
    return currentHeaders[index] !== header;
  });

  if (needsHeaders) headerRange.setValues([headers]);
  sheet.setFrozenRows(1);
  headerRange.setFontWeight("bold").setFontColor("#FFFFFF").setBackground("#0F2B3C").setWrap(true);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), headers.length).createFilter();
  }
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function getSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty("UBLDA_SPREADSHEET_ID");
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("No active spreadsheet found. Set UBLDA_SPREADSHEET_ID in script properties.");
  return active;
}

function normalizeUniqname_(value) {
  return safeString_(value).toLowerCase().replace(/@umich\.edu$/i, "").replace(/@.*$/, "").replace(/[^a-z0-9._-]/g, "");
}

function safeString_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
