// Progress numbers shown on the home page and the dashboard.

import { SECONDS_PER_QUESTION } from "./config";
import type { DrillRow, ReviewRow, SessionRow, StateRow } from "./data";
import { addDays, daysBetween, streak } from "./dates";
import { outlook, type Outlook } from "./exam";
import { stageOf } from "./srs";
import type { Word } from "./words";

/** Minutes a session ran, from its first to its last turn. */
export function sessionMinutes(s: SessionRow): number {
  const end = s.ended_at ?? s.last_turn_at;
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(s.started_at)) / 60_000));
}

export type Progress = {
  /** The SAT date as seen from today. */
  exam: Outlook;
  streak: number;
  total: number;
  mastered: number;
  learning: number;
  notStarted: number;
  /** Words due for review today. */
  due: number;
  minutesThisWeek: number;
  practicedToday: boolean;
};

export function summarize(opts: {
  words: Word[];
  states: Map<string, StateRow>;
  sessions: SessionRow[];
  drills: DrillRow[];
  reviews: ReviewRow[];
  day: string;
}): Progress {
  const { words, states, sessions, drills, day } = opts;
  let mastered = 0;
  let learning = 0;
  let due = 0;
  for (const w of words) {
    const s = states.get(w.id);
    const stage = stageOf(s);
    if (stage === "mastered") mastered++;
    else if (stage === "learning") learning++;
    if (s && s.box > 0 && s.due <= day) due++;
  }
  const practiceDays = [...sessions.map((s) => s.day), ...drills.map((d) => d.day), ...opts.reviews.map((r) => r.day)];
  const weekAgo = addDays(day, -6);
  const minutesThisWeek =
    sessions.filter((s) => s.day >= weekAgo).reduce((n, s) => n + sessionMinutes(s), 0) +
    Math.round(drills.filter((d) => d.day >= weekAgo).reduce((n, d) => n + d.seconds, 0) / 60);
  return {
    exam: outlook(day),
    streak: streak(practiceDays, day),
    total: words.length,
    mastered,
    learning,
    notStarted: words.length - mastered - learning,
    due,
    minutesThisWeek,
    practicedToday: practiceDays.includes(day),
  };
}

/** Correct and total answers over the given runs, timed or untimed. */
export function drillAccuracy(drills: DrillRow[], timed: boolean) {
  const runs = drills.filter((d) => d.timed === timed);
  const total = runs.reduce((n, d) => n + d.total, 0);
  const correct = runs.reduce((n, d) => n + d.correct, 0);
  const timedRuns = runs.filter((d) => d.timed && d.total > 0);
  const secondsPerQuestion = timedRuns.length
    ? Math.round(timedRuns.reduce((n, d) => n + d.seconds, 0) / timedRuns.reduce((n, d) => n + d.total, 0))
    : null;
  return { runs: runs.length, total, correct, secondsPerQuestion, targetSeconds: SECONDS_PER_QUESTION };
}

export type DayActivity = {
  day: string;
  practiced: boolean;
  minutes: number;
  /** Words answered with the coach, by how they went. */
  coach: { knew: number; partial: number; missed: number };
  drills: { rounds: number; correct: number; total: number };
};

/**
 * One entry per calendar day, newest first, from the first day with any
 * practice up to today (at most `maxDays`). Days with nothing are included,
 * so gaps are visible. Empty when there has been no practice at all.
 */
export function dailyActivity(opts: {
  sessions: SessionRow[];
  drills: DrillRow[];
  reviews: ReviewRow[];
  day: string;
  maxDays?: number;
}): DayActivity[] {
  const { sessions, drills, reviews, day, maxDays = 28 } = opts;
  const allDays = [...sessions.map((s) => s.day), ...drills.map((d) => d.day), ...reviews.map((r) => r.day)];
  if (allDays.length === 0) return [];
  const first = allDays.reduce((a, b) => (a < b ? a : b));
  const span = Math.min(maxDays, daysBetween(first, day) + 1);

  const out: DayActivity[] = [];
  for (let i = 0; i < span; i++) {
    const d = addDays(day, -i);
    const daySessions = sessions.filter((s) => s.day === d);
    const dayDrills = drills.filter((x) => x.day === d);
    const coachReviews = reviews.filter((r) => r.day === d && r.source === "coach");
    const count = (grade: ReviewRow["grade"]) => coachReviews.filter((r) => r.grade === grade).length;
    const seconds = dayDrills.reduce((n, x) => n + x.seconds, 0);
    out.push({
      day: d,
      practiced: daySessions.length > 0 || dayDrills.length > 0 || coachReviews.length > 0,
      minutes: daySessions.reduce((n, x) => n + sessionMinutes(x), 0) + (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0),
      coach: { knew: count("knew"), partial: count("partial"), missed: count("missed") },
      drills: {
        rounds: dayDrills.length,
        correct: dayDrills.reduce((n, x) => n + x.correct, 0),
        total: dayDrills.reduce((n, x) => n + x.total, 0),
      },
    });
  }
  return out;
}
