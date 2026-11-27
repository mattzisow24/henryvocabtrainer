import { describe, expect, it } from "vitest";
import { acceptedSpellings, buildLesson, formInExample, markAnswer, pickQuestion, tooClose, wordOutcomes, type Exercise } from "./lesson";
import { newState, type WordState } from "./srs";
import { typedIsOneOf } from "./typed";
import { getQuestion, getWord, QUESTIONS, questionsFor, WORDS } from "./words";

const DAY = "2026-11-27";
const word = (id: string) => getWord(id)!;
const met = (id: string, box: number): [string, WordState] => [id, { ...newState(id, DAY), box, seen: 1 }];

describe("building a lesson", () => {
  const ids = ["ameliorate", "eschew", "spurious", "supplant", "nominal", "proxy", "dearth", "imbue"];
  const states = new Map<string, WordState>(ids.slice(2).map((id, i) => met(id, (i % 3) + 1)));
  const lesson = buildLesson({ words: ids.map(word), all: WORDS, states, usage: new Map(), seed: 11 });
  const of = <K extends Exercise["kind"]>(kind: K) => lesson.filter((e): e is Extract<Exercise, { kind: K }> => e.kind === kind);

  it("introduces each new word and checks it straight away", () => {
    expect(of("intro").map((e) => e.wordId)).toEqual(["ameliorate", "eschew"]);
    expect(lesson.slice(0, 4).map((e) => e.kind)).toEqual(["intro", "choose", "intro", "choose"]);
    expect(lesson[1]).toMatchObject({ kind: "choose", wordId: "ameliorate" });
  });

  it("asks one context question for every word", () => {
    expect(of("question").map((e) => e.wordId).sort()).toEqual([...ids].sort());
    for (const q of of("question")) expect(q.choices[q.answer]).toBe(getQuestion(q.id.slice(2))!.answer);
  });

  it("has him type only words he has met, weakest first, with the blanked example", () => {
    const typed = of("type");
    expect(typed).toHaveLength(4);
    for (const t of typed) {
      expect(states.has(t.wordId)).toBe(true);
      expect(t.sentence).toContain("______");
      expect(t.sentence.toLowerCase()).not.toContain(t.answer.toLowerCase());
    }
    expect(states.get(typed[0].wordId)!.box).toBe(1);
  });

  it("includes one matching round of five pairs", () => {
    expect(of("match")).toHaveLength(1);
    expect(of("match")[0].pairs).toHaveLength(5);
    expect([...of("match")[0].order].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("never offers a near-synonym as a wrong choice for a bare definition", () => {
    for (const w of WORDS) {
      const picks = buildLesson({ words: [w], all: WORDS, states: new Map(), usage: new Map(), seed: w.priority }).filter((e) => e.kind === "choose");
      expect(picks).toHaveLength(1);
      for (const e of picks) {
        if (e.kind !== "choose") continue;
        expect(e.choices).toHaveLength(3);
        for (const c of e.choices) if (c !== w.word) expect(tooClose(w, word(c))).toBe(false);
      }
    }
    expect(tooClose(word("supplant"), word("supersede"))).toBe(true);
    expect(tooClose(word("mitigate"), word("attenuate"))).toBe(true);
    expect(tooClose(word("dearth"), word("proxy"))).toBe(false);
  });
});

describe("choosing questions", () => {
  it("prefers the question he has seen least", () => {
    const all = questionsFor("ameliorate").map((q) => q.id);
    expect(all).toHaveLength(4);
    const usage = new Map(all.map((id, i) => [id, i === 2 ? 0 : 3]));
    expect(pickQuestion("ameliorate", usage, 5)!.id).toBe(all[2]);
  });

  it("has four questions for every word", () => {
    expect(QUESTIONS).toHaveLength(400);
    for (const w of WORDS) expect(questionsFor(w.id)).toHaveLength(4);
  });
});

describe("typed answers", () => {
  it("can blank the word out of every example", () => {
    for (const w of WORDS) expect(formInExample(w), w.id).not.toBeNull();
  });

  it("accepts the base word, the form in the sentence, and one slip on a long word", () => {
    const accept = acceptedSpellings(word("ameliorate"));
    expect(accept).toEqual(["ameliorate", "ameliorated"]);
    expect(typedIsOneOf(accept, " Ameliorated ")).toBe(true);
    expect(typedIsOneOf(accept, "ameliorate")).toBe(true);
    expect(typedIsOneOf(accept, "amelierate")).toBe(true);
    expect(typedIsOneOf(accept, "amelerat")).toBe(false);
    expect(typedIsOneOf(accept, "")).toBe(false);
    // Short words must be exact: one letter off is often another word.
    expect(typedIsOneOf(["abate"], "abase")).toBe(false);
  });
});

describe("marking", () => {
  it("re-marks each kind of answer and ignores anything that is not graded", () => {
    const q = questionsFor("eschew")[0];
    expect(markAnswer(`q:${q.id}`, q.answer, getWord, getQuestion)).toEqual({ wordId: "eschew", correct: true });
    expect(markAnswer(`q:${q.id}`, null, getWord, getQuestion)).toEqual({ wordId: "eschew", correct: false });
    expect(markAnswer("choose:proxy", "proxy", getWord, getQuestion)).toEqual({ wordId: "proxy", correct: true });
    expect(markAnswer("choose:proxy", "dearth", getWord, getQuestion)).toEqual({ wordId: "proxy", correct: false });
    expect(markAnswer("type:dearth", "Dearth", getWord, getQuestion)).toEqual({ wordId: "dearth", correct: true });
    expect(markAnswer("intro:dearth", "x", getWord, getQuestion)).toBeNull();
    expect(markAnswer("match", "x", getWord, getQuestion)).toBeNull();
    expect(markAnswer("q:nope-9", "x", getWord, getQuestion)).toBeNull();
  });

  it("passes a word only if every exercise on it was right first time", () => {
    const out = wordOutcomes([
      { wordId: "eschew", correct: true },
      { wordId: "eschew", correct: false },
      { wordId: "proxy", correct: true },
      { wordId: "proxy", correct: true },
    ]);
    expect([...out]).toEqual([["eschew", false], ["proxy", true]]);
  });
});
