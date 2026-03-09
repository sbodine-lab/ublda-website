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
  var welcomeBody = "Welcome to UBLDA, " + data.firstName + "!";
  welcomeBody += "\n\nYou are officially on the list. We will keep you in the loop on upcoming events, workshops, and ways to get involved.";
  welcomeBody += "\n\nFollow us on Instagram: https://www.instagram.com/ublda_umich/";
  welcomeBody += "\nCheck out events: https://ublda.org/events";
  welcomeBody += "\n\nQuestions? Reach out:";
  welcomeBody += "\nsbodine@umich.edu";
  welcomeBody += "\natchiang@umich.edu";
  welcomeBody += "\ncooperry@umich.edu";
  welcomeBody += "\n\nUndergraduate Business Leaders for Diverse Abilities";
  welcomeBody += "\nUniversity of Michigan, Ross School of Business";

  MailApp.sendEmail(email, welcomeSubject, welcomeBody);

  return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
}
