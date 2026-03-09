function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("General Members");

  var email = data.uniqname + "@umich.edu";

  sheet.appendRow([
    data.firstName,
    data.lastName,
    data.uniqname,
    data.year,
    data.college
  ]);

  var notifySubject = "New UBLDA Member: " + data.firstName + " " + data.lastName;
  var notifyBody = "Name: " + data.firstName + " " + data.lastName;
  notifyBody += "\nUniqname: " + data.uniqname;
  notifyBody += "\nEmail: " + email;
  notifyBody += "\nYear: " + data.year;
  notifyBody += "\nCollege: " + data.college;

  MailApp.sendEmail("sbodine@umich.edu", notifySubject, notifyBody);

  var welcomeSubject = "Welcome to UBLDA!";
  var welcomeBody = "Hey " + data.firstName + "!";
  welcomeBody += "\n\nI'm Sam, one of the co-presidents of UBLDA. Just wanted to personally say that myself, Alexa, Cooper, and the rest of our e-board are really excited to have you on board.";
  welcomeBody += "\n\nWe'll keep you in the loop on upcoming events, workshops, and ways to get involved. In the meantime, give us a follow and check out what's coming up:";
  welcomeBody += "\n\nInstagram: https://www.instagram.com/michiganublda/";
  welcomeBody += "\nLinkedIn: https://www.linkedin.com/company/ublda/";
  welcomeBody += "\nEvents: https://ublda.org/events";
  welcomeBody += "\n\nIf you ever have questions or just want to chat, don't hesitate to reach out to any of us:";
  welcomeBody += "\nsbodine@umich.edu";
  welcomeBody += "\natchiang@umich.edu";
  welcomeBody += "\ncooperry@umich.edu";
  welcomeBody += "\n\nSee you around!";
  welcomeBody += "\nSam Bodine";
  welcomeBody += "\nCo-President, UBLDA";
  welcomeBody += "\nUniversity of Michigan, Ross School of Business";

  MailApp.sendEmail(email, welcomeSubject, welcomeBody);

  return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
}
