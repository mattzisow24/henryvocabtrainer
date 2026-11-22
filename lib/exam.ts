// The SAT date and how to talk about it. One sitting; everything is paced to it.

import { TEST_DATE } from "./config";
import { daysBetween } from "./dates";

export type Outlook = {
  date: string;
  /** Days until the test; 0 on the day, negative once it has passed. */
  daysAway: number;
};

export function outlook(day: string, date: string = TEST_DATE): Outlook {
  return { date, daysAway: daysBetween(day, date) };
}

const short = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const inDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

/** One line for the learner's home screen. */
export function learnerLine(o: Outlook): string {
  if (o.daysAway < 0) return `The ${short(o.date)} SAT is done.`;
  return `SAT ${inDays(o.daysAway)}.`;
}

/** One line for parents. */
export function parentLine(o: Outlook): string {
  if (o.daysAway < 0) return `Took the SAT on ${short(o.date)}.`;
  return `SAT on ${short(o.date)}, ${inDays(o.daysAway)}.`;
}

/** What the coach is told about the date. */
export function coachBrief(o: Outlook, name: string): string {
  if (o.daysAway < 0) return `${name} took the SAT on ${short(o.date)}. He may sit it again in the spring; keep building.`;
  if (o.daysAway === 0) return `${name} takes the SAT today. Keep this short and confidence-building: quick review only, nothing new.`;
  if (o.daysAway <= 3) {
    return `${name} takes the SAT ${inDays(o.daysAway)} (${short(o.date)}). No new words from here on: this is consolidation. Keep it brisk and leave him sure of what he knows.`;
  }
  return `${name} takes the SAT ${inDays(o.daysAway)} (${short(o.date)}). He knows the timeline and wants to be pushed; do not spend session time talking about the date.`;
}
