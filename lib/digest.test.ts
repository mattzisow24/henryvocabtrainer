import { describe, expect, it } from "vitest";
import type { DrillRow, ReviewRow, SessionRow, StateRow } from "./data";
import { composeDigest, digestFacts, digestSubject, parseNote } from "./digest";
import { WORDS } from "./words";

const DAY = "2026-11-20";
const state = (word_id: string, box: number, confused: string | null = null): StateRow => ({
  word_id, box, due: DAY, seen: 2, correct: 1, lapses: 0, last_grade: "knew", confused_with: confused, note: null, updated_at: "",
});
const session = (day: string): SessionRow => ({
  id: day, status: "done", day, summary: "Solid session, strong on roots.\nNeeds work: attenuate\nNext: contrast attenuate and accentuate",
  started_at: `${day}T20:00:00Z`, ended_at: `${day}T20:14:00Z`, last_turn_at: `${day}T20:14:00Z`,
});
const drill = (day: string): DrillRow => ({ id: day, timed: false, total: 15, correct: 12, seconds: 300, day, created_at: "" });
const review = (word_id: string, grade: ReviewRow["grade"], day = DAY): ReviewRow => ({ word_id, source: "coach", grade, day });

const active = () =>
  digestFacts({
    words: WORDS,
    states: new Map([
      ["attenuate", state("attenuate", 1, "accentuate")],
      ["eschew", state("eschew", 4)],
      ["evince", state("evince", 2)],
    ]),
    sessions: [session("2026-11-18"), session(DAY)],
    drills: [drill(DAY)],
    reviews: [review("eschew", "knew"), review("evince", "partial"), review("attenuate", "missed"), review("eschew", "knew", "2026-11-18")],
    day: DAY,
  });

describe("daily email", () => {
  it("reports a day with practice", () => {
    const f = active();
    expect(f.today).toMatchObject({ practiced: true, minutes: 14 + 5, coach: { knew: 1, partial: 1, missed: 1 }, drills: { rounds: 1, correct: 12, total: 15 } });
    expect(f.week).toEqual({ practiced: 2, days: 3 });
    expect(f.missedToday).toEqual([{ word: "attenuate", confusedWith: "accentuate" }]);
    // Only the headline of the coach's summary goes in the email.
    expect(f.sessionNotes).toEqual(["Solid session, strong on roots."]);
    expect(digestSubject(f)).toBe("Henry practiced today: 19 min, 3 words, 1 drill");
  });

  it("says so plainly when there was no practice", () => {
    const f = digestFacts({ words: WORDS, states: new Map(), sessions: [session("2026-11-18")], drills: [], reviews: [], day: DAY });
    expect(f.today.practiced).toBe(false);
    expect(digestSubject(f)).toBe("Henry hasn't practiced today");
    expect(composeDigest(f, null, null).text).toMatch(/Today\s+No practice yet/);
  });

  it("flags when the pace won't cover the list before the test", () => {
    // 3 words met in 3 days is 1 a day; 97 left with 12 teaching days before the test needs about 8.1.
    const f = active();
    expect(f.pace).toEqual({ perDay: 1, needPerDay: 8.1, onTrack: false });
    expect(composeDigest(f, null, null).text).toMatch(/Pace\s+Behind: 1 new a day, needs 8.1/);
  });

  it("builds matching text and HTML, escaping anything that could be markup", () => {
    const f = active();
    const note = { headline: 'He said "<b>easy</b>" & moved on.', points: ["Keeps reading attenuate as accentuate."] };
    const email = composeDigest(f, note, "https://example.com/dashboard");
    expect(email.text).toContain('He said "<b>easy</b>" & moved on.\n- Keeps reading attenuate as accentuate.');
    expect(email.html).toContain("He said &quot;&lt;b&gt;easy&lt;/b&gt;&quot; &amp; moved on.");
    expect(email.html).not.toContain("<b>easy</b>");
    expect(email.html).toContain('href="https://example.com/dashboard"');
    expect(email.text).toMatch(/Missed\s+attenuate \(said accentuate\)/);
    for (const label of ["Today", "Coach", "Drills", "Missed", "Habit", "Words", "Pace", "Test"]) expect(email.html).toContain(`>${label}</td>`);
  });

  it("keeps the email short", () => {
    const email = composeDigest(active(), { headline: "Good day.", points: ["One.", "Two.", "Three."] }, "https://example.com/dashboard");
    expect(email.text.split("\n").length).toBeLessThanOrEqual(20);
  });

  it("reads a headline and at most three points out of the written note", () => {
    expect(parseNote("Solid day, nothing needs you.\n- Roots are clicking.\n* Mixes up look-alikes.\n- a\n- b")).toEqual({
      headline: "Solid day, nothing needs you.",
      points: ["Roots are clicking.", "Mixes up look-alikes.", "a"],
    });
    expect(parseNote("Fine.")).toEqual({ headline: "Fine.", points: [] });
    expect(parseNote("  \n")).toBeNull();
  });
});
