// Paste this into Extensions > Apps Script (bound to your wedding Sheet),
// then Deploy > New deployment > type "Web app" > Execute as "Me" >
// Who has access: "Anyone" > Deploy, and copy the Web App URL it gives you.

var ADMIN_PASSCODE = 'partyon2026'; // change this to something only you two know

// Normalizes a name for matching: strips accents (José -> jose), normalizes
// curly quotes to straight ones (O'Brien either way), collapses any run of
// whitespace to a single space, trims, and lowercases. Applied to BOTH sides
// of every name comparison in this script (and mirrored in index.html) so a
// stray space or missing accent on either side of the match doesn't matter.
function normalizeName(name) {
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .trim().replace(/\s+/g, ' ')
    .toLowerCase();
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var main = findMainGuest(data.guestName);
  if (!main) {
    return jsonOut({ error: 'unknown guest' });
  }

  // Every submitted plus-one name must actually be linked to this main
  // invitee in the Guests tab — otherwise a POST could claim an arbitrary
  // name as "their plus-one".
  var validPlusOneNames = main.plusOnes.map(function (p) { return normalizeName(p.name); });
  var submittedPlusOnes = Array.isArray(data.plusOnes) ? data.plusOnes : [];
  for (var i = 0; i < submittedPlusOnes.length; i++) {
    if (validPlusOneNames.indexOf(normalizeName(submittedPlusOnes[i].name)) === -1) {
      return jsonOut({ error: 'unknown plus-one' });
    }
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVPs');
  var now = new Date();

  upsertPersonRow(sheet, now, {
    name: main.name,
    linkedTo: '',
    isWeddingParty: main.isWeddingParty,
    status: data.status || '',
    meal: data.mealSelf || '',
    dietary: data.dietarySelf || '',
    songRequest: data.songRequest || '',
    note: data.note || ''
  });

  // A plus-one can only attend if the main invitee does too — the form
  // shouldn't even send plus-one answers otherwise, but enforce it here
  // as well rather than trusting the client.
  if (data.status === 'yes') {
    submittedPlusOnes.forEach(function (p) {
      upsertPersonRow(sheet, now, {
        name: p.name,
        linkedTo: main.name,
        isWeddingParty: false,
        status: p.status || '',
        meal: p.meal || '',
        dietary: p.dietary || '',
        songRequest: '',
        note: ''
      });
    });
  } else {
    // Main invitee isn't attending, so none of their plus-ones can be
    // either — force every one of them (not just whatever this particular
    // submission mentioned) to "no" so an earlier "yes" doesn't linger as
    // stale, contradictory data once the main invitee backs out.
    main.plusOnes.forEach(function (p) {
      upsertPersonRow(sheet, now, {
        name: p.name,
        linkedTo: main.name,
        isWeddingParty: false,
        status: 'no',
        meal: '',
        dietary: '',
        songRequest: '',
        note: ''
      });
    });
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Writes one person's RSVP (main invitee or a plus-one) to their own row,
// updating in place if they've already got one. Column order: B:Name
// C:LinkedTo D:IsWeddingParty E:Status F:Meal G:Dietary H:SongRequest
// I:Note, with LastUpdated/Modified in J:K handled the same way regardless
// of who the row is for.
function upsertPersonRow(sheet, now, person) {
  var cols = [
    person.name,
    person.linkedTo || '',
    person.isWeddingParty || false,
    person.status || '',
    person.meal || '',
    person.dietary || '',
    person.songRequest || '',
    person.note || ''
  ];
  var existingRow = findRsvpRowByName(sheet, person.name);
  if (existingRow) {
    sheet.getRange(existingRow, 2, 1, cols.length).setValues([cols]);
    sheet.getRange(existingRow, 10, 1, 2).setValues([[now, true]]);
  } else {
    sheet.appendRow([now].concat(cols).concat([now, false]));
  }
}

// Case-insensitive, trimmed match against Main-type rows in the Guests tab.
function findMainGuest(guestName) {
  var name = normalizeName(guestName);
  if (!name) return null;
  var match = null;
  getGuestRows().forEach(function (g) {
    if (normalizeName(g.name) === name) match = g;
  });
  return match;
}

// Returns the 1-indexed sheet row for an existing person's RSVP (main
// invitee or plus-one — they're both just rows keyed by their own name), or
// null if they haven't submitted one yet. Matches the same way login does —
// case-insensitive, trimmed, accent/quote-normalized.
function findRsvpRowByName(sheet, personName) {
  var name = normalizeName(personName);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) { // skip header row
    if (normalizeName(values[i][1]) === name) {
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
    var name = normalizeName(e.parameter.name);
    var rows = getRsvpRows();
    // doPost now updates in place, so there should only ever be one row per
    // person — but search from the end anyway as a safety net against any
    // leftover duplicate rows from before that change.
    var mainRow = null;
    for (var i = rows.length - 1; i >= 0; i--) {
      if (!mainRow && normalizeName(rows[i].name) === name && !rows[i].linkedTo) {
        mainRow = rows[i];
      }
    }
    var plusOneRows = rows.filter(function (r) {
      return normalizeName(r.linkedTo) === name;
    });
    return jsonOut({ row: mainRow, plusOnes: plusOneRows });
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
// can say anything (or nothing). Order: A:Name B:WeddingParty
// C:PlusOneAllowed (legacy, ignored) D:InvitedEvents (semicolon-separated)
// E:Type ("Main" or "PlusOne") F:LinkedTo (PlusOne rows only: the exact
// name of the Main invitee they belong to).
//
// Returns one entry per Main invitee, each carrying its own plusOnes array
// (built by matching other rows' LinkedTo against this invitee's name) —
// so nothing downstream needs to know about the raw row structure. A row
// with a blank or unrecognized Type is treated as Main, so a typo makes
// someone an ordinary (if unexpected) guest rather than silently
// disappearing from the list.
function getGuestRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guests');
  var values = sheet.getDataRange().getValues();
  var rows = values.slice(1) // skip row 1 (the header/label row, whatever it says)
    .filter(function (row) { return row.join('') !== ''; });

  var plusOnesByMain = {}; // normalized main name -> [{ name }, ...]
  rows.forEach(function (row) {
    var type = String(row[4] || '').trim().toLowerCase();
    if (type === 'plusone') {
      var linkedTo = normalizeName(row[5]);
      if (!plusOnesByMain[linkedTo]) plusOnesByMain[linkedTo] = [];
      plusOnesByMain[linkedTo].push({ name: row[0] });
    }
  });

  return rows
    .filter(function (row) { return String(row[4] || '').trim().toLowerCase() !== 'plusone'; })
    .map(function (row) {
      var name = row[0];
      return {
        name: name,
        isWeddingParty: String(row[1]).toUpperCase() === 'TRUE',
        invitedEvents: row[3] ? String(row[3]).split(';').map(function (s) { return s.trim(); }) : [],
        plusOnes: plusOnesByMain[normalizeName(name)] || []
      };
    });
}

// Reads columns by POSITION, not by header text — so row 1 in the sheet
// can say anything you want (or nothing at all). Order is what matters:
// A:Timestamp (first submitted)  B:Name (this row's own person — a main
// invitee or a plus-one)  C:LinkedTo (blank for a main invitee's own row;
// the main invitee's name for a plus-one's row)  D:IsWeddingParty
// E:Status  F:Meal  G:Dietary  H:SongRequest (main invitee's row only —
// shared per party)  I:Note (main invitee's row only)  J:LastUpdated
// K:Modified (TRUE once this person's row has been edited)
function getRsvpRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RSVPs');
  var values = sheet.getDataRange().getValues();
  var keys = ['timestamp', 'name', 'linkedTo', 'isWeddingParty', 'status', 'meal',
              'dietary', 'songRequest', 'note', 'lastUpdated', 'modified'];
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
