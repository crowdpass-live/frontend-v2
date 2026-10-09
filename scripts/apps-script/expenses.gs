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
 *   SUMMARY_NAME optional — the calculations tab; default "Summary"
 *
 * Columns, header in row 1, data from row 2. Amounts are US dollars.
 *   A Date | B Description | C Category | D Amount ($) | E Paid by
 *   F Method | G Receipt link | H Running total (formula — the sheet's own)
 *
 * The script writes A–G only. Column H stays the sheet's: a new row copies
 * the formula from the row above, so whatever calculation finance set up
 * carries on. Only when there's nothing to copy does it write a plain
 * running SUM.
 *
 * Every other figure on the admin page comes from the Summary tab, which is
 * all formulas. The script builds it the first time it's missing and from
 * then on only READS it — finance owns it, types monthly budgets into column
 * B, and can restyle it freely as long as the cells stay where they are:
 *   A–F  Category | Monthly budget | Spent this month | Remaining | % used | Spent all time
 *        one row per category, then a Total row
 *   H–I  Month | Spent — the last 12 months, newest first
 *   K–L  This month | Last month | Change | Change %
 */

var HEADER_ROWS = 1;
var LIST_LIMIT = 50;
var USD = "$#,##0.00";

/** Must match EXPENSE_CATEGORIES in src/lib/expenses.ts. */
var CATEGORIES = [
  "Operations",
  "Marketing",
  "Salaries",
  "Software & tools",
  "Transport",
  "Events",
  "Legal & compliance",
  "Bank charges",
  "Other",
];

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

    if (req.action === "list") {
      var out = list(sheet);
      out.summary = summary(sheet, props.getProperty("SUMMARY_NAME") || "Summary");
      return reply(out);
    }
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
    sheet.getRange(row, 4).setNumberFormat(USD);

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
 * The Summary tab's figures, building the tab first if it doesn't exist.
 * Returns null rather than failing the whole list if it can't be read —
 * the entries are still worth showing.
 */
function summary(sheet, name) {
  try {
    var ss = sheet.getParent();
    var tab = ss.getSheetByName(name) || buildSummary(ss, name, sheet.getName());
    var tz = ss.getSpreadsheetTimeZone();

    var cats = [];
    var total = null;
    var rows = tab.getRange(2, 1, Math.max(1, tab.getLastRow() - 1), 6).getValues();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r[0] === "") continue;
      var entry = {
        name: String(r[0]),
        budget: num(r[1]),
        spentThisMonth: num(r[2]) || 0,
        remaining: num(r[3]),
        used: num(r[4]),
        spentAllTime: num(r[5]) || 0,
      };
      if (entry.name === "Total") { total = entry; break; }
      cats.push(entry);
    }

    var months = tab.getRange(2, 8, 12, 2).getValues().map(function (m) {
      return {
        month: m[0] instanceof Date ? Utilities.formatDate(m[0], tz, "yyyy-MM") : String(m[0]),
        spent: num(m[1]) || 0,
      };
    });
    var cmp = tab.getRange(1, 12, 4, 1).getValues();

    return {
      categories: cats,
      budget: total
        ? { total: total.budget, spent: total.spentThisMonth, remaining: total.remaining, used: total.used }
        : null,
      allTime: total ? total.spentAllTime : null,
      months: months,
      thisMonth: num(cmp[0][0]) || 0,
      lastMonth: num(cmp[1][0]) || 0,
      change: num(cmp[2][0]),
      changePct: num(cmp[3][0]),
    };
  } catch (err) {
    console.error("summary failed", err);
    return null;
  }
}

/**
 * Lay out the Summary tab, all formulas over the expenses tab's columns.
 * Run once, by `summary()` when the tab is missing — delete the tab to have
 * it rebuilt (budgets typed into it go with it).
 */
function buildSummary(ss, name, dataName) {
  var tab = ss.insertSheet(name);
  var d = "'" + dataName.replace(/'/g, "''") + "'!";
  var A = d + "$A$2:$A", C = d + "$C$2:$C", D = d + "$D$2:$D";
  var n = CATEGORIES.length;
  var totalRow = n + 2;

  tab.getRange(1, 1, 1, 6).setValues([[
    "Category", "Monthly budget ($)", "Spent this month ($)", "Remaining ($)", "% used", "Spent all time ($)",
  ]]);
  var rows = CATEGORIES.map(function (cat, i) {
    var r = i + 2;
    return [
      cat,
      "",
      "=SUMIFS(" + D + "," + C + ",$A" + r + "," + A + ",\">=\"&$H$2," + A + ",\"<\"&EDATE($H$2,1))",
      "=IF($B" + r + "=\"\",\"\",$B" + r + "-$C" + r + ")",
      "=IF(N($B" + r + ")=0,\"\",$C" + r + "/$B" + r + ")",
      "=SUMIF(" + C + ",$A" + r + "," + D + ")",
    ];
  });
  tab.getRange(2, 1, n, 6).setValues(rows);
  var t = totalRow, last = totalRow - 1;
  tab.getRange(t, 1, 1, 6).setValues([[
    "Total",
    "=IF(COUNT(B2:B" + last + ")=0,\"\",SUM(B2:B" + last + "))",
    // Every category's spend, including any typed by hand outside the list.
    "=SUMIFS(" + D + "," + A + ",\">=\"&$H$2," + A + ",\"<\"&EDATE($H$2,1))",
    "=IF($B" + t + "=\"\",\"\",$B" + t + "-$C" + t + ")",
    "=IF(N($B" + t + ")=0,\"\",$C" + t + "/$B" + t + ")",
    "=SUM(" + D + ")",
  ]]);

  tab.getRange("H1:I1").setValues([["Month", "Spent ($)"]]);
  var months = [];
  for (var k = 0; k < 12; k++) {
    var r = k + 2;
    months.push([
      k === 0 ? "=DATE(YEAR(TODAY()),MONTH(TODAY()),1)" : "=EDATE(H" + (r - 1) + ",-1)",
      "=SUMIFS(" + D + "," + A + ",\">=\"&H" + r + "," + A + ",\"<\"&EDATE(H" + r + ",1))",
    ]);
  }
  tab.getRange(2, 8, 12, 2).setValues(months);

  tab.getRange("K1:L4").setValues([
    ["This month ($)", "=I2"],
    ["Last month ($)", "=I3"],
    ["Change ($)", "=L1-L2"],
    ["Change %", "=IF(L2=0,\"\",L3/L2)"],
  ]);

  tab.getRange(2, 2, n + 1, 3).setNumberFormat(USD);
  tab.getRange(2, 6, n + 1, 1).setNumberFormat(USD);
  tab.getRange(2, 5, n + 1, 1).setNumberFormat("0.0%");
  tab.getRange("H2:H13").setNumberFormat("mmm yyyy");
  tab.getRange("I2:I13").setNumberFormat(USD);
  tab.getRange("L1:L3").setNumberFormat(USD);
  tab.getRange("L4").setNumberFormat("0.0%");
  tab.getRange("A1:L1").setFontWeight("bold");
  tab.getRange(t, 1, 1, 6).setFontWeight("bold");
  tab.getRange("K1:K4").setFontWeight("bold");
  tab.getRange("B1").setNote("Type a monthly budget per category. Leave blank for no budget.");
  tab.setFrozenRows(1);
  SpreadsheetApp.flush();
  return tab;
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
