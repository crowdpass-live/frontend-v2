/**
 * CrowdPass expenses tracker — Google Apps Script web app.
 *
 * Bound to the expenses spreadsheet (Extensions → Apps Script). The admin page
 * at /admin/expenses reaches it ONLY through the Next route
 * `/api/admin/expenses`, which checks the user is an ADMIN and adds the shared
 * secret. Deploy steps are in scripts/apps-script/README.md.
 *
 * Script properties (Project Settings → Script properties):
 *   SECRET      required — same value as EXPENSES_SCRIPT_SECRET on Vercel
 *   SHEET_NAME  optional — the tab holding the rows; default "Expenses"
 *
 * Columns, header in row 1, data from row 2:
 *   A Date | B Description | C Category | D Amount (₦) | E Paid by
 *   F Method | G Receipt link | H Running total (formula — the sheet's own)
 *
 * The script writes A–G only. Column H stays the sheet's: a new row copies
 * the formula from the row above, so whatever calculation finance set up
 * carries on. Only when there's nothing to copy does it write a plain
 * running SUM.
 */

var HEADER_ROWS = 1;
var LIST_LIMIT = 50;

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty("SECRET");
    // No secret configured = refuse everything, never accept everything.
    if (!secret || req.secret !== secret) return reply({ ok: false, error: "unauthorized" });

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      props.getProperty("SHEET_NAME") || "Expenses"
    );
    if (!sheet) return reply({ ok: false, error: "sheet not found" });

    if (req.action === "list") return reply(list(sheet));
    if (req.action === "add") return reply(add(sheet, req.expense, req.enteredBy));
    return reply({ ok: false, error: "unknown action" });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** A GET from a browser just says the deployment is alive — no data. */
function doGet() {
  return reply({ ok: true, service: "crowdpass-expenses" });
}

function list(sheet) {
  var last = lastDataRow(sheet);
  var rows = [];
  if (last > HEADER_ROWS) {
    var first = Math.max(HEADER_ROWS + 1, last - LIST_LIMIT + 1);
    var values = sheet.getRange(first, 1, last - first + 1, 8).getValues();
    for (var i = values.length - 1; i >= 0; i--) {
      rows.push(toRow(sheet, first + i, values[i]));
    }
  }
  return {
    ok: true,
    rows: rows,
    count: Math.max(0, last - HEADER_ROWS),
    total: rows.length ? rows[0].runningTotal : null,
  };
}

function add(sheet, x, enteredBy) {
  if (!x || typeof x !== "object") return { ok: false, error: "no expense" };
  if (typeof x.amount !== "number" || !(x.amount > 0)) return { ok: false, error: "bad amount" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.date))) return { ok: false, error: "bad date" };

  // Two admins saving at once must not land on the same row.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var tz = sheet.getParent().getSpreadsheetTimeZone();
    var row = lastDataRow(sheet) + 1;

    sheet.getRange(row, 1, 1, 7).setValues([[
      Utilities.parseDate(x.date, tz, "yyyy-MM-dd"),
      text(x.description),
      text(x.category),
      x.amount,
      text(x.paidBy),
      text(x.method),
      x.receipt ? text(x.receipt) : "",
    ]]);

    // Recalculate first: an ARRAYFORMULA in H2 fills this cell only after a
    // flush, and writing over it would break the whole column.
    SpreadsheetApp.flush();
    var total = sheet.getRange(row, 8);
    var above = sheet.getRange(row - 1, 8);
    if (!total.getFormula() && total.getValue() === "") {
      if (row - 1 > HEADER_ROWS && above.getFormula()) {
        above.copyTo(total); // keeps finance's formula, relative refs shifted
      } else {
        total.setFormula("=SUM(D$" + (HEADER_ROWS + 1) + ":D" + row + ")");
      }
    }

    sheet.getRange(row, 1).setNote(
      "Entered by " + (enteredBy || "unknown") + " via CrowdPass admin, " +
      Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm")
    );

    SpreadsheetApp.flush();
    var saved = toRow(sheet, row, sheet.getRange(row, 1, 1, 8).getValues()[0]);
    return { ok: true, row: saved, total: saved.runningTotal };
  } finally {
    lock.releaseLock();
  }
}

/**
 * The last row with a date in column A. Not `getLastRow()`: an ARRAYFORMULA
 * or a formatted-but-empty block in another column pushes that far below the
 * real data, and new entries would land after a gap.
 */
function lastDataRow(sheet) {
  var max = sheet.getLastRow();
  if (max <= HEADER_ROWS) return HEADER_ROWS;
  var col = sheet.getRange(HEADER_ROWS + 1, 1, max - HEADER_ROWS, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {
    if (col[i][0] !== "" && col[i][0] !== null) return HEADER_ROWS + 1 + i;
  }
  return HEADER_ROWS;
}

function toRow(sheet, row, v) {
  var tz = sheet.getParent().getSpreadsheetTimeZone();
  return {
    row: row,
    date: v[0] instanceof Date ? Utilities.formatDate(v[0], tz, "yyyy-MM-dd") : String(v[0]),
    description: String(v[1]),
    category: String(v[2]),
    amount: num(v[3]) || 0,
    paidBy: String(v[4]),
    method: String(v[5]),
    receipt: v[6] ? String(v[6]) : null,
    runningTotal: num(v[7]),
  };
}

/** Numbers typed by hand can arrive as "₦5,000" text. */
function num(v) {
  if (typeof v === "number") return v;
  if (v === "" || v === null) return null;
  var n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : null;
}

/**
 * Text as text. `setValues` treats a leading = + - @ as a formula, so a
 * description like "=IMPORTXML(...)" would run in finance's sheet. The
 * apostrophe makes it literal and doesn't show in the cell.
 */
function text(v) {
  var s = String(v == null ? "" : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}
