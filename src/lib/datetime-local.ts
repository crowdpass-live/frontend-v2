/**
 * Conversions for `<input type="datetime-local">` (#15, `DateTimeField`).
 *
 * The input speaks `YYYY-MM-DDTHH:mm` in the browser's LOCAL time with no
 * zone; the API speaks ISO-8601 UTC. Getting this wrong shifts every event
 * by the viewer's offset (an hour in Lagos), so all conversion goes through
 * these two functions and nowhere else.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO (any zone) → the input's local wall-clock value. `""` if unusable. */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The input's local value → ISO UTC. `null` when empty or invalid. */
export function fromLocalInputValue(value: string | null | undefined): string | null {
  if (!value) return null;
  // No zone suffix, so the Date constructor reads it as local time.
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
