// Spaced repetition. Each word sits in a box; a higher box means a longer wait
// before the next review. Intervals are very short because the test is days
// away: a word can go from unknown to mastered in four days.

import { addDays } from "./dates";

export type Grade = "knew" | "partial" | "missed";

export type WordState = {
  word_id: string;
  /** 0 = never practiced. 1-3 = learning. 4-5 = mastered. */
  box: number;
  /** Next review day, YYYY-MM-DD. */
  due: string;
  seen: number;
  correct: number;
  /** Times the word dropped back after being known. */
  lapses: number;
  last_grade: Grade | null;
};

/** Days to wait after landing in each box. */
export const INTERVALS = [0, 1, 1, 2, 3, 5];
export const MAX_BOX = INTERVALS.length - 1;
export const MASTERED_BOX = 4;

export function newState(wordId: string, day: string): WordState {
  return { word_id: wordId, box: 0, due: day, seen: 0, correct: 0, lapses: 0, last_grade: null };
}

/** How the learner rated a word in the first-day sort. */
export type SortRating = "know" | "shaky" | "new";

/**
 * The first-day sort. A self-rating is a claim, not evidence, so "know" only
 * places a word where the next context question or coach check will confirm
 * it; "shaky" sends it to the coach; "new" leaves it untouched.
 */
export function applySort(wordId: string, rating: SortRating, day: string): WordState | null {
  if (rating === "new") return null;
  return { ...newState(wordId, day), box: rating === "know" ? 2 : 1, seen: 1, last_grade: rating === "know" ? "knew" : "partial" };
}

/**
 * A typed answer to the coach. Producing the meaning or the right word
 * unprompted is strong evidence, so a first-time "knew" skips the early boxes.
 */
export function applyCoachGrade(prev: WordState, grade: Grade, day: string): WordState {
  const next = { ...prev, seen: prev.seen + 1, last_grade: grade };
  if (grade === "knew") {
    next.box = prev.seen === 0 ? 3 : Math.min(MAX_BOX, prev.box + 1);
    next.correct = prev.correct + 1;
  } else if (grade === "partial") {
    next.box = Math.max(1, prev.box - 1);
  } else {
    if (prev.box >= 3) next.lapses = prev.lapses + 1;
    next.box = 1;
  }
  next.due = addDays(day, INTERVALS[next.box]);
  return next;
}

/**
 * A Words in Context answer. This is the test's own format, so a correct
 * answer on a word that is due moves it up a box. A correct answer on a word
 * that is not due yet changes nothing: repeating a drill the same day must not
 * count as spaced recall. A wrong answer always sends the word back to the coach.
 */
export function applyDrillAnswer(prev: WordState, correct: boolean, day: string): WordState {
  const next = { ...prev, seen: prev.seen + 1 };
  if (correct) {
    next.correct = prev.correct + 1;
    if (prev.box === 0) {
      next.box = 2;
      next.due = addDays(day, INTERVALS[2]);
    } else if (prev.due <= day) {
      next.box = Math.min(MAX_BOX, prev.box + 1);
      next.due = addDays(day, INTERVALS[next.box]);
      next.last_grade = "knew";
    }
    return next;
  }
  if (prev.box >= 3) next.lapses = prev.lapses + 1;
  next.box = 1;
  next.due = day;
  next.last_grade = "missed";
  return next;
}

export type Stage = "new" | "learning" | "mastered";

export function stageOf(state: WordState | undefined): Stage {
  if (!state || state.box === 0) return "new";
  return state.box >= MASTERED_BOX ? "mastered" : "learning";
}
