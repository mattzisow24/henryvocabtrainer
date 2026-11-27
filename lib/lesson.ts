// Builds a lesson: a short run of mixed exercises on a handful of words, one
// per screen, with instant feedback. Everything here is deterministic and
// checkable without a model, so a lesson has no waiting between screens.
//
// What a lesson can and cannot show: tapping the right choice is recognition,
// which is weaker evidence than producing an answer for the coach. So a lesson
// moves a word at most one box (through applyDrillAnswer), and any miss sends
// the word to the coach.

import { shuffled } from "./plan";
import type { WordState } from "./srs";
import { typedIsOneOf } from "./typed";
import { questionsFor, stemOf, type Question, type Word } from "./words";

export type Exercise =
  /** A first look at a word he has not met. Not graded. */
  | { kind: "intro"; id: string; wordId: string; word: string; pos: string; definition: string; example: string; hook: string; senses: Word["senses"] }
  /** Tap each word, then its meaning. A warm-up: not graded. */
  | { kind: "match"; id: string; pairs: { wordId: string; word: string; definition: string }[]; order: number[] }
  /** A Words in Context question from the bank. */
  | { kind: "question"; id: string; wordId: string; stem: string; passage: string; choices: string[]; answer: number; why: string; meaning: string }
  /** Pick the word that has this meaning. */
  | { kind: "choose"; id: string; wordId: string; definition: string; choices: string[]; answer: number; why: string }
  /** Type the word that fits the sentence, from its meaning and first letter. */
  | { kind: "type"; id: string; wordId: string; definition: string; sentence: string; answer: string; accept: string[]; why: string };

export type Graded = Extract<Exercise, { kind: "question" | "choose" | "type" }>;

/**
 * Words too close in meaning to appear as alternatives to one another when
 * the only clue is a bare definition. Telling these apart needs a passage,
 * which is the job of the question bank and the coach.
 */
const CLUSTERS: string[][] = [
  ["ameliorate", "mitigate", "attenuate", "assuage", "abate", "temper"],
  ["supplant", "supersede"],
  ["ubiquitous", "pervasive"],
  ["copious", "myriad", "multifarious"],
  ["corroborate", "substantiate", "buttress", "vindicate"],
  ["spurious", "contrived"],
  ["nebulous", "amorphous", "enigmatic", "equivocal"],
  ["superfluous", "extraneous", "immaterial", "inconsequential"],
  ["engender", "induce", "precipitate", "catalyze", "elicit"],
  ["evince", "manifest", "denote"],
  ["repudiate", "renounce", "eschew", "discount"],
  ["accentuate", "foreground", "augment"],
  ["paradigmatic", "quintessential"],
  ["byzantine", "convoluted"],
  ["proxy", "surrogate"],
  ["insuperable", "prohibitive", "untenable"],
  ["scrupulous", "exhaustive"],
  ["discern", "appraise"],
  ["irrefutable", "unequivocal"],
  ["incongruous", "anomalous", "idiosyncratic"],
  ["delineate", "enumerate", "stipulate", "recapitulate"],
  ["harbinger", "pretext"],
];
const clusterOf = new Map<string, Set<string>>();
for (const group of CLUSTERS) for (const id of group) clusterOf.set(id, new Set([...(clusterOf.get(id) ?? []), ...group]));

/** True when the two words must not be offered as alternatives for a bare definition. */
export function tooClose(a: Word, b: Word): boolean {
  if (a.id === b.id || clusterOf.get(a.id)?.has(b.id)) return true;
  const mentions = (w: Word, other: Word) => [...w.synonyms, ...w.confusedWith].some((x) => x.toLowerCase().startsWith(other.id));
  return mentions(a, b) || mentions(b, a);
}

