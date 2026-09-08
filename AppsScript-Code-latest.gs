// Paste this into Extensions > Apps Script (bound to your wedding Sheet),
// then Deploy > New deployment > type "Web app" > Execute as "Me" >
// Who has access: "Anyone" > Deploy, and copy the Web App URL it gives you.

var ADMIN_PASSCODE = 'partyon2026'; // change this to something only you two know

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVPs');
  sheet.appendRow([
    new Date(),
    data.guestName || '',
    data.isWeddingParty || false,
    data.status || '',
    data.mealSelf || '',
    data.dietarySelf || '',
    data.plusOneName || '',
    data.mealPlusOne || '',
    data.songRequest || '',
    data.note || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'guests') {
    return jsonOut({ guests: getGuestRows() });
  }

  if (action === 'myrsvp') {
    var name = (e.parameter.name || '').trim().toLowerCase();
    var rows = getRsvpRows();
    var match = rows.find(function (r) {
      return String(r.guestName || '').trim().toLowerCase() === name;
    });
    return jsonOut({ row: match || null });
  }

  if (action === 'rsvps') {
    if (e.parameter.passcode !== ADMIN_PASSCODE) {
      return jsonOut({ error: 'unauthorized' });
    }
    return jsonOut({ rows: getRsvpRows() });
  }

  return jsonOut({ error: 'unknown action' });
}

// Reads columns by POSITION, not by header text — row 1 in the Guests tab
// can say anything (or nothing). Order: name, isWeddingParty, plusOneAllowed,
// invitedEvents (semicolon-separated, e.g. "ceremony;reception")
function getGuestRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guests');
  var values = sheet.getDataRange().getValues();
  return values.slice(1) // skip row 1 (the header/label row, whatever it says)
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      return {
        name: row[0],
        isWeddingParty: String(row[1]).toUpperCase() === 'TRUE',
        plusOneAllowed: String(row[2]).toUpperCase() === 'TRUE',
        invitedEvents: row[3] ? String(row[3]).split(';').map(function (s) { return s.trim(); }) : []
      };
    });
}

// Reads columns by POSITION, not by header text — so row 1 in the sheet
// can say anything you want (or nothing at all). Order is what matters:
// A:Timestamp  B:Name  C:WeddingParty  D:Status  E:Meal  F:Dietary
// G:PlusOneName  H:PlusOneMeal  I:SongRequest  J:Note
function getRsvpRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVPs');
  var values = sheet.getDataRange().getValues();
  var keys = ['timestamp', 'guestName', 'isWeddingParty', 'status', 'mealSelf',
              'dietarySelf', 'plusOneName', 'mealPlusOne', 'songRequest', 'note'];
  return values.slice(1) // skip row 1 (the header/label row, whatever it says)
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      keys.forEach(function (k, i) { obj[k] = row[i]; });
      return obj;
    });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
