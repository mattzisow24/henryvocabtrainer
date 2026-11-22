import { describe, expect, it } from "vitest";
import { addDays, daysBetween, streak } from "./dates";
import { dailyPlan, drillPlan, newWordQuota } from "./plan";
import { applyCoachGrade, applyDrillAnswer, applySort, newState, stageOf, type WordState } from "./srs";
import { QUESTIONS, questionsFor, WORDS } from "./words";

const DAY = "2026-11-22";
const W = "ameliorate";

describe("coach grades", () => {
  it("skips the early boxes when a new word is known cold", () => {
    const s = applyCoachGrade(newState(W, DAY), "knew", DAY);
    expect(s.box).toBe(3);
    expect(s.due).toBe(addDays(DAY, 2));
  });

  it("brings a missed word back the next day and counts a lapse if it was known", () => {
    const known: WordState = { ...newState(W, DAY), box: 4, seen: 3, correct: 3 };
    const s = applyCoachGrade(known, "missed", DAY);
    expect(s).toMatchObject({ box: 1, lapses: 1, due: addDays(DAY, 1), last_grade: "missed" });
  });

  it("takes a missed word to mastered in four days of correct recalls", () => {
    let day = DAY;
    let s = applyCoachGrade(newState(W, day), "missed", day);
    expect(stageOf(s)).toBe("learning");
    while (stageOf(s) !== "mastered") {
      day = s.due;
      s = applyCoachGrade(s, "knew", day);
    }
    expect(daysBetween(DAY, day)).toBe(4);
  });

  it("never drops a half-known word below box 1", () => {
    expect(applyCoachGrade({ ...newState(W, DAY), box: 1, seen: 1 }, "partial", DAY).box).toBe(1);
  });
});

describe("the first-day sort", () => {
  it("treats 'know it' as a claim to verify today, not as mastery", () => {
    const s = applySort(W, "know", DAY)!;
    expect(s).toMatchObject({ box: 2, due: DAY, seen: 1 });
    expect(stageOf(s)).toBe("learning");
    // Two correct answers on separate days are needed from here.
    const first = applyDrillAnswer(s, true, DAY);
    expect(stageOf(first)).toBe("learning");
    expect(stageOf(applyCoachGrade(first, "knew", first.due))).toBe("mastered");
  });

  it("sends shaky words to the coach and leaves unknown words untouched", () => {
    expect(applySort(W, "shaky", DAY)).toMatchObject({ box: 1, due: DAY });
    expect(applySort(W, "new", DAY)).toBeNull();
  });
});

describe("drill answers", () => {
  it("places an unseen word at box 2 when answered correctly", () => {
    expect(applyDrillAnswer(newState(W, DAY), true, DAY)).toMatchObject({ box: 2, due: addDays(DAY, 1) });
  });

  it("promotes a word that is due", () => {
    const due: WordState = { ...newState(W, DAY), box: 3, seen: 2 };
    expect(applyDrillAnswer(due, true, DAY)).toMatchObject({ box: 4, due: addDays(DAY, 3) });
  });

  it("does not promote a word that is not due yet, so same-day repeats cannot inflate it", () => {
    const placed: WordState = { ...newState(W, DAY), box: 3, due: addDays(DAY, 2), seen: 1 };
    const s = applyDrillAnswer(placed, true, DAY);
    expect(s).toMatchObject({ box: 3, due: addDays(DAY, 2), seen: 2, correct: 1 });
  });

  it("sends a missed word back to the coach today", () => {
    const placed: WordState = { ...newState(W, DAY), box: 4, due: addDays(DAY, 8), seen: 4 };
    expect(applyDrillAnswer(placed, false, DAY)).toMatchObject({ box: 1, due: DAY, lapses: 1, last_grade: "missed" });
  });
});

describe("session plans", () => {
  it("paces new words so the whole list is met before the cutoff", () => {
    // 60 unseen with 13 days left: 10 teaching days, 6 a day.
    expect(newWordQuota(60, 13)).toBe(6);
    // A big backlog is capped so a session stays about ten minutes.
    expect(newWordQuota(100, 6)).toBe(10);
    // A small one still moves at the minimum rate.
    expect(newWordQuota(5, 13)).toBe(4);
    expect(newWordQuota(2, 13)).toBe(2);
  });

  it("introduces no new words in the last three days", () => {
    expect(newWordQuota(20, 4)).toBe(20 > 10 ? 10 : 20);
    expect(newWordQuota(20, 3)).toBe(0);
    expect(dailyPlan(WORDS, new Map(), DAY, 3).fresh).toEqual([]);
  });

  it("introduces new words in priority order", () => {
    const { review, fresh } = dailyPlan(WORDS, new Map(), DAY, 13);
    expect(review).toEqual([]);
    expect(fresh).toEqual(WORDS.slice(0, 10).map((w) => w.id));
    expect(fresh[0]).toBe("ameliorate");
  });

  it("puts due words first, weakest first, and skips words already placed", () => {
    const states = new Map<string, WordState>([
      ["eschew", { ...newState("eschew", DAY), box: 2, due: DAY, seen: 1 }],
      ["spurious", { ...newState("spurious", DAY), box: 1, due: addDays(DAY, -1), seen: 1 }],
      ["supplant", { ...newState("supplant", DAY), box: 3, due: addDays(DAY, 2), seen: 1 }],
    ]);
    const { review, fresh } = dailyPlan(WORDS, states, DAY, 13);
    expect(review).toEqual(["spurious", "eschew"]);
    expect(fresh).not.toContain("supplant");
    expect(fresh).not.toContain("eschew");
  });

  it("keeps teaching at the minimum rate after the test date", () => {
    expect(dailyPlan(WORDS, new Map(), DAY, -3).fresh).toHaveLength(4);
  });
});

describe("drill plans", () => {
  it("asks about due words first, then learning words, then unseen words in priority order", () => {
    const states = new Map<string, WordState>([
      ["register", { ...newState("register", DAY), box: 2, due: DAY, seen: 1 }],
      ["discount", { ...newState("discount", DAY), box: 3, due: DAY, seen: 1 }],
      ["belie", { ...newState("belie", DAY), box: 2, due: addDays(DAY, 1), seen: 1 }],
      ["incipient", { ...newState("incipient", DAY), box: 5, due: addDays(DAY, 5), seen: 4 }],
    ]);
    const ids = drillPlan(WORDS, states, DAY, 5, 7);
    expect(ids).toEqual(["discount", "register", "belie", "ameliorate", "eschew"]);
    expect(drillPlan(WORDS, states, DAY, 100, 7).at(-1)).toBe("incipient");
  });

  it("has at least two questions for every word", () => {
    expect(QUESTIONS).toHaveLength(200);
    for (const w of WORDS) expect(questionsFor(w.id).length).toBeGreaterThanOrEqual(2);
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today or yesterday", () => {
    expect(streak([DAY, addDays(DAY, -1), addDays(DAY, -2)], DAY)).toBe(3);
    expect(streak([addDays(DAY, -1), addDays(DAY, -2)], DAY)).toBe(2);
    expect(streak([addDays(DAY, -2)], DAY)).toBe(0);
  });
});
