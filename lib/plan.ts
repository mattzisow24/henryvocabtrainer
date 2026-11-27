// Chooses which words a coach session or a drill covers.

import { LESSON_NEW_MAX, LESSON_WORDS, NEW_WORD_CUTOFF_DAYS, SESSION_NEW_MAX, SESSION_NEW_MIN, SESSION_REVIEW_CAP } from "./config";
import type { WordState } from "./srs";
import type { Word } from "./words";

type States = Map<string, WordState>;

/** Deterministic shuffle, so a plan can be rebuilt from its seed. */
export function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const boxOf = (states: States, id: string) => states.get(id)?.box ?? 0;

/**
 * New words a session should introduce so that every unseen word is met
 * before the cutoff. Zero once the test is too close for a new word to stick.
 */
export function newWordQuota(unseen: number, daysToTest: number): number {
  const teachingDays = daysToTest - NEW_WORD_CUTOFF_DAYS;
  if (unseen === 0 || teachingDays <= 0) return 0;
  return Math.min(unseen, SESSION_NEW_MAX, Math.max(SESSION_NEW_MIN, Math.ceil(unseen / teachingDays)));
}

/**
 * A coach session: reviews that are due, weakest first, then new words in
 * priority order. After the test date has passed, pacing no longer applies
 * and new words are introduced at the minimum rate.
 */
export function dailyPlan(words: Word[], states: States, day: string, daysToTest: number): { review: string[]; fresh: string[] } {
  const review = words
    .filter((w) => {
      const s = states.get(w.id);
      return s && s.box > 0 && s.due <= day;
    })
    .sort((a, b) => {
      const sa = states.get(a.id)!;
      const sb = states.get(b.id)!;
      return sa.box - sb.box || sa.due.localeCompare(sb.due) || a.priority - b.priority;
    })
    .slice(0, SESSION_REVIEW_CAP)
    .map((w) => w.id);
  const unseen = words.filter((w) => boxOf(states, w.id) === 0).sort((a, b) => a.priority - b.priority);
  // Lessons introduce most new words. The coach's first job is the words he
  // missed or is shaky on, so it adds new ones only when few are waiting.
  if (review.length >= SESSION_REVIEW_CAP / 2) return { review, fresh: [] };
  const quota = daysToTest < 0 ? Math.min(unseen.length, SESSION_NEW_MIN) : newWordQuota(unseen.length, daysToTest);
  return { review, fresh: unseen.slice(0, quota).map((w) => w.id) };
}

/**
 * Words for a Words in Context drill. Due words come first, highest box
 * first: those are the ones a correct answer can confirm or promote. Then
 * words still being learned, then unseen words in priority order (a question
 * on an unseen word is a useful pretest), then mastered words.
 */
export function drillPlan(words: Word[], states: States, day: string, count: number, seed: number): string[] {
  const rank = (w: Word) => {
    const s = states.get(w.id);
    if (!s || s.box === 0) return 2;
    if (s.due <= day) return 0;
    return s.box < 4 ? 1 : 3;
  };
  return shuffled(words, seed)
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 0) return boxOf(states, b.id) - boxOf(states, a.id);
      if (ra === 2) return a.priority - b.priority;
      return 0;
    })
    .slice(0, count)
    .map((w) => w.id);
}

/**
 * Words for a lesson: a few new ones (none once the test is too close), then
 * words that are due, weakest first. If that does not fill the lesson, words
 * still being learned and then mastered ones top it up, so there is always a
 * lesson to do; answers on words that are not due change nothing.
 */
export function lessonPlan(words: Word[], states: States, day: string, daysToTest: number): string[] {
  const unseen = words.filter((w) => boxOf(states, w.id) === 0).sort((a, b) => a.priority - b.priority);
  const quota = daysToTest < 0 ? Math.min(unseen.length, SESSION_NEW_MIN) : newWordQuota(unseen.length, daysToTest);
  const fresh = unseen.slice(0, Math.min(quota, LESSON_NEW_MAX));
  const met = words
    .filter((w) => boxOf(states, w.id) > 0)
    .sort((a, b) => {
      const sa = states.get(a.id)!;
      const sb = states.get(b.id)!;
      const dueA = sa.due <= day ? 0 : 1;
      const dueB = sb.due <= day ? 0 : 1;
      return dueA - dueB || sa.box - sb.box || sa.due.localeCompare(sb.due) || a.priority - b.priority;
    });
  return [...fresh, ...met.slice(0, LESSON_WORDS - fresh.length)].map((w) => w.id);
}
