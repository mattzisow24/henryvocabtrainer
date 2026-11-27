"use server";

import { z } from "zod";
import { getMember } from "@/lib/auth";
import { today } from "@/lib/dates";
import { markAnswer, wordOutcomes } from "@/lib/lesson";
import { applyDrillAnswer, newState, type WordState } from "@/lib/srs";
import { getQuestion, getWord } from "@/lib/words";

const Input = z.object({
  seconds: z.number().int().min(0).max(7200),
  /** First attempts only: the choice picked or the text typed. */
  answers: z.array(z.object({ id: z.string().max(80), answer: z.string().max(200).nullable() })).min(1).max(80),
});

/**
 * Saves a finished lesson. Answers are re-marked here, so the stored score
 * never depends on what the browser claims. A lesson is stored as an untimed
 * round in drill_runs; each word then moves as it would for one drill answer:
 * right on every exercise counts as correct, any miss sends it to the coach.
 */
export async function saveLesson(input: z.infer<typeof Input>): Promise<{ ok: boolean }> {
  const member = await getMember();
  if (member?.role !== "learner") return { ok: false };
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false };
  const db = member.supabase;
  const day = today();

  const seen = new Set<string>();
  const marked = parsed.data.answers.flatMap((a) => {
    if (seen.has(a.id)) return [];
    seen.add(a.id);
    const m = markAnswer(a.id, a.answer, getWord, getQuestion);
    return m ? [{ id: a.id, chosen: a.answer, ...m }] : [];
  });
  if (marked.length === 0) return { ok: false };

  const { error: runError } = await db.from("drill_runs").insert({
    learner_id: member.userId,
    timed: false,
    total: marked.length,
    correct: marked.filter((m) => m.correct).length,
    seconds: parsed.data.seconds,
    items: marked.map(({ id, chosen, correct }) => ({ id, chosen, correct })),
    day,
  });
  if (runError) return { ok: false };

  const outcomes = wordOutcomes(marked);
  const { data: rows, error: readError } = await db
    .from("word_state")
    .select("word_id, box, due, seen, correct, lapses, last_grade")
    .eq("learner_id", member.userId)
    .in("word_id", [...outcomes.keys()]);
  if (readError) return { ok: false };
  const states = new Map(((rows ?? []) as WordState[]).map((r) => [r.word_id, r]));
  const now = new Date().toISOString();
  const { error: writeError } = await db.from("word_state").upsert(
    [...outcomes].map(([wordId, correct]) => ({
      learner_id: member.userId,
      ...applyDrillAnswer(states.get(wordId) ?? newState(wordId, day), correct, day),
      updated_at: now,
    })),
  );
  if (writeError) return { ok: false };
  const { error: logError } = await db.from("reviews").insert(
    [...outcomes].map(([wordId, correct]) => ({ learner_id: member.userId, word_id: wordId, source: "drill", grade: correct ? "knew" : "missed", day })),
  );
  return { ok: !logError };
}
