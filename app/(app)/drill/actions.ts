"use server";

import { z } from "zod";
import { getMember } from "@/lib/auth";
import { today } from "@/lib/dates";
import { applyDrillAnswer, newState, type WordState } from "@/lib/srs";
import { getQuestion } from "@/lib/words";

const Input = z.object({
  timed: z.boolean(),
  seconds: z.number().int().min(0).max(7200),
  /** `chosen` is the text of the choice picked, or null if unanswered. */
  answers: z.array(z.object({ id: z.string(), chosen: z.string().max(200).nullable() })).min(1).max(60),
});

/**
 * Saves a finished drill. Answers are re-marked here against the question
 * bank, so the stored score never depends on what the browser claims.
 */
export async function saveDrill(input: z.infer<typeof Input>): Promise<{ ok: boolean }> {
  const member = await getMember();
  if (member?.role !== "learner") return { ok: false };
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { timed, seconds, answers } = parsed.data;
  const db = member.supabase;
  const day = today();

  const marked = answers.flatMap((a) => {
    const q = getQuestion(a.id);
    return q ? [{ id: q.id, word: q.word, chosen: a.chosen, correct: a.chosen === q.answer }] : [];
  });
  if (marked.length === 0) return { ok: false };

  const { error: runError } = await db.from("drill_runs").insert({
    learner_id: member.userId,
    timed,
    total: marked.length,
    correct: marked.filter((m) => m.correct).length,
    seconds,
    items: marked.map(({ id, chosen, correct }) => ({ id, chosen, correct })),
    day,
  });
  if (runError) return { ok: false };

  // One schedule change per word, even if a drill ever asks two questions on it.
  const byWord = new Map(marked.map((m) => [m.word, m]));
  const { data: rows } = await db
    .from("word_state")
    .select("word_id, box, due, seen, correct, lapses, last_grade")
    .eq("learner_id", member.userId)
    .in("word_id", [...byWord.keys()]);
  const states = new Map(((rows ?? []) as WordState[]).map((r) => [r.word_id, r]));
  const now = new Date().toISOString();
  await db.from("word_state").upsert(
    [...byWord.values()].map((m) => ({
      learner_id: member.userId,
      ...applyDrillAnswer(states.get(m.word) ?? newState(m.word, day), m.correct, day),
      updated_at: now,
    })),
  );
  await db.from("reviews").insert(
    [...byWord.values()].map((m) => ({
      learner_id: member.userId,
      word_id: m.word,
      source: "drill",
      grade: m.correct ? "knew" : "missed",
      day,
    })),
  );
  return { ok: true };
}
