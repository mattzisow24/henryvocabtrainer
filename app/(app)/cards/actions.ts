"use server";

import { z } from "zod";
import { getMember } from "@/lib/auth";
import { today } from "@/lib/dates";
import { applyCardMiss, type WordState } from "@/lib/srs";
import { getWord } from "@/lib/words";

const Input = z.array(z.object({ id: z.string(), missed: z.boolean() })).min(1).max(200);

/**
 * Saves a flashcard round. Only misses change the schedule; see applyCardMiss.
 * Every card is logged so the day counts as practice.
 */
export async function saveCards(input: z.infer<typeof Input>): Promise<{ ok: boolean }> {
  const member = await getMember();
  if (member?.role !== "learner") return { ok: false };
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false };
  const db = member.supabase;
  const day = today();
  const cards = [...new Map(parsed.data.filter((c) => getWord(c.id)).map((c) => [c.id, c])).values()];
  if (cards.length === 0) return { ok: false };

  const missed = cards.filter((c) => c.missed).map((c) => c.id);
  if (missed.length > 0) {
    const { data: rows, error } = await db
      .from("word_state")
      .select("word_id, box, due, seen, correct, lapses, last_grade")
      .eq("learner_id", member.userId)
      .in("word_id", missed);
    if (error) return { ok: false };
    const now = new Date().toISOString();
    const changed = ((rows ?? []) as WordState[]).filter((r) => r.box > 0).map((r) => ({ learner_id: member.userId, ...applyCardMiss(r, day), updated_at: now }));
    if (changed.length > 0) {
      const { error: writeError } = await db.from("word_state").upsert(changed);
      if (writeError) return { ok: false };
    }
  }
  const { error: logError } = await db.from("reviews").insert(
    cards.map((c) => ({ learner_id: member.userId, word_id: c.id, source: "cards", grade: c.missed ? "missed" : "knew", day })),
  );
  return { ok: !logError };
}
