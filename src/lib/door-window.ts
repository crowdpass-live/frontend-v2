/**
 * Where an event stands relative to its check-in window, which the backend
 * defines as exactly `startTime` to `endTime` — `verify` and `checkin` both
 * refuse outside it. Ported from mobile's `checkInWindow()`.
 *
 * "Not open yet" and "ended" are different answers to someone standing at a
 * door at 7pm wondering whether they are early or late; "closed" alone
 * tells them neither.
 */
export type CheckInWindow = "open" | "upcoming" | "ended";

export function checkInWindow(
  event: { startTime: string; endTime: string | null },
  now = Date.now(),
): CheckInWindow {
  if (now < new Date(event.startTime).getTime()) return "upcoming";
  if (event.endTime && now > new Date(event.endTime).getTime()) return "ended";
  return "open";
}
