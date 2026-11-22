// Calendar-day helpers in the family's time zone. Days are "YYYY-MM-DD" strings.

import { TIME_ZONE } from "./config";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The local calendar day of an instant. */
export function dayOf(at: Date | string): string {
  return fmt.format(typeof at === "string" ? new Date(at) : at);
}

export function today(now = new Date()): string {
  return dayOf(now);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (negative if b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

/**
 * Consecutive days with practice, ending today. A streak survives until the
 * end of today, so yesterday still counts when today has no practice yet.
 */
export function streak(practiceDays: Iterable<string>, now = today()): number {
  const days = new Set(practiceDays);
  let day = days.has(now) ? now : addDays(now, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
