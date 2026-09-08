// Paste this into Extensions > Apps Script (bound to your wedding Sheet),
// then Deploy > New deployment > type "Web app" > Execute as "Me" >
// Who has access: "Anyone" > Deploy, and copy the Web App URL it gives you.

var ADMIN_PASSCODE = 'partyon2026'; // change this to something only you two know

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVPs');
  var now = new Date();
  var guestCols = [
    data.guestName || '',
    data.isWeddingParty || false,
    data.status || '',
    data.mealSelf || '',
    data.dietarySelf || '',
    data.plusOneName || '',
    data.mealPlusOne || '',
    data.songRequest || '',
    data.note || ''
  ];

  var existingRow = findRsvpRowByName(sheet, data.guestName);
  if (existingRow) {
    // Update in place: keep the original "first submitted" timestamp in
    // column A untouched, overwrite the guest's answers, and bump
    // LastUpdated + Modified so admins can spot a changed RSVP at a glance.
    sheet.getRange(existingRow, 2, 1, guestCols.length).setValues([guestCols]);
    sheet.getRange(existingRow, 11, 1, 2).setValues([[now, true]]);
  } else {
    sheet.appendRow([now].concat(guestCols).concat([now, false]));
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Returns the 1-indexed sheet row for an existing guest's RSVP, or null if
// they haven't submitted one yet. Matches the same way login does —
// case-insensitive, trimmed — since "knowing a name" is the whole access
// model here.
function findRsvpRowByName(sheet, guestName) {
  var name = (guestName || '').trim().toLowerCase();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) { // skip header row
    if (String(values[i][1] || '').trim().toLowerCase() === name) {
      return i + 1; // 1-indexed sheet row
    }
  }
  return null;
}

function doGet(e) {
  var action = e.parameter.action;

  if (action === 'guests') {
    return jsonOut({ guests: getGuestRows() });
  }

  if (action === 'myrsvp') {
    var name = (e.parameter.name || '').trim().toLowerCase();
    var rows = getRsvpRows();
    // doPost now updates in place, so there should only ever be one row per
    // guest — but search from the end anyway as a safety net against any
    // leftover duplicate rows from before this change.
    var match = null;
    for (var i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i].guestName || '').trim().toLowerCase() === name) {
        match = rows[i];
        break;
      }
    }
    return jsonOut({ row: match });
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
// A:Timestamp (first submitted)  B:Name  C:WeddingParty  D:Status  E:Meal
// F:Dietary  G:PlusOneName  H:PlusOneMeal  I:SongRequest  J:Note
// K:LastUpdated  L:Modified (TRUE once a guest has edited their RSVP)
function getRsvpRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVPs');
  var values = sheet.getDataRange().getValues();
  var keys = ['timestamp', 'guestName', 'isWeddingParty', 'status', 'mealSelf',
              'dietarySelf', 'plusOneName', 'mealPlusOne', 'songRequest', 'note',
              'lastUpdated', 'modified'];
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
