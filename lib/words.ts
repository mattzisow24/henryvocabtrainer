// The word list and the Words in Context question bank. Content lives in
// /content as JSON and is bundled at build time.

import wordData from "@/content/words.json";
import questionData from "@/content/questions.json";

/** How the tutor's own gloss holds up; "none" when the list gave no gloss. */
export type ListCheck = "none" | "ok" | "imprecise" | "wrong";

export type Word = {
  id: string;
  word: string;
  pos: string;
  /** The sense the SAT most often tests, in plain words. */
  definition: string;
  example: string;
  /** Memory aid: a root, a technical use he already knows, or a familiar phrase. */
  hook: string;
  /** Near-synonyms. Useful for meaning, dangerous as answer choices. */
  synonyms: string[];
  /** Look-alikes and near-synonyms, each with how it differs. */
  confusedWith: string[];
  /** Other senses the SAT uses. */
  senses: { meaning: string; example: string }[];
  /** Study order, 1 = first. */
  priority: number;
  /** 1 = core (top 40), 2 = next 35, 3 = last 25. */
  tier: 1 | 2 | 3;
  /** Evidence from the tutor's list: student reports, and test dates reported on. */
  reports: number;
  testDates: number;
  listGloss: string;
  listCheck: ListCheck;
  listNote: string;
};

export type Question = {
  id: string;
  /** The study word this question gives evidence about. */
  word: string;
  /** "blank": pick the word that completes the text. "meaning": what the marked word means here. */
  type: "blank" | "meaning";
  /** A blank is "______"; a marked word is wrapped as [[word]]. */
  passage: string;
  choices: string[];
  answer: string;
  why: string;
};

export const WORDS = [...(wordData as Word[])].sort((a, b) => a.priority - b.priority);
export const QUESTIONS = questionData as Question[];

const byId = new Map(WORDS.map((w) => [w.id, w]));
const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));
const questionsByWord = new Map<string, Question[]>();
for (const q of QUESTIONS) questionsByWord.set(q.word, [...(questionsByWord.get(q.word) ?? []), q]);

export function getWord(id: string): Word | undefined {
  return byId.get(id.trim().toLowerCase());
}

export function getQuestion(id: string): Question | undefined {
  return questionById.get(id);
}

export function questionsFor(wordId: string): Question[] {
  return questionsByWord.get(wordId) ?? [];
}

/** The standard SAT stem for each question type. */
export function stemOf(q: Question): string {
  return q.type === "blank"
    ? "Which choice completes the text with the most logical and precise word or phrase?"
    : `As used in the text, what does the word "${/\[\[(.+?)\]\]/.exec(q.passage)?.[1] ?? q.word}" most nearly mean?`;
}