/** The form of the word used in its example sentence, e.g. "ameliorated". */
export function formInExample(w: Word): string | null {
  const stem = w.word.slice(0, Math.max(4, w.word.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${stem}\\w*`, "i").exec(w.example)?.[0] ?? null;
}

/** The spellings a typing exercise accepts: the base word and the form in the example. */
export function acceptedSpellings(w: Word): string[] {
  return [w.word, formInExample(w)].filter((x): x is string => !!x);
}

/** How often each question has been asked recently, so a lesson can prefer the ones he has seen least. */
export type Usage = Map<string, number>;

/** The least-used question for a word; ties are broken by the seed. */
export function pickQuestion(wordId: string, usage: Usage, seed: number): Question | null {
  const options = questionsFor(wordId);
  if (options.length === 0) return null;
  return shuffled(options, seed).sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0))[0];
}

function questionExercise(w: Word, q: Question, seed: number): Graded {
  const choices = shuffled(q.choices, seed);
  return {
    kind: "question",
    id: `q:${q.id}`,
    wordId: w.id,
    stem: stemOf(q),
    passage: q.passage,
    choices,
    answer: choices.indexOf(q.answer),
    why: q.why,
    meaning: `${w.word} (${w.pos}): ${w.definition}`,
  };
}

function chooseExercise(w: Word, all: Word[], seed: number): Graded | null {
  const others = shuffled(
    all.filter((x) => x.pos === w.pos && !tooClose(w, x)),
    seed,
  ).slice(0, 2);
  if (others.length < 2) return null;
  const choices = shuffled([w.word, ...others.map((x) => x.word)], seed + 1);
  return {
    kind: "choose",
    id: `choose:${w.id}`,
    wordId: w.id,
    definition: w.definition,
    choices,
    answer: choices.indexOf(w.word),
    why: `${w.word}: ${w.definition}. ${w.hook}`,
  };
}

function typeExercise(w: Word): Graded | null {
  const form = formInExample(w);
  if (!form) return null;
  return {
    kind: "type",
    id: `type:${w.id}`,
    wordId: w.id,
    definition: w.definition,
    sentence: w.example.replace(form, "______"),
    answer: form,
    accept: acceptedSpellings(w),
    why: `${w.word}: ${w.definition}. ${w.hook}`,
  };
}

/** How many of a lesson's words get a typing exercise. */
const TYPE_COUNT = 4;
const MATCH_SIZE = 5;

/**
 * The exercises for a lesson, in order:
 *   1. each new word is introduced, then checked at once with an easy pick;
 *   2. a matching warm-up across the lesson's words;
 *   3. one Words in Context question for every word, in mixed order;
 *   4. the word typed from memory, for words he has met before.
 */
export function buildLesson(opts: {
  /** This lesson's words. */
  words: Word[];
  /** The whole list, for wrong choices. */
  all: Word[];
  states: Map<string, WordState>;
  usage: Usage;
  seed: number;
}): Exercise[] {
  const { words, all, states, usage, seed } = opts;
  const isNew = (w: Word) => (states.get(w.id)?.box ?? 0) === 0;
  const out: Exercise[] = [];

  words.filter(isNew).forEach((w, i) => {
    out.push({ kind: "intro", id: `intro:${w.id}`, wordId: w.id, word: w.word, pos: w.pos, definition: w.definition, example: w.example, hook: w.hook, senses: w.senses });
    const pick = chooseExercise(w, all, seed + i * 13);
    if (pick) out.push(pick);
  });

  if (words.length >= 4) {
    const pairs = shuffled(words, seed + 3).slice(0, MATCH_SIZE).map((w) => ({ wordId: w.id, word: w.word, definition: w.definition }));
    out.push({ kind: "match", id: "match", pairs, order: shuffled(pairs.map((_, i) => i), seed + 5) });
  }

  shuffled(words, seed + 7).forEach((w, i) => {
    const q = pickQuestion(w.id, usage, seed + i);
    if (q) out.push(questionExercise(w, q, seed + i * 17));
  });

  // Weakest first: those are the words that most need producing.
  const known = words.filter((w) => !isNew(w)).sort((a, b) => (states.get(a.id)?.box ?? 0) - (states.get(b.id)?.box ?? 0));
  for (const w of known.slice(0, TYPE_COUNT)) {
    const typed = typeExercise(w);
    if (typed) out.push(typed);
  }
  return out;
}

/**
 * Marks one first-attempt answer by exercise id: the text of the choice
 * picked, or what was typed. Null when the id is not a graded exercise.
 * Used on the server, so a saved score never depends on the browser's word.
 */
export function markAnswer(id: string, answer: string | null, getWord: (id: string) => Word | undefined, getQuestion: (id: string) => Question | undefined): { wordId: string; correct: boolean } | null {
  const cut = id.indexOf(":");
  const kind = id.slice(0, cut);
  const key = id.slice(cut + 1);
  if (kind === "q") {
    const q = getQuestion(key);
    return q ? { wordId: q.word, correct: answer === q.answer } : null;
  }
  const w = getWord(key);
  if (!w) return null;
  if (kind === "choose") return { wordId: w.id, correct: answer === w.word };
  if (kind === "type") return { wordId: w.id, correct: typedIsOneOf(acceptedSpellings(w), answer ?? "") };
  return null;
}

/** A word passes a lesson only if every graded exercise on it was right the first time. */
export function wordOutcomes(marked: { wordId: string; correct: boolean }[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const m of marked) out.set(m.wordId, (out.get(m.wordId) ?? true) && m.correct);
  return out;
}
