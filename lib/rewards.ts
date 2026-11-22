// Points, level and milestones. Everything here is worked out from practice
// records that already exist, so there is nothing extra to store or to get
// out of step.

import type { DrillRow, ReviewRow, SessionRow, StateRow } from "./data";
import { streak } from "./dates";
import { MASTERED_BOX } from "./srs";
import type { Word } from "./words";

/** Points per event. Effort earns something; getting it right earns more. */
export const POINTS = { knew: 10, partial: 5, missed: 2, drillCorrect: 4, sessionDone: 25, mastered: 20 } as const;

/** Level thresholds, by total points. Level n is LEVELS[n - 1]. */
export const LEVELS = [0, 150, 400, 800, 1400, 2200, 3200, 4500] as const;

export type Milestone = {
  id: string;
  name: string;
  /** Two or three characters shown inside the badge. */
  mark: string;
  /** What it takes, written for the learner. */
  how: string;
  earned: boolean;
  /** Progress toward it, when that is a simple count. */
  progress?: { have: number; need: number };
};

export type Rewards = {
  points: number;
  /** 1-based. */
  level: number;
  /** The points still needed for the next level; null at the top. */
  next: { level: number; pointsToGo: number; fraction: number } | null;
  milestones: Milestone[];
  today: { coach: boolean; drill: boolean };
};

export function computeRewards(opts: {
  words: Word[];
  states: Map<string, StateRow>;
  sessions: SessionRow[];
  drills: DrillRow[];
  reviews: ReviewRow[];
  day: string;
}): Rewards {
  const { words, states, sessions, drills, reviews, day } = opts;
  const coachReviews = reviews.filter((r) => r.source === "coach");
  const finished = sessions.filter((s) => s.status === "done" && s.summary);
  const mastered = words.filter((w) => (states.get(w.id)?.box ?? 0) >= MASTERED_BOX);
  const drillCorrect = drills.reduce((n, d) => n + d.correct, 0);

  const points =
    coachReviews.reduce((n, r) => n + POINTS[r.grade], 0) +
    drillCorrect * POINTS.drillCorrect +
    finished.length * POINTS.sessionDone +
    mastered.length * POINTS.mastered;

  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i]) index = i;
  const upcoming = LEVELS[index + 1];
  const next =
    upcoming === undefined
      ? null
      : { level: index + 2, pointsToGo: upcoming - points, fraction: (points - LEVELS[index]) / (upcoming - LEVELS[index]) };

  const days = [...sessions.map((s) => s.day), ...drills.map((d) => d.day), ...reviews.map((r) => r.day)];
  const run = streak(days, day);
  // The longest run ever is not stored, so streak milestones track the current one.
  const core = words.filter((w) => w.tier === 1);
  const coreMastered = core.filter((w) => mastered.includes(w)).length;
  const multi = words.filter((w) => w.senses.length > 0);
  const multiMastered = multi.filter((w) => mastered.includes(w)).length;
  const missedBefore = new Set(reviews.filter((r) => r.grade === "missed").map((r) => r.word_id));
  const comebacks = mastered.filter((w) => missedBefore.has(w.id)).length;

  const count = (id: string, mark: string, name: string, how: string, have: number, need: number): Milestone => ({
    id,
    mark,
    name,
    how,
    earned: need > 0 && have >= need,
    progress: { have: Math.min(have, need), need },
  });
  const flag = (id: string, mark: string, name: string, how: string, earned: boolean): Milestone => ({ id, mark, name, how, earned });

  const milestones: Milestone[] = [
    flag("first", "1", "First session", "Finish a session with your coach.", finished.length > 0),
    count("streak-3", "3d", "Three days running", "Practice three days in a row.", run, 3),
    count("streak-7", "7d", "A full week", "Practice seven days in a row.", run, 7),
    count("streak-12", "12d", "Every day to the test", "Practice twelve days in a row.", run, 12),
    count("mastered-10", "10", "First ten", "Master 10 words.", mastered.length, 10),
    count("mastered-25", "25", "A quarter down", "Master 25 words.", mastered.length, 25),
    count("core", "T1", "Core locked in", `Master all ${core.length} first-tier words.`, coreMastered, core.length),
    count("mastered-50", "50", "Halfway", "Master 50 words.", mastered.length, 50),
    count("mastered-75", "75", "Three quarters", "Master 75 words.", mastered.length, 75),
    count("mastered-all", "All", "The whole list", "Master every word on the list.", mastered.length, words.length),
    count("senses", "2nd", "Second meanings", "Master 10 words that the SAT uses in more than one sense.", multiMastered, Math.min(10, multi.length)),
    count("comeback", "Re", "Recovered", "Master 5 words you missed the first time.", comebacks, 5),
    count("context-100", "100", "A hundred in context", "Get 100 Words in Context questions right.", drillCorrect, 100),
    flag("perfect", "10/10", "Clean round", "Get every question right in a drill of 10 or more.", drills.some((d) => d.total >= 10 && d.correct === d.total)),
    flag("clock", "Pace", "On pace", "Score 90% or better on a timed drill.", drills.some((d) => d.timed && d.total >= 10 && d.correct / d.total >= 0.9)),
  ];

  return {
    points,
    level: index + 1,
    next,
    milestones,
    today: {
      coach: sessions.some((s) => s.day === day && s.status === "done") || coachReviews.some((r) => r.day === day),
      drill: drills.some((d) => d.day === day),
    },
  };
}
