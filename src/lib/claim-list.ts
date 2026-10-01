/**
 * Parsing an organizer's pasted (or CSV) dues list into claim entries.
 * Ported from `v2-mobile/src/lib/claimList.js`, so a list that works in the
 * app works here.
 *
 * The list almost always comes out of a spreadsheet, so a paste arrives as
 * tab-separated rows; a WhatsApp'd list or a .csv arrives comma-separated.
 * Both work, as do `;` and `|`. Column order is not assumed: the matric
 * number is whichever field carries a digit, since a name never does and
 * "CSC/2021/041" always does. That also lets a header row ("Name, Matric
 * No") drop out on its own.
 */

/** Shared by the server read and the browser's import / unlock / remove. */
export function claimEntriesPath(eventId: string, ticketTypeId: string): string {
  return `/organizer/events/${encodeURIComponent(eventId)}/ticket-types/${encodeURIComponent(ticketTypeId)}/claim-entries`;
}

/** `CreateClaimEntriesDto` field limits. */
const NAME_MAX = 200;
const MATNO_MAX = 50;

/** `CreateClaimEntriesDto` caps an upload at 2000; larger lists are batched. */
export const CLAIM_UPLOAD_BATCH = 2000;

export interface ClaimEntryInput {
  fullName: string;
  matNo: string;
}

export interface ParsedClaimList {
  entries: ClaimEntryInput[];
  /** Lines that did not read as one name and one matric number. */
  invalid: string[];
  /** Matric numbers seen more than once; only the first is kept. */
  duplicates: string[];
}

/**
 * Mirrors `normalizeMatNo()` in the backend's claim-matching.util.ts. The
 * API 400s the WHOLE upload on a duplicate, so duplicates are caught here
 * with the same folding the server uses.
 */
export function normalizeMatNo(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

const hasDigit = (s: string) => /\d/.test(s);

/** Strips one layer of CSV quoting: `"Obi, Ada"` -> `Obi, Ada`. */
function unquote(field: string): string {
  const f = field.trim();
  return f.length >= 2 && f.startsWith('"') && f.endsWith('"')
    ? f.slice(1, -1).replace(/""/g, '"').trim()
    : f;
}

/** Splits on the first separator present, respecting double quotes. */
function splitRow(line: string): string[] {
  for (const sep of ["\t", ",", ";", "|"]) {
    if (!line.includes(sep)) continue;
    const fields: string[] = [];
    let cur = "";
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      if (ch === sep && !quoted) {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields.map(unquote).filter(Boolean);
  }
  return [line.trim()];
}

const SERIAL = /^\d{1,4}\.?$/;

export function parseClaimList(text: string): ParsedClaimList {
  const entries: ClaimEntryInput[] = [];
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();

  const rows = text
    // A spreadsheet export may lead with a byte-order mark.
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => ({ line, fields: splitRow(line) }));

  // Dues lists usually lead with an S/N column. Decided for the WHOLE list,
  // not line by line: a row whose matric number is missing ("4, Only A Name")
  // has a single number left, and judged alone that serial would pass as the
  // matric number. When most multi-field rows open with a short bare number
  // followed by another number, the first column is serials — everywhere.
  const multi = rows.filter((r) => r.fields.length > 1);
  const serialRows = multi.filter(
    (r) => SERIAL.test(r.fields[0]) && r.fields.slice(1).some(hasDigit),
  ).length;
  const serialColumn = multi.length > 0 && serialRows * 2 >= multi.length;

  rows.forEach(({ line, fields: raw }, i) => {
    let fields = serialColumn && SERIAL.test(raw[0]) ? raw.slice(1) : raw;
    // Without a serial column, still drop a stray serial on a line that also
    // has a real matric number.
    if (fields.filter(hasDigit).length > 1) {
      fields = fields.filter((f) => !SERIAL.test(f));
    }
    const numeric = fields.filter(hasDigit);
    const words = fields.filter((f) => !hasDigit(f));

    // A first line with no digits at all is a header, not a person.
    if (i === 0 && numeric.length === 0) return;

    if (fields.length < 2 || numeric.length !== 1 || words.length < 1) {
      invalid.push(line);
      return;
    }
    const fullName = words.join(" ").replace(/\s+/g, " ");
    const matNo = normalizeMatNo(numeric[0]);
    if (fullName.length > NAME_MAX || matNo.length > MATNO_MAX) {
      invalid.push(line);
      return;
    }
    if (seen.has(matNo)) {
      duplicates.push(matNo);
      return;
    }
    seen.add(matNo);
    entries.push({ fullName, matNo });
  });

  return { entries, invalid, duplicates };
}

/** One line summarising what a parse will upload. */
export function describeParse({ entries, invalid, duplicates }: ParsedClaimList): string {
  const parts = [`${entries.length} ${entries.length === 1 ? "member" : "members"}`];
  if (duplicates.length) {
    parts.push(`${duplicates.length} duplicate${duplicates.length === 1 ? "" : "s"} skipped`);
  }
  if (invalid.length) {
    parts.push(`${invalid.length} line${invalid.length === 1 ? "" : "s"} not understood`);
  }
  return parts.join(" · ");
}
