import { describe, expect, it } from "vitest";
import type { DrillRow, ReviewRow, SessionRow } from "./data";
import { dailyActivity, missedOn } from "./progress";
import { WORDS } from "./words";

const DAY = "2026-11-20";
const session = (day: string): SessionRow => ({
  id: day, status: "done", day, summary: "ok",
  started_at: `${day}T20:00:00Z`, ended_at: `${day}T20:12:00Z`, last_turn_at: `${day}T20:12:00Z`,
});
const drill = (day: string, correct: number, total: number, seconds: number): DrillRow => ({
  id: `${day}-${correct}`, timed: false, total, correct, seconds, day, created_at: "",
});
const review = (day: string, grade: ReviewRow["grade"], source: ReviewRow["source"] = "coach"): ReviewRow => ({ word_id: "irate", source, grade, day });

describe("dailyActivity", () => {
  it("is empty before any practice", () => {
    expect(dailyActivity({ sessions: [], drills: [], reviews: [], day: DAY })).toEqual([]);
  });

  it("lists every day from the first practice to today, newest first, including days off", () => {
    const days = dailyActivity({ sessions: [session("2026-11-17")], drills: [drill(DAY, 8, 10, 240)], reviews: [], day: DAY });
    expect(days.map((d) => d.day)).toEqual([DAY, "2026-11-19", "2026-11-18", "2026-11-17"]);
    expect(days.map((d) => d.practiced)).toEqual([true, false, false, true]);
  });

  it("adds up minutes, coach answers and drill scores for a day", () => {
    const [today] = dailyActivity({
      sessions: [session(DAY)],
      drills: [drill(DAY, 8, 10, 240), drill(DAY, 12, 15, 300)],
      reviews: [review(DAY, "knew"), review(DAY, "knew"), review(DAY, "missed"), review(DAY, "knew", "drill")],
      day: DAY,
    });
    expect(today).toEqual({
      day: DAY,
      practiced: true,
      minutes: 12 + 9,
      // Drill answers are reported through the drill score, not the coach tally.
      coach: { knew: 2, partial: 0, missed: 1 },
      drills: { rounds: 2, correct: 20, total: 25 },
    });
  });

  it("stops at the maximum number of days", () => {
    const days = dailyActivity({ sessions: [session("2026-09-01")], drills: [], reviews: [], day: DAY, maxDays: 14 });
    expect(days).toHaveLength(14);
    expect(days.at(-1)!.day).toBe("2026-11-07");
  });
});

describe("missed today", () => {
  it("lists words missed that day from any practice, in study order, ignoring the sort and other days", () => {
    const reviews: ReviewRow[] = [
      { word_id: "eschew", source: "drill", grade: "missed", day: DAY },
      { word_id: "ameliorate", source: "coach", grade: "missed", day: DAY },
      { word_id: "ameliorate", source: "cards", grade: "knew", day: DAY },
      { word_id: "spurious", source: "cards", grade: "missed", day: DAY },
      { word_id: "evince", source: "coach", grade: "partial", day: DAY },
      { word_id: "efface", source: "sort", grade: "missed", day: DAY },
      { word_id: "proxy", source: "coach", grade: "missed", day: "2026-11-19" },
    ];
    expect(missedOn(WORDS, reviews, DAY).map((w) => w.id)).toEqual(["ameliorate", "eschew", "spurious"]);
  });
});
