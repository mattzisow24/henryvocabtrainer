import { describe, expect, it } from "vitest";
import type { DrillRow, ReviewRow, SessionRow, StateRow } from "./data";
import { computeRewards, POINTS } from "./rewards";
import { WORDS } from "./words";

const DAY = "2026-11-20";
const state = (word_id: string, box: number): StateRow => ({
  word_id, box, due: DAY, seen: 2, correct: 1, lapses: 0, last_grade: "knew", confused_with: null, note: null, updated_at: "",
});
const session = (day: string, done = true): SessionRow => ({
  id: day, status: done ? "done" : "active", day, summary: done ? "Went well." : null,
  started_at: `${day}T20:00:00Z`, ended_at: null, last_turn_at: `${day}T20:10:00Z`,
});
const drill = (over: Partial<DrillRow>): DrillRow => ({
  id: "d", timed: false, total: 10, correct: 7, seconds: 200, day: DAY, created_at: "", ...over,
});
const run = (over: Partial<Parameters<typeof computeRewards>[0]> = {}) =>
  computeRewards({ words: WORDS, states: new Map(), sessions: [], drills: [], reviews: [], day: DAY, ...over });

describe("rewards", () => {
  it("starts at zero with nothing earned", () => {
    const r = run();
    expect(r.points).toBe(0);
    expect(r.level).toBe(1);
    expect(r.next).toMatchObject({ level: 2, pointsToGo: 150, fraction: 0 });
    expect(r.milestones.some((t) => t.earned)).toBe(false);
    expect(r.today).toEqual({ coach: false, drill: false });
  });

  it("adds points from coach answers, drills, finished sessions and mastered words", () => {
    const reviews: ReviewRow[] = [
      { word_id: "eschew", source: "coach", grade: "knew", day: DAY },
      { word_id: "evince", source: "coach", grade: "missed", day: DAY },
      // Drill answers are counted through the drill's score, not here.
      { word_id: "efface", source: "drill", grade: "knew", day: DAY },
      // Sort ratings earn nothing.
      { word_id: "proxy", source: "sort", grade: "knew", day: DAY },
    ];
    const r = run({
      reviews,
      drills: [drill({ correct: 7 })],
      sessions: [session(DAY)],
      states: new Map([["eschew", state("eschew", 4)]]),
    });
    expect(r.points).toBe(POINTS.knew + POINTS.missed + 7 * POINTS.drillCorrect + POINTS.sessionDone + POINTS.mastered);
    expect(r.today).toEqual({ coach: true, drill: true });
  });

  it("moves up a level and reports progress to the next one", () => {
    const r = run({ drills: [drill({ total: 60, correct: 50 })] });
    expect(r.points).toBe(200);
    expect(r.level).toBe(2);
    expect(r.next).toMatchObject({ level: 3, pointsToGo: 200 });
    expect(r.next!.fraction).toBeCloseTo(0.2);
  });

  it("marks milestones only when their conditions are met", () => {
    const earned = (r: ReturnType<typeof run>) => r.milestones.filter((t) => t.earned).map((t) => t.id);
    expect(earned(run({ sessions: [session(DAY, false)] }))).toEqual([]);
    expect(earned(run({ sessions: [session("2026-11-18"), session("2026-11-19"), session(DAY)] }))).toEqual(["first", "streak-3"]);
    expect(earned(run({ drills: [drill({ timed: true, correct: 10 })] }))).toEqual(["perfect", "clock"]);
    expect(earned(run({ drills: [drill({ timed: true, correct: 7 })] }))).toEqual([]);
    const ten = new Map(WORDS.slice(0, 10).map((w) => [w.id, state(w.id, 4)]));
    expect(earned(run({ states: ten }))).toContain("mastered-10");
    expect(earned(run({ states: ten }))).not.toContain("mastered-25");
    expect(earned(run({ states: ten }))).not.toContain("core");
    const core = new Map(WORDS.filter((w) => w.tier === 1).map((w) => [w.id, state(w.id, 4)]));
    expect(earned(run({ states: core }))).toContain("core");
  });
});
