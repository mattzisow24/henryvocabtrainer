"use server";

import { z } from "zod";
import { getMember } from "@/lib/auth";
import { markOnboarded } from "@/lib/coach/tools";
import { today } from "@/lib/dates";
import { applySort } from "@/lib/srs";
import { getWord } from "@/lib/words";

const Input = z.array(z.object({ id: z.string(), rating: z.enum(["know", "shaky", "new"]) })).max(500);

/**
 * Saves the first-day sort. Only words that have never been practiced are
 * placed, so running the sort again cannot overwrite real results.
 */
export async function saveSort(input: z.infer<typeof Input>): Promise<{ ok: boolean }> {
  const member = await getMember();
  if (member?.role !== "learner") return { ok: false };
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false };
  const db = member.supabase;
  const day = today();

  const { data: existing, error } = await db.from("word_state").select("word_id").eq("learner_id", member.userId);
  if (error) return { ok: false };
  const taken = new Set((existing ?? []).map((r) => r.word_id as string));
  const now = new Date().toISOString();
  const rated = parsed.data.filter((r) => getWord(r.id) && !taken.has(r.id));
  const rows = rated.flatMap((r) => {
    const state = applySort(r.id, r.rating, day);
    return state ? [{ learner_id: member.userId, ...state, updated_at: now }] : [];
  });
  if (rows.length > 0) {
    const { error: writeError } = await db.from("word_state").upsert(rows);
    if (writeError) return { ok: false };
    const { error: logError } = await db.from("reviews").insert(
      rows.map((r) => ({ learner_id: member.userId, word_id: r.word_id, source: "sort", grade: r.last_grade, day })),
    );
    if (logError) return { ok: false };
  }
  const { error: doneError } = await markOnboarded(db, member.userId);
  return { ok: !doneError };
}
